"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { Category, PlannerTask } from "./types"
import { cn } from "@/lib/utils"

const ICONS = ["💼", "📝", "☕️", "💻", "🎯", "📚", "🔬", "🧠", "🛠️"] as const
const DURATIONS = [15, 30, 45, 60, 90] as const
const CATS: Category[] = ["Focus", "Admin", "Creative", "Break"]
const COLORS = ["blue", "teal", "orange", "cyan", "pink"] as const

export function TaskForm({ onCreate }: { onCreate: (task: PlannerTask) => void }) {
  const [title, setTitle] = useState("")
  const [icon, setIcon] = useState<string>(ICONS[1])
  const [duration, setDuration] = useState<number>(30)
  const [category, setCategory] = useState<Category>("Focus")
  const [color, setColor] = useState<"blue" | "teal" | "orange" | "cyan" | "pink">("blue")

  const canCreate = title.trim().length > 0

  const handleCreate = () => {
    if (!canCreate) return
    const task: PlannerTask = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      icon,
      durationMin: duration,
      category,
      color,
      startMin: null,
    }
    onCreate(task)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Task title</label>
        <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Icon</div>
        <div className="grid grid-cols-9 gap-2">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={cn(
                "h-10 rounded-md bg-secondary flex items-center justify-center",
                icon === i && "ring-2 ring-primary",
              )}
            >
              <span className="text-lg">{i}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Duration</div>
        <div className="flex gap-2 flex-wrap">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={cn(
                "px-3 h-9 rounded-lg bg-secondary text-sm",
                duration === d && "bg-primary text-primary-foreground",
              )}
            >
              {d}m
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Category</div>
        <div className="flex gap-2 flex-wrap">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 h-9 rounded-lg bg-secondary text-sm",
                category === c && "bg-primary text-primary-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Color</div>
        <div className="flex gap-3">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="relative h-9 w-9 rounded-full flex items-center justify-center"
            >
              <span
                className={cn(
                  "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background",
                  color === c ? "ring-primary" : "ring-transparent",
                )}
                style={{ backgroundColor: `var(--task-${c})` }}
              />
            </button>
          ))}
        </div>
      </div>

      <Button className="w-full h-11 rounded-xl" disabled={!canCreate} onClick={handleCreate}>
        Create
      </Button>
    </div>
  )
}
