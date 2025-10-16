"use client"

import { useEffect, useRef } from "react"

type Dir = "left" | "right"

export function useZenGesture(
  onToggle: () => void,
  opts?: {
    velocityThreshold?: number // px per ms
    minDx?: number // px
    windowMs?: number // total window for sequence
    bidirectional?: boolean // allow RLRL too
  },
) {
  const velocityThreshold = opts?.velocityThreshold ?? 0.55
  const minDx = opts?.minDx ?? 32
  const windowMs = opts?.windowMs ?? 1400
  const acceptBoth = opts?.bidirectional ?? true

  const seqRef = useRef<Dir[]>([])
  const startRef = useRef<number | null>(null)
  const lastRef = useRef<{ x: number; t: number } | null>(null)

  function reset(now?: number) {
    seqRef.current = []
    startRef.current = now ?? null
    lastRef.current = null
  }

  function pushDir(dir: Dir, now: number) {
    if (!startRef.current) startRef.current = now
    const seq = seqRef.current
    if (seq[seq.length - 1] === dir) return // ignore duplicates
    seq.push(dir)
    if (seq.length > 4) seq.shift()
    const elapsed = now - (startRef.current ?? now)
    if (elapsed > windowMs) {
      reset(now)
      return
    }
    const s = seq.join(",")
    const ok = s === "left,right,left,right" || (acceptBoth && s === "right,left,right,left")
    if (ok) {
      onToggle()
      reset(now)
    }
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now()
      const last = lastRef.current
      const x = e.clientX
      if (!last) {
        lastRef.current = { x, t: now }
        return
      }
      const dx = x - last.x
      const dt = now - last.t
      if (Math.abs(dx) >= minDx && dt > 0) {
        const v = Math.abs(dx) / dt
        if (v >= velocityThreshold) {
          pushDir(dx > 0 ? "right" : "left", now)
        }
        lastRef.current = { x, t: now }
      } else if (dt > windowMs) {
        reset(now)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const now = performance.now()
      const x = e.touches[0].clientX
      const last = lastRef.current
      if (!last) {
        lastRef.current = { x, t: now }
        return
      }
      const dx = x - last.x
      const dt = now - last.t
      if (Math.abs(dx) >= minDx && dt > 0) {
        const v = Math.abs(dx) / dt
        if (v >= velocityThreshold) {
          pushDir(dx > 0 ? "right" : "left", now)
        }
        lastRef.current = { x, t: now }
      } else if (dt > windowMs) {
        reset(now)
      }
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("touchmove", onTouchMove)
    }
  }, [velocityThreshold, minDx, windowMs, acceptBoth, onToggle])
}
