export const FULL_DAY_MIN = 1440
export const HALF_DAY_MIN = 720

export function mod(n: number, m: number) {
  return ((n % m) + m) % m
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function snap(n: number, step = 5) {
  return Math.round(n / step) * step
}

// minutes -> angle in radians; zero at top (-90deg), clockwise positive
export function minutesToAngle(min: number, total = FULL_DAY_MIN) {
  return (min / total) * Math.PI * 2 - Math.PI / 2
}

export function angleToMinutes(angle: number, total = FULL_DAY_MIN) {
  const a = mod(angle + Math.PI / 2, Math.PI * 2) // normalize with top=0
  return (a / (Math.PI * 2)) * total
}

export function pointAngle(cx: number, cy: number, x: number, y: number) {
  return Math.atan2(y - cy, x - cx)
}

export function ringPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startMin: number,
  endMin: number,
  total = FULL_DAY_MIN,
) {
  const a0 = minutesToAngle(startMin, total)
  const a1 = minutesToAngle(endMin, total)
  return ringPathAngles(cx, cy, rInner, rOuter, a0, a1)
}

export function ringPathAngles(cx: number, cy: number, rInner: number, rOuter: number, a0: number, a1: number) {
  const largeArc = Math.abs(mod(a1 - a0, Math.PI * 2)) > Math.PI ? 1 : 0
  const sweep = 1 // clockwise
  const [x0o, y0o] = [cx + rOuter * Math.cos(a0), cy + rOuter * Math.sin(a0)]
  const [x1o, y1o] = [cx + rOuter * Math.cos(a1), cy + rOuter * Math.sin(a1)]
  const [x1i, y1i] = [cx + rInner * Math.cos(a1), cy + rInner * Math.sin(a1)]
  const [x0i, y0i] = [cx + rInner * Math.cos(a0), cy + rInner * Math.sin(a0)]
  return [
    `M ${x0o} ${y0o}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} ${sweep} ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${rInner} ${rInner} 0 ${largeArc} ${sweep ^ 1} ${x0i} ${y0i}`,
    "Z",
  ].join(" ")
}

export function withinHalf(min: number, half: "am" | "pm") {
  if (half === "am") return mod(min, FULL_DAY_MIN) < HALF_DAY_MIN
  return mod(min, FULL_DAY_MIN) >= HALF_DAY_MIN
}

export function clampToHalf(min: number, half: "am" | "pm") {
  return half === "am" ? clamp(min, 0, HALF_DAY_MIN) : clamp(min, HALF_DAY_MIN, FULL_DAY_MIN)
}
