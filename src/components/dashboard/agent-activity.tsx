"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Clock, CheckCircle2, Zap } from "lucide-react";

interface AgentRunData {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  tokenUsage: number | null;
  agent: {
    role: string;
    user: {
      id: string;
      name: string;
      avatar: string | null;
    };
  };
  card: {
    id: string;
    title: string;
  };
}

function elapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

const ROLE_COLORS: Record<string, string> = {
  analyst: "#0052CC",
  frontend: "#36B37E",
  backend: "#6554C0",
  designer: "#FF5630",
  tester: "#00B8D9",
  devops: "#FFAB00",
};

function getRoleColor(role: string): string {
  return ROLE_COLORS[role.toLowerCase()] || "#42526E";
}

export function AgentActivity() {
  const [activeRuns, setActiveRuns] = useState<AgentRunData[]>([]);
  const [recentRuns, setRecentRuns] = useState<AgentRunData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const [activeRes, completedRes] = await Promise.all([
        fetch("/api/agents/runs?status=RUNNING"),
        fetch("/api/agents/runs?status=COMPLETED&limit=5"),
      ]);
      const activeData = await activeRes.json();
      const completedData = await completedRes.json();
      setActiveRuns(Array.isArray(activeData) ? activeData : []);
      setRecentRuns(Array.isArray(completedData) ? completedData.slice(0, 5) : []);
    } catch {
      setActiveRuns([]);
      setRecentRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const hasActivity = activeRuns.length > 0 || recentRuns.length > 0;

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-neutral-900">
          <Bot className="h-5 w-5 text-[#0052CC]" />
          Agent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0052CC] border-t-transparent" />
          </div>
        ) : !hasActivity ? (
          <div className="flex flex-col items-center justify-center py-8 text-secondary">
            <Bot className="h-10 w-10 mb-2 text-neutral-300" />
            <p className="text-sm">No agent activity yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Currently Working */}
            {activeRuns.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#FFAB00]" />
                  Currently Working
                </h3>
                <div className="space-y-3">
                  {activeRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center gap-3 rounded-lg border border-[#0052CC]/10 bg-[#0052CC]/5 p-3"
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0052CC]/10">
                          <Bot className="h-4 w-4 text-[#0052CC]" />
                        </div>
                        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0052CC] opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#0052CC]" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-900 truncate">
                            {run.agent.user.name}
                          </span>
                          <Badge
                            className="text-[10px] px-1.5 py-0"
                            style={{
                              backgroundColor: `${getRoleColor(run.agent.role)}18`,
                              color: getRoleColor(run.agent.role),
                              borderColor: `${getRoleColor(run.agent.role)}30`,
                            }}
                          >
                            {run.agent.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-secondary truncate">
                          {run.card.title}
                        </p>
                      </div>
                      <div className="shrink-0 text-xs font-medium text-[#0052CC]">
                        {run.startedAt ? elapsedTime(run.startedAt) : "starting..."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Completed */}
            {recentRuns.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#36B37E]" />
                  Recently Completed
                </h3>
                <div className="divide-y divide-[#F4F5F7]">
                  {recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#36B37E]/10">
                        <CheckCircle2 className="h-4 w-4 text-[#36B37E]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {run.agent.user.name}
                        </p>
                        <p className="text-xs text-secondary truncate">
                          {run.card.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {run.tokenUsage && (
                          <span className="flex items-center gap-1 text-xs text-secondary">
                            <Zap className="h-3 w-3" />
                            {run.tokenUsage.toLocaleString()}
                          </span>
                        )}
                        <span className="text-xs text-secondary whitespace-nowrap">
                          {run.completedAt ? timeAgo(run.completedAt) : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
