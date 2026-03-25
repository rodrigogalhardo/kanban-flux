"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Play, Loader2 } from "lucide-react";

interface AgentRunTriggerProps {
  cardId: string;
  members: { user: { id: string; name: string; isAgent?: boolean } }[];
  onRunStarted: () => void;
}

export function AgentRunTrigger({
  cardId,
  members,
  onRunStarted,
}: AgentRunTriggerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agentMember = members.find((m) => m.user.isAgent);

  if (!agentMember) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground"
        disabled
      >
        <Bot className="h-4 w-4" />
        Assign an AI agent first
      </Button>
    );
  }

  async function handleRunAgent() {
    if (!agentMember) return;
    setIsLoading(true);
    setError(null);

    try {
      // Find the agent record by userId
      const agentsRes = await fetch("/api/agents");
      if (!agentsRes.ok) throw new Error("Failed to fetch agents");
      const agents = await agentsRes.json();
      const agent = agents.find(
        (a: { user: { id: string } }) => a.user.id === agentMember.user.id
      );

      if (!agent) {
        throw new Error("Agent not found for this user");
      }

      // Create a run
      const runRes = await fetch("/api/agents/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, cardId }),
      });

      if (!runRes.ok) {
        const data = await runRes.json();
        throw new Error(data.error || "Failed to start agent run");
      }

      onRunStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-blue-600"
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Agent working...
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-secondary hover:text-blue-600"
        onClick={handleRunAgent}
      >
        <Bot className="h-4 w-4" />
        <Play className="h-3 w-3" />
        Run Agent
      </Button>
      {error && (
        <p className="text-xs text-red-500 px-2">{error}</p>
      )}
    </div>
  );
}
