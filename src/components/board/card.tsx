"use client";

import { Draggable } from "@hello-pangea/dnd";
import { Bot, Calendar, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, getInitials } from "@/lib/utils";
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

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`cursor-pointer rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
          }`}
        >
          {card.labels.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
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
