"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Play, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

type RunPhase = "idle" | "starting" | "queued" | "running" | "completed" | "failed";

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
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const runIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const agentMember = members.find((m) => m.user.isAgent);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pollRunStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/agents/runs/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        const status = data.status as string;

        if (status === "RUNNING") {
          setPhase("running");
        } else if (status === "COMPLETED") {
          setPhase("completed");
          stopPolling();
          // Refresh the card to show new comments/changes
          onRunStarted();
          // Reset to idle after showing success briefly
          setTimeout(() => {
            setPhase("idle");
            runIdRef.current = null;
            setElapsedSeconds(0);
          }, 3000);
        } else if (status === "FAILED") {
          setPhase("failed");
          setError(data.error || "Agent run failed");
          stopPolling();
          // Refresh to show any partial results
          onRunStarted();
          setTimeout(() => {
            setPhase("idle");
            runIdRef.current = null;
            setElapsedSeconds(0);
          }, 5000);
        } else if (status === "CANCELLED") {
          setPhase("idle");
          stopPolling();
          runIdRef.current = null;
          setElapsedSeconds(0);
        }
        // QUEUED stays as queued
      } catch (err) {
        console.error("Failed to poll run status:", err);
      }
    },
    [stopPolling, onRunStarted]
  );

  const startPolling = useCallback(
    (id: string) => {
      // Start the elapsed timer
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // Poll run status every 3 seconds
      pollRef.current = setInterval(() => {
        pollRunStatus(id);
      }, 3000);
    },
    [pollRunStatus]
  );

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
    setPhase("starting");
    setError(null);
    setAgentName(agentMember.user.name);

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

      const runData = await runRes.json();
      runIdRef.current = runData.id;
      setPhase("queued");
      // Notify parent that run started
      onRunStarted();
      // Start polling for completion
      startPolling(runData.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setPhase("failed");
      setTimeout(() => {
        setPhase("idle");
        setElapsedSeconds(0);
      }, 5000);
    }
  }

  function formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  // Render based on phase
  if (phase === "starting") {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-2.5 space-y-1">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
            Starting agent...
          </span>
        </div>
      </div>
    );
  }

  if (phase === "queued") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-2.5 space-y-1">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Queued &mdash; {agentName} waiting to start...
          </span>
          <span className="ml-auto text-xs text-amber-500">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-500">
          The agent will begin working shortly.
        </p>
      </div>
    );
  }

  if (phase === "running") {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
          </span>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
            {agentName} is working...
          </span>
          <span className="ml-auto text-xs text-blue-500">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-blue-200 dark:bg-blue-800 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-blue-500 animate-pulse" />
          </div>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-500">
          Analyzing task and executing actions...
        </p>
      </div>
    );
  }

  if (phase === "completed") {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-2.5 space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            {agentName} completed!
          </span>
          <span className="ml-auto text-xs text-green-500">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
        <p className="text-xs text-green-600 dark:text-green-500">
          Card refreshed with agent results.
        </p>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-2.5 space-y-1">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-700 dark:text-red-400">
            {agentName || "Agent"} failed
          </span>
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // idle state
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
        Run Agent ({agentMember.user.name})
      </Button>
      {error && (
        <p className="text-xs text-red-500 px-2">{error}</p>
      )}
    </div>
  );
}
