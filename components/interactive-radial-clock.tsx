"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import RadialClock from "./radial-clock" // assuming default export; if named, adjust import accordingly
import { ClockWedge, type WedgeTask } from "./clock-wedge"
import { FULL_DAY_MIN, HALF_DAY_MIN } from "@/lib/geometry"

type ScheduledTask = {
  id: string
  title: string
  color: string
  startMin: number
  endMin: number
}

type Props = {
  tasks: ScheduledTask[]
  mode: "12h" | "24h"
  half?: "am" | "pm"
  onResizeTask: (id: string, newStart: number, newEnd: number) => void
  onMoveTask: (id: string, newStart: number, newEnd: number) => void
  // pass-through props for the visual clock
  date?: Date
  categoryTotals?: Record<string, number>
}

export default function InteractiveRadialClock({
  tasks,
  mode,
  half = "am",
  onResizeTask,
  onMoveTask,
  ...passThrough
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect
        setBox({ w: cr.width, h: cr.height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const totalMinutes = mode === "24h" ? FULL_DAY_MIN : HALF_DAY_MIN
  const cx = box.w / 2
  const cy = box.h / 2
  const R = Math.min(box.w, box.h) / 2
  // match visual dial thickness; inner ~68% of outer feels right per screenshots
  const rOuter = R * 0.88
  const rInner = rOuter * 0.68

  const filtered = useMemo(() => {
    if (mode === "24h") return tasks
    const lo = half === "am" ? 0 : HALF_DAY_MIN
    const hi = half === "am" ? HALF_DAY_MIN : FULL_DAY_MIN
    return tasks.filter((t) => (t.startMin >= lo && t.startMin < hi) || (t.endMin > lo && t.endMin <= hi))
  }, [tasks, mode, half])

  return (
    <div ref={containerRef} className="relative">
      {/* Visual clock (non-interactive) */}
      <RadialClock {...(passThrough as any)} mode={mode} half={half} />
      {/* Interaction overlay */}
      <svg
        className="absolute inset-0"
        width="100%"
        height="100%"
        viewBox={`0 0 ${box.w || 1} ${box.h || 1}`}
        style={{ pointerEvents: "none", touchAction: "none" }}
      >
        {filtered.map((t) => (
          <ClockWedge
            key={t.id}
            task={t as WedgeTask}
            cx={cx}
            cy={cy}
            rInner={rInner}
            rOuter={rOuter}
            totalMinutes={mode === "24h" ? FULL_DAY_MIN : HALF_DAY_MIN}
            half={mode === "12h" ? half : undefined}
            onResize={onResizeTask}
            onMove={onMoveTask}
          />
        ))}
      </svg>
    </div>
  )
}
