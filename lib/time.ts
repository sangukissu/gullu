// Utility helpers for 24h radial conversions

export const DAY_MINUTES = 24 * 60

export function minutesToAngle(mins: number) {
  // 0 minutes => -90deg (pointing up), clockwise positive
  return (mins / DAY_MINUTES) * 360 - 90
}

export function angleToMinutes(angleDeg: number) {
  // angleDeg is screen space angle (atan2 in degrees), where 0deg is +X axis
  // We want -90deg (top) to be 0 minutes.
  const norm = (angleDeg + 90 + 360) % 360
  return (norm / 360) * DAY_MINUTES
}

export function clampMinutes(mins: number) {
  let m = Math.round(mins)
  while (m < 0) m += DAY_MINUTES
  while (m >= DAY_MINUTES) m -= DAY_MINUTES
  return m
}

export function snapTo(mins: number, step = 5) {
  return Math.round(mins / step) * step
}

export function endMinute(startMin: number, durationMin: number) {
  return (startMin + durationMin) % DAY_MINUTES
}

export function fmtTime24(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  const hh = String(h).padStart(2, "0")
  const mm = String(min).padStart(2, "0")
  return `${hh}:${mm}`
}

// Utility helpers for 12h conversions
export function fmtTime12(m: number) {
  const total = ((m % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const h = Math.floor(total / 60)
  const min = total % 60
  const am = h < 12
  const displayH = h % 12 === 0 ? 12 : h % 12
  const mm = String(min).padStart(2, "0")
  return `${displayH}:${mm} ${am ? "AM" : "PM"}`
}
