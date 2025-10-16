export type Category = "Focus" | "Admin" | "Creative" | "Break"

export type PlannerTask = {
  id: string
  title: string
  icon: string // emoji or short glyph
  durationMin: number
  category: Category
  color: "blue" | "teal" | "orange" | "cyan" | "pink"
  startMin: number | null // minutes from 00:00, null = unplaced
}
