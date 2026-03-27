"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Calendar,
  Target,
  TrendingDown,
  Play,
  CheckCircle2,
} from "lucide-react";

interface Sprint {
  id: string;
  name: string;
  projectId: string;
  startDate: string;
  endDate: string;
  status: string;
  goal: string | null;
  _count?: { cards: number };
  completedCards?: number;
}

interface Project {
  id: string;
  name: string;
}

export default function SprintsPage() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sprintsRes, projectsRes] = await Promise.all([
        fetch(
          selectedProject
            ? `/api/sprints?projectId=${selectedProject}`
            : "/api/sprints"
        ),
        fetch("/api/projects"),
      ]);
      const sprintsData = await sprintsRes.json();
      const projectsData = await projectsRes.json();
      setSprints(Array.isArray(sprintsData) ? sprintsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch {
      setSprints([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusColors: Record<string, string> = {
    PLANNING: "bg-gray-100 text-gray-700",
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-blue-100 text-blue-700",
  };

  async function activateSprint(id: string) {
    await fetch(`/api/sprints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    fetchData();
  }

  async function completeSprint(id: string) {
    await fetch(`/api/sprints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    fetchData();
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Sprints
            </h1>
            <p className="text-secondary">
              Manage sprint cycles and track velocity
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              value={selectedProject}
              onValueChange={(v) => setSelectedProject(v ?? "")}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" /> New Sprint
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-secondary">
            Loading sprints...
          </div>
        ) : sprints.length === 0 ? (
          <div className="text-center py-12 text-secondary">
            No sprints found. Create your first sprint to get started.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sprints.map((sprint) => {
              const totalCards = sprint._count?.cards || 0;
              const completed = sprint.completedCards || 0;
              const progress =
                totalCards > 0
                  ? Math.round((completed / totalCards) * 100)
                  : 0;
              const daysLeft = Math.max(
                0,
                Math.ceil(
                  (new Date(sprint.endDate).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                )
              );

              return (
                <Card key={sprint.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {sprint.name}
                      </CardTitle>
                      <Badge
                        className={statusColors[sprint.status] || ""}
                      >
                        {sprint.status}
                      </Badge>
                    </div>
                    {sprint.goal && (
                      <p className="text-xs text-secondary mt-1">
                        {sprint.goal}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-xs text-secondary">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(sprint.startDate).toLocaleDateString()} -{" "}
                        {new Date(sprint.endDate).toLocaleDateString()}
                      </div>
                      {sprint.status === "ACTIVE" && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {daysLeft} days left
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>
                          {completed}/{totalCards} cards
                        </span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Burndown summary */}
                    <div className="flex items-center gap-1 text-xs text-secondary">
                      <TrendingDown className="h-3 w-3" />
                      <span>{totalCards - completed} remaining</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {sprint.status === "PLANNING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => activateSprint(sprint.id)}
                        >
                          <Play className="h-3 w-3 mr-1" /> Start Sprint
                        </Button>
                      )}
                      {sprint.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => completeSprint(sprint.id)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <CreateSprintDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          projects={projects}
          onCreated={fetchData}
        />
      </div>
    </AppLayout>
  );
}

function CreateSprintDialog({
  open,
  onOpenChange,
  projects,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: Project[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !projectId) return;
    setSubmitting(true);
    try {
      await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          projectId,
          startDate,
          endDate,
          goal: goal || null,
        }),
      });
      setName("");
      setGoal("");
      onOpenChange(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Sprint</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Sprint Name
            </label>
            <Input
              placeholder="Sprint 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Project</label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Start</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">End</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Sprint Goal
            </label>
            <Input
              placeholder="What should this sprint achieve?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name || !projectId}>
              {submitting ? "Creating..." : "Create Sprint"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
