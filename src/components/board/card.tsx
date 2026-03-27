"use client";

import { useState, useEffect } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Bot, Calendar, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, getInitials } from "@/lib/utils";
import { PriorityBadge } from "@/components/card/priority-badge";
import type { CardWithDetails } from "@/types";

export function KanbanCard({
  card,
  index,
  onClick,
}: {
  card: CardWithDetails;
  index: number;
  onClick: () => void;
}) {
  const totalItems = card.checklists.reduce(
    (sum, cl) => sum + cl.items.length,
    0
  );
  const completedItems = card.checklists.reduce(
    (sum, cl) => sum + cl.items.filter((item) => item.completed).length,
    0
  );
  const hasAgent = card.members?.some((m) => m.user.isAgent);
  const [isAgentWorking, setIsAgentWorking] = useState(false);
  const [recentlyWorked, setRecentlyWorked] = useState(false);

  // Check if any agent is actively working on this card (QUEUED or RUNNING)
  useEffect(() => {
    if (!hasAgent) return;
    let cancelled = false;
    async function check() {
      try {
        // Check for active runs (QUEUED or RUNNING)
        const res = await fetch(`/api/agents/runs?cardId=${card.id}&limit=3`);
        const runs = await res.json();
        if (cancelled) return;

        const active = Array.isArray(runs) && runs.some(
          (r: { status: string }) => r.status === "RUNNING" || r.status === "QUEUED"
        );
        setIsAgentWorking(active);

        // Also check if recently completed (within last 2 minutes)
        if (!active && Array.isArray(runs) && runs.length > 0) {
          const latest = runs[0];
          if (latest.status === "COMPLETED" && latest.completedAt) {
            const completedAgo = Date.now() - new Date(latest.completedAt).getTime();
            setRecentlyWorked(completedAgo < 120000); // 2 minutes
          }
        }
      } catch { /* ignore */ }
    }
    check();
    const interval = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [card.id, hasAgent]);

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`relative cursor-pointer rounded-lg bg-white p-3 shadow-sm transition-all hover:shadow-md ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
          } ${isAgentWorking ? "ring-2 ring-green-400/60 shadow-[0_0_20px_rgba(74,222,128,0.3)]" : ""} ${recentlyWorked && !isAgentWorking ? "ring-1 ring-green-300/40" : ""}`}
          style={{
            ...provided.draggableProps.style,
            ...(isAgentWorking ? { animation: "agent-glow 2s ease-in-out infinite" } : {}),
          }}
        >
          {/* Agent working pulse indicator */}
          {/* Active: bright green glow + ping */}
          {isAgentWorking && (
            <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center z-10">
              <span className="absolute h-5 w-5 rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative h-4 w-4 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                <Bot className="h-2.5 w-2.5 text-white" />
              </span>
            </div>
          )}
          {/* Recently worked: subtle green dot */}
          {recentlyWorked && !isAgentWorking && (
            <div className="absolute -top-1 -right-1 z-10">
              <span className="h-3 w-3 rounded-full bg-green-400 flex items-center justify-center">
                <Bot className="h-2 w-2 text-white" />
              </span>
            </div>
          )}
          {(card.labels.length > 0 || card.priority !== undefined) && (
            <div className="mb-2 flex flex-wrap gap-1">
              <PriorityBadge priority={card.priority ?? 2} />
              {card.labels.slice(0, 3).map(({ label }) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{
                    backgroundColor: `${label.color}15`,
                    color: label.color,
                    borderColor: `${label.color}30`,
                  }}
                >
                  {label.name}
                </Badge>
              ))}
              {card.labels.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  +{card.labels.length - 3}
                </Badge>
              )}
            </div>
          )}

          <p className="text-sm font-medium text-neutral-900">{card.title}</p>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {card.dueDate && (
                <div className="flex items-center gap-1 text-xs text-secondary">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(card.dueDate)}</span>
                </div>
              )}
              {totalItems > 0 && (
                <div className="flex items-center gap-1 text-xs text-secondary">
                  <CheckSquare className="h-3 w-3" />
                  <span>
                    {completedItems}/{totalItems}
                  </span>
                </div>
              )}
              {hasAgent && (
                <div className="flex items-center gap-1 text-xs text-blue-500">
                  <Bot className="h-3.5 w-3.5" />
                  <span>AI</span>
                </div>
              )}
            </div>

            {card.members.length > 0 && (
              <div className="flex -space-x-1.5">
                {card.members.slice(0, 3).map(({ user }) => (
                  <Avatar key={user.id} className="h-6 w-6 border-2 border-white">
                    <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
