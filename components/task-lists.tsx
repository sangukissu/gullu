"use client"

import type { PlannerTask } from "./types"
import { Button } from "@/components/ui/button"
import { Trash2Icon, Undo2Icon, CheckCircle2Icon } from "lucide-react"
import { fmtTime24, fmtTime12 } from "@/lib/time"
import { cn } from "@/lib/utils"

export function TaskLists({
  scheduled,
  unplaced,
  onUnschedule,
  onDelete,
  onRequestPlace,
  timeMode = "24h",
}: {
  scheduled: PlannerTask[]
  unplaced: PlannerTask[]
  onUnschedule: (id: string) => void
  onDelete: (id: string) => void
  onRequestPlace: (id: string) => void
  timeMode?: "24h" | "12h"
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted-foreground tracking-wider mb-2">SCHEDULED</div>
        <div className="space-y-3">
          {scheduled.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No tasks scheduled yet. Drag from Unplaced onto the clock.
            </div>
          )}
          {scheduled.map((t) => (
            <div key={t.id} className="rounded-2xl bg-secondary px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `var(--task-${t.color})` }}
                >
                  <span className="text-base" aria-hidden>
                    {t.icon}
                  </span>
                </div>
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {timeMode === "24h"
                      ? `${fmtTime24(t.startMin || 0)}–${fmtTime24(((t.startMin || 0) + t.durationMin) % (24 * 60))}`
                      : `${fmtTime12(t.startMin || 0)}–${fmtTime12(((t.startMin || 0) + t.durationMin) % (24 * 60))}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{t.durationMin}m</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onUnschedule(t.id)}
                  title="Unplace"
                >
                  <Undo2Icon className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(t.id)} title="Delete">
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground tracking-wider mb-2">UNPLACED</div>
        <div className="space-y-3">
          {unplaced.map((t) => (
            <div
              key={t.id}
              className={cn(
                "rounded-2xl bg-secondary px-4 py-3 flex items-center justify-between gap-3",
                "cursor-grab active:cursor-grabbing",
              )}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/planner-task-id", t.id)
                e.dataTransfer.effectAllowed = "copyMove"
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `var(--task-${t.color})` }}
                >
                  <span className="text-base" aria-hidden>
                    {t.icon}
                  </span>
                </div>
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.durationMin}m • {t.category}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onRequestPlace(t.id)}
                  title="Place on clock"
                >
                  <CheckCircle2Icon className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(t.id)} title="Delete">
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {unplaced.length === 0 && (
            <div className="text-sm text-muted-foreground">No unplaced tasks. Create a new task to get started.</div>
          )}
        </div>
      </div>
    </div>
  )
}
