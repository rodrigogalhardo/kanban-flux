"use client";

import { useState, useEffect, use } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface PortalData {
  project: { name: string; description: string | null; status: string };
  columns: { title: string; cards: { title: string; priority: number }[] }[];
  stats: { total: number; done: number; inProgress: number; todo: number };
}

export default function ClientPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setData)
      .catch(() => setError("Project not found or link expired"));
  }, [token]);

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <p className="text-secondary">{error}</p>
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <p className="text-secondary">Loading...</p>
    </div>
  );

  const completionRate = data.stats.total > 0 ? Math.round((data.stats.done / data.stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900">{data.project.name}</h1>
          <p className="text-secondary mt-1">{data.project.description}</p>
          <Badge className="mt-2" variant="outline">{data.project.status}</Badge>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Project Progress</span>
              <span className="text-sm font-bold text-primary">{completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-secondary">
              <span>{data.stats.done} done</span>
              <span>{data.stats.inProgress} in progress</span>
              <span>{data.stats.todo} to do</span>
            </div>
          </CardContent>
        </Card>

        {/* Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {data.columns.map(col => (
            <Card key={col.title}>
              <CardContent className="p-3">
                <h3 className="text-xs font-semibold text-secondary mb-2">
                  {col.title} ({col.cards.length})
                </h3>
                <div className="space-y-1">
                  {col.cards.map((card, i) => (
                    <div key={i} className="text-xs p-1.5 rounded bg-surface truncate">
                      {card.title}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-secondary">
          Powered by Kanban Flux - AI Agent Orchestration Platform
        </p>
      </div>
    </div>
  );
}
