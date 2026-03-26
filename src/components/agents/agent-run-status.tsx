"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineTree } from "./pipeline-tree";
import { cn } from "@/lib/utils";

interface AgentRunLog {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

interface AgentRunData {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  parentRunId?: string | null;
  agent: {
    user: { id: string; name: string };
  };
  error?: string | null;
  tokenUsage?: number | null;
  cost?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  _count?: { logs: number; childRuns?: number };
}

interface AgentRunStatusProps {
  cardId: string;
  onRunCompleted?: () => void;
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "RUNNING":
      return (
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
        </span>
      );
    case "COMPLETED":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "FAILED":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "CANCELLED":
      return <XCircle className="h-3.5 w-3.5 text-gray-400" />;
    case "QUEUED":
      return <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />;
    default:
      return <Bot className="h-3.5 w-3.5 text-gray-400" />;
  }
}

function LogLevelClass(level: string): string {
  switch (level) {
    case "warn":
      return "text-amber-600";
    case "error":
      return "text-red-500";
    case "debug":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

function RunItem({ run, onCancelled }: { run: AgentRunData; onCancelled?: () => void }) {
  const [expanded, setExpanded] = useState(
    run.status === "RUNNING" || run.status === "QUEUED"
  );
  const [logs, setLogs] = useState<AgentRunLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [latestLog, setLatestLog] = useState<string | null>(null);

  // Update elapsed time for running tasks
  useEffect(() => {
    if (run.status !== "RUNNING" || !run.startedAt) return;
    setElapsed(formatElapsed(run.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(run.startedAt!));
    }, 1000);
    return () => clearInterval(interval);
  }, [run.status, run.startedAt]);

  // Auto-fetch logs for active runs to show latest activity
  useEffect(() => {
    if (run.status !== "RUNNING" && run.status !== "QUEUED") return;

    async function fetchLatestLog() {
      try {
        const res = await fetch(`/api/agents/runs/${run.id}`);
        if (res.ok) {
          const data = await res.json();
          const runLogs = data.logs || [];
          setLogs(runLogs);
          if (runLogs.length > 0) {
            setLatestLog(runLogs[runLogs.length - 1].message);
          }
        }
      } catch {
        // ignore
      }
    }

    fetchLatestLog();
    const interval = setInterval(fetchLatestLog, 5000);
    return () => clearInterval(interval);
  }, [run.id, run.status]);

  async function toggleExpand() {
    if (!expanded && logs.length === 0) {
      setLoadingLogs(true);
      try {
        const res = await fetch(`/api/agents/runs/${run.id}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error("Failed to fetch run logs:", err);
      } finally {
        setLoadingLogs(false);
      }
    }
    setExpanded(!expanded);
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/agents/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Failed to cancel run:", data.error || "Unknown error");
      }
      setConfirmCancel(false);
      onCancelled?.();
    } catch (err) {
      console.error("Failed to cancel run:", err);
    } finally {
      setCancelling(false);
    }
  }

  const isCancellable = run.status === "RUNNING" || run.status === "QUEUED";
  const isActive = run.status === "RUNNING" || run.status === "QUEUED";

  return (
    <div
      className={cn(
        "space-y-1 rounded-md p-1.5 transition-colors",
        isActive && "bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpand}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleExpand(); }}
        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-accent transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        )}
        <RunStatusIcon status={run.status} />
        <span className="truncate font-medium">{run.agent.user.name}</span>
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
          {run.status === "RUNNING" && (
            <>
              <span className="text-blue-600 dark:text-blue-400 font-medium">Working...</span>
              {elapsed && <span>{elapsed}</span>}
            </>
          )}
          {run.status === "COMPLETED" && (
            <>
              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
                Completed
              </Badge>
              {run.tokenUsage != null && (
                <span>{run.tokenUsage.toLocaleString()} tokens</span>
              )}
              {run.cost != null && (
                <span>${run.cost.toFixed(4)}</span>
              )}
            </>
          )}
          {run.status === "FAILED" && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-50 text-red-700 border-red-200">
              Failed
            </Badge>
          )}
          {run.status === "QUEUED" && (
            <span className="text-amber-600 dark:text-amber-400">Queued...</span>
          )}
          {run.status === "CANCELLED" && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-gray-50 text-gray-500 border-gray-200">
              Cancelled
            </Badge>
          )}
        </span>
        {isCancellable && !confirmCancel && (
          <button
            type="button"
            title="Cancel run"
            className="ml-1 rounded p-0.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmCancel(true);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {confirmCancel && (
          <span className="ml-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1 text-[10px]"
              onClick={() => setConfirmCancel(false)}
              disabled={cancelling}
            >
              No
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-5 px-1 text-[10px]"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "..." : "Cancel"}
            </Button>
          </span>
        )}
      </div>

      {/* Show latest log message inline for active runs */}
      {isActive && latestLog && !expanded && (
        <div className="flex items-start gap-1.5 ml-7 px-1">
          <MessageSquare className="h-3 w-3 mt-0.5 text-blue-400 flex-shrink-0" />
          <p className="text-[10px] text-blue-600 dark:text-blue-400 truncate">{latestLog}</p>
        </div>
      )}

      {run.status === "FAILED" && run.error && !expanded && (
        <p className="ml-7 text-[10px] text-red-500 truncate">{run.error}</p>
      )}

      {expanded && (
        <div className="ml-7 space-y-0.5 border-l-2 border-muted pl-2">
          {loadingLogs ? (
            <p className="text-[10px] text-muted-foreground">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">No logs yet.</p>
          ) : (
            logs.map((log) => (
              <p
                key={log.id}
                className={cn("text-[10px] font-mono leading-tight", LogLevelClass(log.level))}
              >
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>{" "}
                {log.message}
              </p>
            ))
          )}
          {run.status === "FAILED" && run.error && (
            <p className="text-[10px] text-red-500 font-mono">{run.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentRunStatus({ cardId, onRunCompleted }: AgentRunStatusProps) {
  const [runs, setRuns] = useState<AgentRunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevActiveCount, setPrevActiveCount] = useState(0);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/runs?cardId=${cardId}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
      }
    } catch (err) {
      console.error("Failed to fetch agent runs:", err);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Poll while there are active runs
  useEffect(() => {
    const hasActiveRuns = runs.some(
      (r) => r.status === "QUEUED" || r.status === "RUNNING"
    );
    if (!hasActiveRuns) return;

    const interval = setInterval(fetchRuns, 3000);
    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  // Detect when active runs complete and notify parent
  useEffect(() => {
    const activeCount = runs.filter(
      (r) => r.status === "QUEUED" || r.status === "RUNNING"
    ).length;

    if (prevActiveCount > 0 && activeCount === 0) {
      // All active runs have completed, refresh the card
      onRunCompleted?.();
    }
    setPrevActiveCount(activeCount);
  }, [runs, prevActiveCount, onRunCompleted]);

  if (loading) return null;
  if (runs.length === 0) return null;

  const hasActiveRuns = runs.some(
    (r) => r.status === "QUEUED" || r.status === "RUNNING"
  );

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs",
          hasActiveRuns
            ? "text-blue-600 dark:text-blue-400 font-medium"
            : "text-muted-foreground"
        )}
      >
        {hasActiveRuns ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
          </span>
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
        <span>
          {hasActiveRuns ? "Agent Running" : "Agent Runs"}
        </span>
        {hasActiveRuns && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 animate-pulse"
          >
            Live
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">
        {runs.map((run) => {
          const hasChildren =
            run._count?.childRuns != null && run._count.childRuns > 0;
          if (hasChildren && !run.parentRunId) {
            return <PipelineTree key={run.id} runId={run.id} />;
          }
          // Skip child runs (they're shown inside the PipelineTree)
          if (run.parentRunId) return null;
          return <RunItem key={run.id} run={run} onCancelled={fetchRuns} />;
        })}
      </div>
    </div>
  );
}
