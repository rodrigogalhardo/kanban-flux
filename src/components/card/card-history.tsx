"use client";
import { useState, useEffect } from "react";
import { Clock, MoveRight, Edit, UserPlus, Paperclip, AlertTriangle, Plus } from "lucide-react";

interface HistoryEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

const actionIcons: Record<string, typeof Clock> = {
  created: Plus,
  moved: MoveRight,
  updated_description: Edit,
  updated_title: Edit,
  priority_changed: AlertTriangle,
  agent_assigned: UserPlus,
  attachment_added: Paperclip,
};

export function CardHistory({ cardId }: { cardId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!show) return;
    fetch(`/api/cards/${cardId}/history`)
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {});
  }, [cardId, show]);

  return (
    <div className="mt-4">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-neutral-900"
      >
        <Clock className="h-3.5 w-3.5" />
        {show ? "Hide History" : "Show History"}
      </button>

      {show && (
        <div className="mt-2 space-y-1.5 max-h-[200px] overflow-y-auto">
          {history.length === 0 && <p className="text-xs text-secondary">No history recorded</p>}
          {history.map((entry) => {
            const Icon = actionIcons[entry.action] || Clock;
            return (
              <div key={entry.id} className="flex items-start gap-2 text-xs text-secondary">
                <Icon className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="flex-1">{entry.details || entry.action}</span>
                <span className="shrink-0 text-[10px]">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
