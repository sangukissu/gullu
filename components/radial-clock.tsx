"use client"

import type React from "react"
import { type PropsWithChildren, useRef, useState, useEffect } from "react"
import { angleToMinutes, clampMinutes, minutesToAngle, snapTo, DAY_MINUTES } from "@/lib/time"
import type { PlannerTask } from "./types"

type ClockMode = "24h" | "12h"
type Half = "AM" | "PM"

type Props = {
  date: Date
  tasks: PlannerTask[] // scheduled tasks only
  onDropSchedule: (taskId: string, startMin: number) => void
  placing?: boolean
  onTapPlace?: (startMin: number) => void
  mode?: ClockMode
  half?: Half
  // NEW: callbacks for edit interactions
  onMoveTask?: (taskId: string, startMin: number) => void
  onResizeTask?: (taskId: string, startMin: number, durationMin: number) => void
  onSelectTask?: (taskId: string) => void
  onSplitTask?: (taskId: string, splitAtMin: number) => void
  onRequestReset?: () => void
} & PropsWithChildren

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number) {
  const toXY = (r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  const sweep = endDeg > startDeg ? 1 : 0
  const [sx, sy] = toXY(rOuter, startDeg)
  const [ex, ey] = toXY(rOuter, endDeg)
  const [sx2, sy2] = toXY(rInner, endDeg)
  const [ex2, ey2] = toXY(rInner, startDeg)
  return [
    `M ${sx} ${sy}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} ${sweep} ${ex} ${ey}`,
    `L ${sx2} ${sy2}`,
    `A ${rInner} ${rInner} 0 ${largeArc} ${sweep ^ 1} ${ex2} ${ey2}`,
    "Z",
  ].join(" ")
}

function colorVar(c: PlannerTask["color"]) {
  switch (c) {
    case "blue":
      return "var(--task-blue)"
    case "teal":
      return "var(--task-teal)"
    case "orange":
      return "var(--task-orange)"
    case "cyan":
      return "var(--task-cyan)"
    case "pink":
      return "var(--task-pink)"
  }
}

function RadialClock({
  tasks,
  onDropSchedule,
  children,
  placing = false,
  onTapPlace,
  mode = "24h",
  half = "AM",
  onMoveTask,
  onResizeTask,
  onSelectTask,
  onSplitTask,
  onRequestReset,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const size = 360 // px
  const center = size / 2
  const outer = center * 0.92
  const inner = center * 0.6
  const bandInner = center * 0.68
  const bandOuter = center * 0.88

  const is12h = mode === "12h"
  const isAM = is12h && half === "AM"
  const hoursOnDial = is12h ? 12 : 24
  const halfOffset = is12h ? (half === "AM" ? 0 : 12 * 60) : 0

  function angleToMinutes12(angleDeg: number) {
    // map angle to 0..720
    const mins24 = angleToMinutes(angleDeg) // 0..1440
    return mins24 % (12 * 60)
  }
  function minutesToAngle12(mins: number) {
    // mins 0..720
    return (mins / (12 * 60)) * 360 - 90
  }

  function getClientPoint(e: React.PointerEvent | React.MouseEvent | React.DragEvent) {
    // supports pointer/mouse/drag events
    return { x: (e as any).clientX as number, y: (e as any).clientY as number }
  }

  const scheduleFromPoint = (clientX: number, clientY: number) => {
    const rect = (ref.current?.firstElementChild as HTMLElement)?.getBoundingClientRect()
    if (!rect) return null
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const x = clientX - cx
    const y = clientY - cy
    const angle = (Math.atan2(y, x) * 180) / Math.PI
    let startMin: number
    if (is12h) {
      const rel = snapTo(angleToMinutes12(angle), 5)
      startMin = clampMinutes(halfOffset + rel)
    } else {
      startMin = clampMinutes(snapTo(angleToMinutes(angle), 5))
    }
    return startMin
  }

  const onDragOver: React.DragEventHandler = (e) => {
    e.preventDefault() // allow drop
  }

  const onDrop: React.DragEventHandler = (e) => {
    e.preventDefault()
    const data = e.dataTransfer.getData("text/planner-task-id")
    if (!data) return
    const { x, y } = getClientPoint(e)
    const mins = scheduleFromPoint(x, y)
    if (mins == null) return
    onDropSchedule(data, mins)
  }

  const lastTapRef = useRef<{ id: string; t: number } | null>(null)
  const editingIdRef = useRef<string | null>(null)
  const dragRef = useRef<null | {
    type: "move" | "start" | "end"
    id: string
    initStart: number
    initDuration: number
    angleOffset?: number
  }>(null)

  const [ctxMenu, setCtxMenu] = useState<null | { x: number; y: number; id: string; splitAt: number }>(null)
  const holdTimerRef = useRef<number | null>(null)
  const splitTimerRef = useRef<number | null>(null)
  const movedRef = useRef(false)
  const downRef = useRef<{ t: number; x: number; y: number } | null>(null)
  const [editTick, setEditTick] = useState(0)

  const visibleStart = is12h ? halfOffset : 0
  const visibleEnd = is12h ? halfOffset + 12 * 60 : DAY_MINUTES

  const renderTasks = tasks.flatMap((t) => {
    const s0 = t.startMin || 0
    const e0 = s0 + t.durationMin
    const [s, e] = normalizeInterval(s0, e0)

    // Compute visible segments for this mode
    let segments: Array<{ startRel: number; endRel: number; fullyVisible: boolean }>
    if (is12h) {
      const ov = intervalOverlap([s, e], [visibleStart, visibleEnd])
      if (!ov) return [] // no overlap with this half → render nothing
      const fullyVisible = ov[0] === s && ov[1] === e
      segments = [{ startRel: ov[0] - visibleStart, endRel: ov[1] - visibleStart, fullyVisible }]
    } else {
      // 24h: render the full absolute segment (no clamping necessary here)
      segments = [{ startRel: s0, endRel: e0, fullyVisible: true }]
    }

    return segments.map((seg) => {
      // position for drawing
      const startDeg = is12h ? minutesToAngle12(seg.startRel) : minutesToAngle(seg.startRel)
      let endDeg = is12h ? minutesToAngle12(seg.endRel) : minutesToAngle(seg.endRel)
      if (endDeg <= startDeg) endDeg += 0.001

      // endpoint positions for handles
      const a1 = (startDeg * Math.PI) / 180
      const a2 = (endDeg * Math.PI) / 180
      const handleR = (bandInner + bandOuter) / 2
      const h1 = { x: center + handleR * Math.cos(a1), y: center + handleR * Math.sin(a1) }
      const h2 = { x: center + handleR * Math.cos(a2), y: center + handleR * Math.sin(a2) }

      return {
        id: t.id,
        color: t.color,
        start: s0,
        end: e0 % DAY_MINUTES,
        duration: t.durationMin,
        drawPath: arcPath(center, center, bandOuter, bandInner, startDeg, endDeg),
        handles: { h1, h2 },
        fullyVisible: seg.fullyVisible && (!is12h || (s >= visibleStart && e <= visibleEnd)),
      }
    })
  })

  const attachWindowDrag = () => {
    let rafId = 0
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const d = dragRef.current
        if (!d) return
        const mins = scheduleFromPoint(e.clientX, e.clientY)
        if (mins == null) return
        if (d.type === "move") {
          const newStart = clampMinutes(mins - (d.angleOffset || 0))
          onMoveTask?.(d.id, newStart)
        } else if (d.type === "start") {
          const end = clampMinutes(d.initStart + d.initDuration)
          let newStart = mins
          let newDur = clampMinutes(end - newStart)
          if (newDur <= 0) newDur += DAY_MINUTES
          newDur = Math.max(5, snapTo(newDur, 5))
          newStart = clampMinutes(end - newDur)
          onResizeTask?.(d.id, newStart, newDur)
        } else if (d.type === "end") {
          let newDur = clampMinutes(mins - d.initStart)
          if (newDur <= 0) newDur += DAY_MINUTES
          newDur = Math.max(5, snapTo(newDur, 5))
          onResizeTask?.(d.id, d.initStart, newDur)
        }
      })
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove as any)
      window.removeEventListener("pointerup", onUp as any)
      dragRef.current = null
    }
    window.addEventListener("pointermove", onMove as any, { passive: false })
    window.addEventListener("pointerup", onUp as any, { passive: true })
  }

  function normalizeInterval(s: number, e: number) {
    // unwrap across midnight
    if (e <= s) e += DAY_MINUTES
    return [s, e] as const
  }
  function intervalOverlap(a: readonly [number, number], b: readonly [number, number]) {
    const s = Math.max(a[0], b[0])
    const e = Math.min(a[1], b[1])
    return e > s ? ([s, e] as const) : null
  }
  function toVisibleSegments(seg: readonly [number, number]) {
    const [s, e] = seg
    const visS = visibleStart
    const visE = visibleEnd
    const out: Array<[number, number]> = []
    // cut to visible window
    const cut = intervalOverlap([s, e], [visS, visE])
    if (!cut) return out
    out.push([cut[0] - visS, cut[1] - visS])
    return out
  }

  const rippleSegments: Array<{ path: string }> = []
  for (let i = 0; i < tasks.length; i++) {
    const ti = tasks[i]
    const [aiS, aiE] = normalizeInterval(ti.startMin || 0, (ti.startMin || 0) + ti.durationMin)
    for (let j = i + 1; j < tasks.length; j++) {
      const tj = tasks[j]
      const [ajS, ajE] = normalizeInterval(tj.startMin || 0, (tj.startMin || 0) + tj.durationMin)
      const ov = intervalOverlap([aiS, aiE], [ajS, ajE])
      if (!ov) continue
      // project to visible window and draw a thinner red arc as ripple indicator
      for (const [segS, segE] of toVisibleSegments(ov)) {
        const sd = is12h ? minutesToAngle12(segS) : minutesToAngle(segS)
        const ed = is12h ? minutesToAngle12(segE) : minutesToAngle(segE)
        const p = arcPath(center, center, bandOuter, (bandInner + bandOuter) / 2, sd, ed)
        rippleSegments.push({ path: p })
      }
    }
  }

  function pointerAngleFromEvent(e: React.PointerEvent) {
    const rect = ref.current!.getBoundingClientRect()
    return (Math.atan2(e.clientY - (rect.top + size / 2), e.clientX - (rect.left + size / 2)) * 180) / Math.PI
  }

  const onTaskTap = (id: string) => {
    const now = Date.now()
    const last = lastTapRef.current
    if (last && last.id === id && now - last.t < 280) {
      // double tap -> toggle editing and SHOW HANDLES immediately
      editingIdRef.current = editingIdRef.current === id ? null : id
      lastTapRef.current = null
      setEditTick((n) => n + 1)
      return
    }
    lastTapRef.current = { id, t: now }
    onSelectTask?.(id) // single tap selects task for details
  }

  function startMove(id: string, tStart: number, tDur: number, e: React.PointerEvent) {
    if (splitTimerRef.current) {
      window.clearTimeout(splitTimerRef.current)
      splitTimerRef.current = null
    }
    movedRef.current = true
    const angle = pointerAngleFromEvent(e)
    const pointerMins = (is12h ? angleToMinutes12(angle) + visibleStart : angleToMinutes(angle)) % DAY_MINUTES
    const offset = clampMinutes(pointerMins - tStart)
    dragRef.current = { type: "move", id, initStart: tStart, initDuration: tDur, angleOffset: offset }
    attachWindowDrag()
  }

  const onPointerDown: React.PointerEventHandler = (e) => {
    if (!placing || !onTapPlace) return
    const { clientX, clientY } = e
    const mins = scheduleFromPoint(clientX, clientY)
    if (mins == null) return
    onTapPlace(mins)
  }

  useEffect(() => {
    const onGlobalPointerDown = (e: PointerEvent) => {
      const root = ref.current
      if (!root) return
      if (!root.contains(e.target as Node)) {
        if (ctxMenu) setCtxMenu(null)
        if (editingIdRef.current) {
          editingIdRef.current = null
          setEditTick((n) => n + 1)
        }
        onRequestReset?.()
      }
    }
    window.addEventListener("pointerdown", onGlobalPointerDown, { passive: true })
    return () => window.removeEventListener("pointerdown", onGlobalPointerDown)
  }, [ctxMenu, onRequestReset])

  return (
    <div
      ref={ref}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      className="relative"
      style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="day planner clock">
        <defs>
          <radialGradient id="dial-grad" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor={isAM ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.06)"} />
            <stop offset="65%" stopColor={isAM ? "rgba(245,245,245,0.9)" : "rgba(255,255,255,0.04)"} />
            <stop offset="100%" stopColor={isAM ? "rgba(230,230,230,0.85)" : "rgba(255,255,255,0.03)"} />
          </radialGradient>
          <filter id="red-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={center} cy={center} r={outer} fill="var(--card)" />
        <circle cx={center} cy={center} r={inner} fill="var(--secondary)" />

        {/* Major hour ticks */}
        <g className="text-foreground/80">
          {Array.from({ length: hoursOnDial }).map((_, i) => {
            const angle = (i / hoursOnDial) * 360 - 90
            const rad = (angle * Math.PI) / 180
            const x1 = center + (outer - 12) * Math.cos(rad)
            const y1 = center + (outer - 12) * Math.sin(rad)
            const x2 = center + outer * Math.cos(rad)
            const y2 = center + outer * Math.sin(rad)
            return <line key={`h-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={2.5} />
          })}
        </g>

        {/* Minor ticks */}
        <g className="text-foreground/50">
          {Array.from({ length: hoursOnDial * 4 }).map((_, i) => {
            const angle = (i / (hoursOnDial * 4)) * 360 - 90
            const rad = (angle * Math.PI) / 180
            const x1 = center + (outer - 8) * Math.cos(rad)
            const y1 = center + (outer - 8) * Math.sin(rad)
            const x2 = center + outer * Math.cos(rad)
            const y2 = center + outer * Math.sin(rad)
            return <line key={`m-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={1.5} />
          })}
        </g>

        {/* Labels every 3 hours - mono font + token color */}
        {Array.from({ length: hoursOnDial / 3 }).map((_, i) => {
          const hour = i * 3
          const angle = (hour / hoursOnDial) * 360 - 90
          const rad = (angle * Math.PI) / 180
          const r = inner + (outer - inner) / 2
          const x = center + (r + 4) * Math.cos(rad)
          const y = center + (r + 4) * Math.sin(rad)
          const label = is12h ? (hour === 0 ? "12" : String(hour).padStart(2, "0")) : String(hour).padStart(2, "0")
          return (
            <text
              key={`lbl-${i}`}
              x={x}
              y={y}
              className="text-foreground/70"
              fontSize="12"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: "var(--font-plex-mono, ui-monospace)" }}
              fill="currentColor"
            >
              {label}
            </text>
          )
        })}

        {renderTasks.map((t) => {
          const isEditing = editingIdRef.current === t.id && t.fullyVisible
          const fill = colorVar(t.color)
          return (
            <g
              key={t.id}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                movedRef.current = false
                downRef.current = { t: Date.now(), x: e.clientX, y: e.clientY }

                const task = tasks.find((x) => x.id === t.id)!
                if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
                holdTimerRef.current = window.setTimeout(() => {
                  startMove(t.id, task.startMin || 0, task.durationMin, e)
                }, 260)

                if (splitTimerRef.current) {
                  window.clearTimeout(splitTimerRef.current)
                  splitTimerRef.current = null
                }
              }}
              onPointerMove={(e) => {
                if (downRef.current) {
                  const dx = e.clientX - downRef.current.x
                  const dy = e.clientY - downRef.current.y
                  const dist = Math.hypot(dx, dy)
                  if (dist > 8 && !dragRef.current) {
                    movedRef.current = true
                    const task = tasks.find((x) => x.id === t.id)!
                    if (holdTimerRef.current) {
                      window.clearTimeout(holdTimerRef.current)
                      holdTimerRef.current = null
                    }
                    if (splitTimerRef.current) {
                      window.clearTimeout(splitTimerRef.current)
                      splitTimerRef.current = null
                    }
                    startMove(t.id, task.startMin || 0, task.durationMin, e)
                  }
                }
              }}
              onPointerUp={(e) => {
                if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
                holdTimerRef.current = null
                if (splitTimerRef.current) window.clearTimeout(splitTimerRef.current)
                splitTimerRef.current = null

                const down = downRef.current
                downRef.current = null

                if (!movedRef.current && !dragRef.current && down && Date.now() - down.t >= 650) {
                  const angle = pointerAngleFromEvent(e as any)
                  const splitAt = (is12h ? angleToMinutes12(angle) + visibleStart : angleToMinutes(angle)) % DAY_MINUTES
                  setCtxMenu({ x: e.clientX, y: e.clientY, id: t.id, splitAt })
                  return
                }

                if (!movedRef.current && !dragRef.current) {
                  onTaskTap(t.id)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                const angle = pointerAngleFromEvent(e as any)
                const splitAt = (is12h ? angleToMinutes12(angle) + visibleStart : angleToMinutes(angle)) % DAY_MINUTES
                setCtxMenu({ x: (e as any).clientX, y: (e as any).clientY, id: t.id, splitAt })
              }}
            >
              <path
                d={t.drawPath}
                fill={fill}
                fillOpacity={0.18}
                stroke="var(--foreground)"
                strokeOpacity={0.85}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {isEditing && (
                <>
                  <rect
                    x={t.handles.h1.x - 6}
                    y={t.handles.h1.y - 6}
                    width={12}
                    height={12}
                    rx={3}
                    fill="var(--foreground)"
                    fillOpacity={0.96}
                    stroke="var(--background)"
                    strokeOpacity={0.12}
                    strokeWidth={1}
                    transform={`rotate(45 ${t.handles.h1.x} ${t.handles.h1.y})`}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      dragRef.current = { type: "start", id: t.id, initStart: t.start, initDuration: t.duration }
                      ;(e.currentTarget as any).setPointerCapture(e.pointerId)
                      attachWindowDrag()
                    }}
                  />
                  <rect
                    x={t.handles.h2.x - 6}
                    y={t.handles.h2.y - 6}
                    width={12}
                    height={12}
                    rx={3}
                    fill="var(--foreground)"
                    fillOpacity={0.96}
                    stroke="var(--background)"
                    strokeOpacity={0.12}
                    strokeWidth={1}
                    transform={`rotate(45 ${t.handles.h2.x} ${t.handles.h2.y})`}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      dragRef.current = { type: "end", id: t.id, initStart: t.start, initDuration: t.duration }
                      ;(e.currentTarget as any).setPointerCapture(e.pointerId)
                      attachWindowDrag()
                    }}
                  />
                </>
              )}
            </g>
          )
        })}

        {/* Ripple overlap indicator → primary accent for Orbit theme */}
        {rippleSegments.map((s, idx) => (
          <path
            key={`rip-${idx}`}
            d={s.path}
            fill="none"
            stroke="var(--primary)"
            strokeOpacity={0.9}
            strokeWidth={6}
            filter="url(#red-glow)"
          />
        ))}

        {/* Placement ring uses token color */}
        {placing && (
          <circle
            cx={center}
            cy={center}
            r={(bandInner + bandOuter) / 2}
            fill="none"
            className="text-foreground/35"
            stroke="currentColor"
            strokeDasharray="4 6"
            strokeWidth={3}
          />
        )}
      </svg>

      {ctxMenu && (
        <div
          className="absolute z-10 rounded-xl bg-popover text-popover-foreground shadow-md border border-border"
          style={{
            left: ctxMenu.x - (ref.current?.getBoundingClientRect().left || 0),
            top: ctxMenu.y - (ref.current?.getBoundingClientRect().top || 0),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="px-3 py-2 text-xs hover:bg-accent rounded-xl"
            onClick={() => {
              onSplitTask?.(ctxMenu.id, ctxMenu.splitAt)
              setCtxMenu(null)
            }}
          >
            Split here
          </button>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          style={{
            width: inner * 2 - 24,
            height: inner * 2 - 24,
            borderRadius: 9999,
            overflow: "hidden",
            padding: 8,
          }}
          className="flex items-center justify-center text-[10px] sm:text-xs leading-4 text-foreground/90 text-center break-words whitespace-normal"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export { RadialClock }
export default RadialClock
