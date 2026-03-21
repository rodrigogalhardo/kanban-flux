"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart3,
  Layers,
  TrendingUp,
  Users,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportData {
  totalBoards: number;
  totalCards: number;
  totalMembers: number;
  overdueCount: number;
  completionRate: number;
  statusCounts: Record<string, number>;
  checklistProgress: { total: number; completed: number };
  recentActivity: {
    id: string;
    title: string;
    updatedAt: string;
    column: { title: string; board: { name: string } };
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  "To Do": "#42526E",
  "In Progress": "#FFAB00",
  Done: "#36B37E",
};

const DEFAULT_STATUS_COLOR = "#00B8D9";

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

function getStatusBadgeStyle(status: string) {
  const color = STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;
  return {
    backgroundColor: `${color}18`,
    color: color,
    borderColor: `${color}30`,
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reports");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const maxStatusCount = data
    ? Math.max(...Object.values(data.statusCounts), 1)
    : 1;

  const checklistPercent =
    data && data.checklistProgress.total > 0
      ? Math.round(
          (data.checklistProgress.completed / data.checklistProgress.total) * 100
        )
      : 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[#0052CC]" />
            Reports
          </h1>
          <p className="text-secondary mt-1">
            Track your team&apos;s progress and performance.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0052CC] border-t-transparent" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 text-secondary">
            Failed to load report data.
          </div>
        ) : (
          <>
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Layers}
                label="Total Cards"
                value={data.totalCards}
                color="#0052CC"
              />
              <StatCard
                icon={TrendingUp}
                label="Completion Rate"
                value={`${data.completionRate}%`}
                color="#36B37E"
              />
              <StatCard
                icon={Users}
                label="Team Members"
                value={data.totalMembers}
                color="#00B8D9"
              />
              <StatCard
                icon={AlertCircle}
                label="Overdue Tasks"
                value={data.overdueCount}
                color="#FF5630"
              />
            </div>

            {/* Two-column layout for Charts & Checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cards by Status */}
              <div className="lg:col-span-2">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-neutral-900">
                      <BarChart3 className="h-5 w-5 text-[#42526E]" />
                      Cards by Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(data.statusCounts).length === 0 ? (
                      <p className="text-secondary text-sm py-4">
                        No status data available yet.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(data.statusCounts).map(
                          ([status, count]) => {
                            const barColor =
                              STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;
                            const widthPercent =
                              (count / maxStatusCount) * 100;

                            return (
                              <div key={status} className="space-y-1.5">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-neutral-700">
                                    {status}
                                  </span>
                                  <span className="font-semibold text-neutral-900">
                                    {count}
                                  </span>
                                </div>
                                <div className="h-3 w-full rounded-full bg-[#F4F5F7]">
                                  <div
                                    className="h-3 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${widthPercent}%`,
                                      backgroundColor: barColor,
                                      minWidth: count > 0 ? "12px" : "0px",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Checklist Progress */}
              <div>
                <Card className="bg-white h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-neutral-900">
                      <Clock className="h-5 w-5 text-[#00B8D9]" />
                      Checklist Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center gap-6 py-4">
                      {/* Circular progress */}
                      <div className="relative h-32 w-32">
                        <svg
                          className="h-32 w-32 -rotate-90"
                          viewBox="0 0 128 128"
                        >
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            fill="none"
                            stroke="#F4F5F7"
                            strokeWidth="12"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            fill="none"
                            stroke="#36B37E"
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 56}`}
                            strokeDashoffset={`${2 * Math.PI * 56 * (1 - checklistPercent / 100)}`}
                            className="transition-all duration-700"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold text-neutral-900">
                            {checklistPercent}%
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-secondary text-center">
                        <span className="font-semibold text-neutral-900">
                          {data.checklistProgress.completed}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-neutral-900">
                          {data.checklistProgress.total}
                        </span>{" "}
                        items completed
                      </p>

                      {/* Simple progress bar fallback */}
                      <div className="w-full">
                        <div className="h-2 w-full rounded-full bg-[#F4F5F7]">
                          <div
                            className="h-2 rounded-full bg-[#36B37E] transition-all duration-500"
                            style={{ width: `${checklistPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Recent Activity */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-neutral-900">
                  <Clock className="h-5 w-5 text-[#0052CC]" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentActivity.length === 0 ? (
                  <p className="text-secondary text-sm py-4">
                    No recent activity to show.
                  </p>
                ) : (
                  <div className="divide-y divide-[#F4F5F7]">
                    {data.recentActivity.map((item, index) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between py-3",
                          index === 0 && "pt-0"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4F5F7]">
                            <Layers className="h-4 w-4 text-[#42526E]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-900 truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-secondary truncate">
                              {item.column.board.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                            style={getStatusBadgeStyle(item.column.title)}
                          >
                            {item.column.title}
                          </span>
                          <span className="text-xs text-secondary whitespace-nowrap">
                            {timeAgo(item.updatedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-6 w-6" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-neutral-900">{value}</p>
          <p className="text-sm text-secondary">{label}</p>
        </div>
      </div>
    </div>
  );
}
