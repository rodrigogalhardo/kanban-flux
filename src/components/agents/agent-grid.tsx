"use client";

import { Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AgentCard, type AgentData } from "./agent-card";

interface AgentGridProps {
  agents: AgentData[];
  loading: boolean;
  onSelect?: (agent: AgentData) => void;
  onEdit?: (agent: AgentData) => void;
  onDelete?: (agent: AgentData) => void;
  onClone?: (agentId: string) => void;
}

function SkeletonCard() {
  return (
    <Card className="animate-pulse">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-14 rounded-full bg-gray-200" />
          <div className="h-5 w-20 rounded bg-gray-200" />
        </div>
        <div className="flex gap-1">
          <div className="h-4 w-12 rounded bg-gray-200" />
          <div className="h-4 w-14 rounded bg-gray-200" />
          <div className="h-4 w-10 rounded bg-gray-200" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-3">
        <div className="h-5 w-14 rounded-full bg-gray-200" />
        <div className="h-4 w-16 rounded bg-gray-200" />
      </div>
    </Card>
  );
}

export function AgentGrid({
  agents,
  loading,
  onSelect,
  onEdit,
  onDelete,
  onClone,
}: AgentGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-neutral-900">
          No agents yet
        </h3>
        <p className="mt-1 text-sm text-secondary">
          Create your first AI agent to get started with autonomous task
          management.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onClick={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onClone={onClone}
        />
      ))}
    </div>
  );
}
