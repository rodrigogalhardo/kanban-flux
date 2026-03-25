"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AgentStatusType = "IDLE" | "WORKING" | "PAUSED" | "ERROR";

const STATUS_CONFIG: Record<
  AgentStatusType,
  { label: string; className: string }
> = {
  IDLE: {
    label: "Idle",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  WORKING: {
    label: "Working",
    className: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",
  },
  PAUSED: {
    label: "Paused",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  ERROR: {
    label: "Error",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

interface AgentStatusBadgeProps {
  status: AgentStatusType;
  className?: string;
}

export function AgentStatusBadge({ status, className }: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.IDLE;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
