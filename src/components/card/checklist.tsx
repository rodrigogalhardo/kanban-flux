"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ChecklistWithItems } from "@/types";

export function ChecklistSection({
  checklists,
  onUpdate,
}: {
  checklists: ChecklistWithItems[];
  onUpdate: () => void;
}) {
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});

  async function toggleItem(checklistId: string, itemId: string, completed: boolean) {
    await fetch(`/api/checklists/${checklistId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !completed }),
    });
    onUpdate();
  }

  async function addItem(checklistId: string) {
    const text = newItemText[checklistId]?.trim();
    if (!text) return;
    await fetch(`/api/checklists/${checklistId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setNewItemText((prev) => ({ ...prev, [checklistId]: "" }));
    onUpdate();
  }

  async function deleteChecklist(checklistId: string) {
    await fetch(`/api/checklists/${checklistId}`, { method: "DELETE" });
    onUpdate();
  }

  return (
    <div className="space-y-4">
      {checklists.map((checklist) => {
        const completed = checklist.items.filter((i) => i.completed).length;
        const total = checklist.items.length;
        const progress = total > 0 ? (completed / total) * 100 : 0;

        return (
          <div key={checklist.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-neutral-900">
                {checklist.title}
              </h4>
              <button
                onClick={() => deleteChecklist(checklist.id)}
                className="text-secondary hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {total > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary">
                  {completed}/{total}
                </span>
                <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full bg-success transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              {checklist.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded px-1 py-1 hover:bg-surface"
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() =>
                      toggleItem(checklist.id, item.id, item.completed)
                    }
                  />
                  <span
                    className={`text-sm ${
                      item.completed
                        ? "text-secondary line-through"
                        : "text-neutral-900"
                    }`}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add an item..."
                value={newItemText[checklist.id] || ""}
                onChange={(e) =>
                  setNewItemText((prev) => ({
                    ...prev,
                    [checklist.id]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItem(checklist.id);
                }}
                className="text-sm h-8"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => addItem(checklist.id)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
