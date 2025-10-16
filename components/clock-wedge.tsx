"use client"
import { useMemo, useState } from "react"
import {
  angleToMinutes,
  clampToHalf,
  HALF_DAY_MIN,
  minutesToAngle,
  pointAngle,
  ringPath,
  snap,
  FULL_DAY_MIN,
  mod,
} from "@/lib/geometry"
import { usePressDrag, useDoubleTap } from "@/lib/gestures"

export type WedgeTask = {
  id: string
  title: string
  color: string
  startMin: number // absolute minutes [0, 1440)
  endMin: number // absolute minutes [0, 1440)
}

type Props = {
  task: WedgeTask
  cx: number
  cy: number
  rInner: number
  rOuter: number
  totalMinutes: number // 1440 for 24h, 720 for 12h
  half?: "am" | "pm" // when totalMinutes===720 we constrain to selected half
  snapStep?: number
  onResize?: (id: string, newStart: number, newEnd: number) => void
  onMove?: (id: string, newStart: number, newEnd: number) => void
}

export function ClockWedge({
  task,
  cx,
  cy,
  rInner,
  rOuter,
  totalMinutes,
  half,
  snapStep = 5,
  onResize,
  onMove,
}: Props) {
  const [editing, setEditing] = useState(false)
  const bounds =
    totalMinutes === FULL_DAY_MIN
      ? ([0, FULL_DAY_MIN] as const)
      : half === "am"
        ? ([0, HALF_DAY_MIN] as const)
        : ([HALF_DAY_MIN, FULL_DAY_MIN] as const)

  const duration = useMemo(() => {
    const s = task.startMin,
      e = task.endMin
    return mod(e - s, FULL_DAY_MIN)
  }, [task.startMin, task.endMin])

  const displayStart = useMemo(() => {
    if (totalMinutes === FULL_DAY_MIN) return task.startMin
    // map into half window
    const [lo, hi] = bounds
    if (task.startMin < lo) return lo
    if (task.startMin >= hi) return hi - 1
    return task.startMin
  }, [task.startMin, totalMinutes, bounds])

  const displayEnd = useMemo(() => mod(displayStart + duration, FULL_DAY_MIN), [displayStart, duration])

  const pathD = useMemo(
    () => ringPath(cx, cy, rInner, rOuter, displayStart, displayEnd, totalMinutes),
    [cx, cy, rInner, rOuter, displayStart, displayEnd, totalMinutes],
  )

  // Move entire wedge: long-press any part of wedge
  const moveRef = usePressDrag<SVGPathElement>({
    longPressMs: 120,
    onStart: () => {},
    onMove: (e) => {
      const ang = pointAngle(cx, cy, e.clientX, e.clientY)
      let m = snap(angleToMinutes(ang, totalMinutes), snapStep)
      if (totalMinutes === HALF_DAY_MIN) m = clampToHalf(m + bounds[0], half!)
      // maintain duration
      let s = m
      let en = mod(s + duration, FULL_DAY_MIN)
      if (totalMinutes === HALF_DAY_MIN) {
        // clamp within half window
        const [lo, hi] = bounds
        if (en > hi) {
          s = hi - duration
          en = hi
        }
        if (s < lo) {
          s = lo
          en = lo + duration
        }
      }
      onMove?.(task.id, s, en)
    },
    onEnd: () => {},
  })

  // Handles
  const startHandle = usePressDrag<SVGCircleElement>({
    onStart: () => setEditing(true),
    onMove: (e) => {
      const ang = pointAngle(cx, cy, e.clientX, e.clientY)
      let m = snap(angleToMinutes(ang, totalMinutes), snapStep)
      if (totalMinutes === HALF_DAY_MIN) m = clampToHalf(m + bounds[0], half!)
      let s = m
      let en = mod(task.endMin, FULL_DAY_MIN)
      // prevent zero/negative durations
      if (mod(en - s, FULL_DAY_MIN) < snapStep) en = mod(s + snapStep, FULL_DAY_MIN)
      if (totalMinutes === HALF_DAY_MIN) {
        const [lo, hi] = bounds
        if (s < lo) s = lo
        if (en > hi) en = hi
      }
      onResize?.(task.id, s, en)
    },
    onEnd: () => {},
  })

  const endHandle = usePressDrag<SVGCircleElement>({
    onStart: () => setEditing(true),
    onMove: (e) => {
      const ang = pointAngle(cx, cy, e.clientX, e.clientY)
      let m = snap(angleToMinutes(ang, totalMinutes), snapStep)
      if (totalMinutes === HALF_DAY_MIN) m = clampToHalf(m + bounds[0], half!)
      let s = mod(task.startMin, FULL_DAY_MIN)
      let en = m
      if (mod(en - s, FULL_DAY_MIN) < snapStep) en = mod(s + snapStep, FULL_DAY_MIN)
      if (totalMinutes === HALF_DAY_MIN) {
        const [lo, hi] = bounds
        if (s < lo) s = lo
        if (en > hi) en = hi
      }
      onResize?.(task.id, s, en)
    },
    onEnd: () => {},
  })

  // Double tap to toggle edit
  const dbl = useDoubleTap<SVGPathElement>(() => setEditing((v) => !v))

  // Handle positions
  const aS = minutesToAngle(displayStart, totalMinutes)
  const aE = minutesToAngle(displayEnd, totalMinutes)
  const hx = (a: number) => cx + ((rInner + rOuter) / 2) * Math.cos(a)
  const hy = (a: number) => cy + ((rInner + rOuter) / 2) * Math.sin(a)

  return (
    <>
      <path
        ref={(el) => {
          moveRef.ref.current = el
          dbl.ref.current = el
        }}
        d={pathD}
        fill={task.color}
        fillOpacity={0.64}
        stroke={task.color}
        strokeWidth={2}
        style={{ pointerEvents: "auto", touchAction: "none", cursor: "grab" }}
      />
      {editing && (
        <>
          <circle
            ref={startHandle.ref}
            cx={hx(aS)}
            cy={hy(aS)}
            r={12}
            fill="#fff"
            stroke="#000"
            strokeWidth={2}
            style={{ pointerEvents: "auto", touchAction: "none", cursor: "ew-resize" }}
          />
          <circle
            ref={endHandle.ref}
            cx={hx(aE)}
            cy={hy(aE)}
            r={12}
            fill="#fff"
            stroke="#000"
            strokeWidth={2}
            style={{ pointerEvents: "auto", touchAction: "none", cursor: "ew-resize" }}
          />
        </>
      )}
    </>
  )
}
