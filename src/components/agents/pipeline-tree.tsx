"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Bot,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RunNode {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  tokenUsage?: number | null;
  cost?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  error?: string | null;
  agent: {
    role?: string;
    user: { id: string; name: string; avatar?: string | null };
  };
  card?: { id: string; title: string } | null;
  childRuns?: RunNode[];
  logs?: { id: string; level: string; message: string; createdAt: string }[];
}

interface PipelineTreeProps {
  runId: string;
}

function formatDuration(startedAt: string, completedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function StatusIndicator({ status }: { status: string }) {
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
      return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    default:
      return <Minus className="h-3.5 w-3.5 text-gray-400" />;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "RUNNING":
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200">
          Running
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
          Completed
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-50 text-red-700 border-red-200">
          Failed
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-gray-50 text-gray-500 border-gray-200">
          Cancelled
        </Badge>
      );
    case "QUEUED":
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-gray-50 text-gray-500 border-gray-200">
          Queued
        </Badge>
      );
    default:
      return null;
  }
}

function TreeNode({
  node,
  depth = 0,
  isLast = false,
}: {
  node: RunNode;
  depth?: number;
  isLast?: boolean;
}) {
  const [expanded, setExpanded] = useState(
    node.status === "RUNNING" || depth === 0
  );
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [logs, setLogs] = useState(node.logs || []);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [elapsed, setElapsed] = useState("");

  const hasChildren = node.childRuns && node.childRuns.length > 0;

  // Update elapsed time for running tasks
  useEffect(() => {
    if (node.status !== "RUNNING" || !node.startedAt) return;
    setElapsed(formatDuration(node.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatDuration(node.startedAt!));
    }, 1000);
    return () => clearInterval(interval);
  }, [node.status, node.startedAt]);

  async function toggleLogs() {
    if (!logsExpanded && logs.length === 0) {
      setLoadingLogs(true);
      try {
        const res = await fetch(`/api/agents/runs/${node.id}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoadingLogs(false);
      }
    }
    setLogsExpanded(!logsExpanded);
  }

  const roleLabel = node.agent.role
    ? `[${node.agent.role.charAt(0).toUpperCase() + node.agent.role.slice(1)}]`
    : "[Agent]";
  const duration =
    node.startedAt
      ? formatDuration(node.startedAt, node.completedAt)
      : null;

  return (
    <div className={cn("relative", depth > 0 && "ml-4")}>
      {/* Tree connector lines */}
      {depth > 0 && (
        <div className="absolute -left-4 top-0 h-full">
          <div
            className={cn(
              "absolute left-1.5 top-0 w-px bg-border",
              isLast ? "h-3" : "h-full"
            )}
          />
          <div className="absolute left-1.5 top-3 h-px w-2.5 bg-border" />
        </div>
      )}

      {/* Node header */}
      <div className="group flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-accent/50 transition-colors">
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-accent"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <StatusIndicator status={node.status} />

        <span className="font-mono text-[11px] text-muted-foreground">
          {roleLabel}
        </span>
        <span className="truncate font-medium text-foreground">
          {node.agent.user.name}
        </span>

        {node.card?.title && (
          <span className="hidden truncate text-muted-foreground sm:inline">
            - {node.card.title}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {statusBadge(node.status)}

          {node.status === "RUNNING" && elapsed && (
            <span className="text-muted-foreground font-mono">{elapsed}...</span>
          )}
          {duration && node.status !== "RUNNING" && (
            <span className="text-muted-foreground font-mono">{duration}</span>
          )}
          {node.tokenUsage != null && (
            <span className="text-muted-foreground">
              {node.tokenUsage.toLocaleString()} tok
            </span>
          )}
        </span>

        <button
          onClick={toggleLogs}
          className="ml-1 flex-shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
          title="Toggle logs"
        >
          <Bot className="h-3 w-3" />
        </button>
      </div>

      {/* Logs section */}
      {logsExpanded && (
        <div className="ml-8 mb-1 space-y-0.5 border-l-2 border-muted pl-2">
          {loadingLogs ? (
            <p className="text-[10px] text-muted-foreground">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">No logs yet.</p>
          ) : (
            logs.map((log) => (
              <p
                key={log.id}
                className={cn(
                  "text-[10px] font-mono leading-tight",
                  log.level === "error"
                    ? "text-red-500"
                    : log.level === "warn"
                    ? "text-amber-600"
                    : log.level === "debug"
                    ? "text-muted-foreground"
                    : "text-foreground"
                )}
              >
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>{" "}
                {log.message}
              </p>
            ))
          )}
          {node.error && (
            <p className="text-[10px] text-red-500 font-mono">{node.error}</p>
          )}
        </div>
      )}

      {/* Error display for failed nodes */}
      {node.status === "FAILED" && node.error && !logsExpanded && (
        <p className="ml-8 text-[10px] text-red-500 truncate">{node.error}</p>
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div className="relative">
          {node.childRuns!.map((child, i) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={i === node.childRuns!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PipelineTree({ runId }: PipelineTreeProps) {
  const [rootRun, setRootRun] = useState<RunNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/runs/${runId}`);
      if (!res.ok) {
        setError("Failed to load run");
        return;
      }
      const data = await res.json();
      setRootRun(data);
    } catch {
      setError("Failed to load run");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Poll while there are active runs
  useEffect(() => {
    if (!rootRun) return;

    function hasActiveRuns(node: RunNode): boolean {
      if (node.status === "QUEUED" || node.status === "RUNNING") return true;
      return (node.childRuns || []).some(hasActiveRuns);
    }

    if (!hasActiveRuns(rootRun)) return;

    const interval = setInterval(fetchRun, 3000);
    return () => clearInterval(interval);
  }, [rootRun, fetchRun]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
        <Bot className="h-3.5 w-3.5 animate-pulse" />
        Loading pipeline...
      </div>
    );
  }

  if (error || !rootRun) {
    return (
      <div className="text-xs text-red-500 p-2">
        {error || "Run not found"}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 rounded-md border border-border bg-card p-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 pb-1.5 border-b border-border">
        <Bot className="h-3.5 w-3.5" />
        <span className="font-medium">Pipeline</span>
        {rootRun.childRuns && rootRun.childRuns.length > 0 && (
          <span className="text-muted-foreground/60">
            ({rootRun.childRuns.length + 1} runs)
          </span>
        )}
      </div>
      <TreeNode node={rootRun} />
    </div>
  );
}
