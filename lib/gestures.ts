"use client"

import { useEffect, useRef } from "react"

type DragOpts = {
  onStart?: (e: PointerEvent) => void
  onMove?: (e: PointerEvent) => void
  onEnd?: (e: PointerEvent) => void
  longPressMs?: number
  passive?: boolean
}

/**
 * usePressDrag: adds stable pointer handlers with capture + touch-action none.
 * Returns bind props to spread on interactive element.
 */
export function usePressDrag<T extends HTMLElement | SVGElement>(opts: DragOpts) {
  const ref = useRef<T | null>(null)
  const state = useRef<{ dragging: boolean; longTimer?: number | null }>({ dragging: false, longTimer: null })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let pointerId: number | null = null
    let raf = 0

    const onPointerDown = (e: PointerEvent) => {
      // prevent scroll/refresh
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      pointerId = e.pointerId
      state.current.dragging = false
      const start = () => {
        state.current.dragging = true
        opts.onStart?.(e)
      }
      const delay = opts.longPressMs ?? 120
      state.current.longTimer = window.setTimeout(start, delay)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return
      if (!state.current.dragging) return
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => opts.onMove?.(e))
    }

    const endLike = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return
      if (state.current.longTimer) {
        clearTimeout(state.current.longTimer)
        state.current.longTimer = null
      }
      if (state.current.dragging) opts.onEnd?.(e)
      state.current.dragging = false
      pointerId = null
      try {
        ;(e.target as Element).releasePointerCapture(e.pointerId)
      } catch {}
    }

    el.addEventListener("pointerdown", onPointerDown, { passive: false })
    el.addEventListener("pointermove", onPointerMove, { passive: false })
    el.addEventListener("pointerup", endLike, { passive: false })
    el.addEventListener("pointercancel", endLike, { passive: false })
    el.addEventListener("lostpointercapture", endLike as any, { passive: false })
    ;(el as any).style.touchAction = "none"
    ;(el as any).style.WebkitUserSelect = "none"
    ;(el as any).style.userSelect = "none"

    return () => {
      el.removeEventListener("pointerdown", onPointerDown as any)
      el.removeEventListener("pointermove", onPointerMove as any)
      el.removeEventListener("pointerup", endLike as any)
      el.removeEventListener("pointercancel", endLike as any)
      el.removeEventListener("lostpointercapture", endLike as any)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [opts.onStart, opts.onMove, opts.onEnd, opts.longPressMs])

  return { ref }
}

export function useDoubleTap<T extends HTMLElement | SVGElement>(
  onDouble: (e: PointerEvent) => void,
  maxDelay = 260,
  maxDist = 18,
) {
  const ref = useRef<T | null>(null)
  const last = useRef<{ t: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onPointerDown = (e: PointerEvent) => {
      const now = Date.now()
      const p = { t: now, x: e.clientX, y: e.clientY }
      if (last.current) {
        const dt = now - last.current.t
        const dx = p.x - last.current.x
        const dy = p.y - last.current.y
        const dist = Math.hypot(dx, dy)
        if (dt < maxDelay && dist < maxDist) {
          onDouble(e)
          last.current = null
          return
        }
      }
      last.current = p
    }
    el.addEventListener("pointerdown", onPointerDown as any, { passive: true })
    return () => el.removeEventListener("pointerdown", onPointerDown as any)
  }, [onDouble, maxDelay, maxDist])

  return { ref }
}
