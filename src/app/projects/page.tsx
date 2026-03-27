"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Layers,
  Bot,
  ExternalLink,
  MoreHorizontal,
  Archive,
  Trash2,
  CheckCircle2,
  FolderGit2,
  Zap,
  ZapOff,
  Sparkles,
  Download,
  Repeat,
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  githubRepo: string | null;
  githubUrl: string | null;
  status: string;
  autoTrigger: boolean;
  createdAt: string;
  updatedAt: string;
  boardCount: number;
  agentCount: number;
  boards: { id: string; name: string }[];
}

const projectCovers = [
  "from-[#432776] to-[#6B3FA0]",       // Lumys violet
  "from-[#432776] to-purple-400",        // violet to light purple
  "from-purple-600 to-pink-500",         // purple to pink
  "from-[#432776] to-blue-400",          // violet to blue
  "from-emerald-500 to-teal-400",        // accent green
];

interface StatusReport {
  project: string;
  stats: {
    totalCards: number;
    todoCards: number;
    inProgressCards: number;
    qaCards: number;
    bugCards: number;
    doneCards: number;
  };
  completionRate: number;
  agents: string[];
  aiReport: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [statusReports, setStatusReports] = useState<Record<string, StatusReport | null>>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loadingStatus, setLoadingStatus] = useState<Record<string, boolean>>({});
  const [expandedStatus, setExpandedStatus] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const statusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default" as const;
      case "COMPLETED":
        return "secondary" as const;
      case "ARCHIVED":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  async function handleArchiveProject(id: string) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    fetchProjects();
  }

  async function handleCompleteProject(id: string) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    fetchProjects();
  }

  async function handleDeleteProject(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    fetchProjects();
  }

  async function toggleAutoTrigger(id: string, autoTrigger: boolean) {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoTrigger }),
    });
    fetchProjects();
  }

  async function handleReplayProject(id: string, name: string) {
    await fetch(`/api/projects/${id}/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newName: `${name} (Replay)` }),
    });
    fetchProjects();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleFetchAIStatus(id: string) {
    if (expandedStatus[id]) {
      setExpandedStatus((prev) => ({ ...prev, [id]: false }));
      return;
    }
    setLoadingStatus((prev) => ({ ...prev, [id]: true }));
    setExpandedStatus((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/projects/${id}/status-report`);
      const data = await res.json();
      setStatusReports((prev) => ({ ...prev, [id]: data }));
    } catch {
      setStatusReports((prev) => ({ ...prev, [id]: null }));
    } finally {
      setLoadingStatus((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">
              Projects
            </h1>
            <p className="text-secondary">
              Manage your AI-powered projects
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-primary hover:bg-primary-600"
          >
            <Plus className="mr-1 h-4 w-4" />
            Create Project
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <Card
                key={project.id}
                className="group relative overflow-hidden"
              >
                {/* Cover gradient */}
                <div
                  className={cn(
                    "h-3 bg-gradient-to-r",
                    projectCovers[index % projectCovers.length]
                  )}
                />

                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle
                        className="flex items-center gap-2 truncate cursor-pointer hover:text-primary transition-colors"
                        onClick={() => {
                          if (project.boards.length > 0) {
                            router.push(`/board/${project.boards[0].id}`);
                          }
                        }}
                      >
                        <FolderGit2 className="h-4 w-4 flex-shrink-0 text-primary" />
                        {project.name}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-md p-1 opacity-0 transition-opacity hover:bg-surface group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4 text-secondary" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => toggleAutoTrigger(project.id, !project.autoTrigger)}
                        >
                          {project.autoTrigger ? (
                            <ZapOff className="mr-2 h-4 w-4" />
                          ) : (
                            <Zap className="mr-2 h-4 w-4" />
                          )}
                          {project.autoTrigger ? "Disable Auto-trigger" : "Enable Auto-trigger"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            fetch(`/api/projects/${project.id}/export`)
                              .then(r => r.json())
                              .then(data => {
                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `${project.name.replace(/\s+/g, "-")}-export.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                              });
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export Project
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleCompleteProject(project.id)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleArchiveProject(project.id)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleReplayProject(project.id, project.name)}
                        >
                          <Repeat className="mr-2 h-4 w-4" />
                          Replay Project
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {/* GitHub repo link */}
                    {project.githubRepo && project.githubUrl && (
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {project.githubRepo}
                      </a>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant(project.status)}>
                          {project.status.charAt(0) +
                            project.status.slice(1).toLowerCase()}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-secondary">
                          <Layers className="h-3.5 w-3.5" />
                          {project.boardCount} board
                          {project.boardCount !== 1 ? "s" : ""}
                        </div>
                        {project.agentCount > 0 && (
                          <div className="flex items-center gap-1 text-xs text-secondary">
                            <Bot className="h-3.5 w-3.5" />
                            {project.agentCount} agent
                            {project.agentCount !== 1 ? "s" : ""}
                          </div>
                        )}
                        {/* Auto-trigger indicator */}
                        <div className="flex items-center gap-1 text-xs">
                          <div className={`h-2 w-2 rounded-full ${project.autoTrigger ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className={project.autoTrigger ? 'text-green-600' : 'text-secondary'}>
                            {project.autoTrigger ? 'Auto' : 'Manual'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI Status Button */}
                    <button
                      onClick={() => handleFetchAIStatus(project.id)}
                      className="flex w-full items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <span className="flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5" />
                        AI Status Report
                      </span>
                      {loadingStatus[project.id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : expandedStatus[project.id] ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* AI Status Expanded Section */}
                    {expandedStatus[project.id] && (
                      <div className="rounded-md border border-border bg-surface/50 p-3 text-xs">
                        {loadingStatus[project.id] ? (
                          <div className="flex items-center justify-center gap-2 py-2 text-secondary">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating AI report...
                          </div>
                        ) : statusReports[project.id] ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 text-secondary">
                              <span>Done: {statusReports[project.id]!.stats.doneCards}/{statusReports[project.id]!.stats.totalCards}</span>
                              <span>Completion: {statusReports[project.id]!.completionRate}%</span>
                              {statusReports[project.id]!.stats.bugCards > 0 && (
                                <span className="text-red-500">Bugs: {statusReports[project.id]!.stats.bugCards}</span>
                              )}
                            </div>
                            {statusReports[project.id]!.aiReport ? (
                              <p className="text-secondary leading-relaxed whitespace-pre-wrap">
                                {statusReports[project.id]!.aiReport}
                              </p>
                            ) : (
                              <p className="text-secondary italic">
                                No AI report available. Configure a Gemini API key to enable AI-generated reports.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-secondary italic">Failed to load status report.</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Create Project card */}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary transition-colors hover:border-primary hover:bg-primary/10"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">Create Project</span>
            </button>
          </div>
        )}

        <CreateProjectDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onProjectCreated={fetchProjects}
        />
      </div>
    </AppLayout>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createRepo, setCreateRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [briefingFilename, setBriefingFilename] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setShowDisclaimer(true);
  }

  async function handleConfirmCreate() {
    setShowDisclaimer(false);
    setLoading(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, createRepo, briefing }),
      });
      setName("");
      setDescription("");
      setCreateRepo(false);
      setBriefing("");
      setBriefingFilename("");
      onOpenChange(false);
      onProjectCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-900">
              Project Name
            </label>
            <Input
              placeholder="e.g., AI Dashboard v2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-900">
              Description
            </label>
            <Textarea
              placeholder="What is this project about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-900">
              Project Briefing
            </label>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10 mb-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs text-secondary">
                Don&apos;t have a briefing?{" "}
                <a href="/briefing" className="text-primary font-medium hover:underline">
                  Generate one with AI
                </a>
              </p>
            </div>
            <p className="text-xs text-secondary mb-2">
              Upload a .txt, .md or .pdf file with the project requirements. The Analyst agent will automatically create tasks from it.
            </p>
            <input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.name.endsWith('.pdf')) {
                    const buffer = await file.arrayBuffer();
                    const res = await fetch('/api/briefing/parse-pdf', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/octet-stream' },
                      body: buffer,
                    });
                    const data = await res.json();
                    setBriefing(data.text);
                  } else {
                    const text = await file.text();
                    setBriefing(text);
                  }
                  setBriefingFilename(file.name);
                }
              }}
              className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            />
            {briefingFilename && (
              <p className="mt-1 text-xs text-green-600">&#10003; {briefingFilename} loaded</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={createRepo}
              onCheckedChange={(val) => setCreateRepo(val === true)}
              id="create-repo"
            />
            <label
              htmlFor="create-repo"
              className="text-sm font-medium text-neutral-900 cursor-pointer select-none"
            >
              Create GitHub Repository
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-primary hover:bg-primary-600"
            >
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Disclaimer Modal */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              How AI Project Creation Works
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-secondary">
            <p className="text-neutral-900 font-medium">
              When you create this project, our AI team will automatically set everything up:
            </p>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
                <div>
                  <p className="font-medium text-neutral-900">Project & Repository</p>
                  <p>A board with workflow columns (Todo, Brainstorming, In Progress, QA, Bug, Done) {createRepo ? "and a GitHub repository in the kanban-flux org" : ""} will be created.</p>
                </div>
              </div>

              {briefing && (
                <>
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</div>
                    <div>
                      <p className="font-medium text-neutral-900">Analyst Reads the Briefing</p>
                      <p>The <strong>Analyst Agent</strong> will read your briefing document (<em>{briefingFilename}</em>) and analyze requirements, scope, and deliverables.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</div>
                    <div>
                      <p className="font-medium text-neutral-900">Task Cards Created</p>
                      <p>The Analyst will create task cards for each deliverable, with detailed descriptions and acceptance criteria.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</div>
                    <div>
                      <p className="font-medium text-neutral-900">Team Allocation</p>
                      <p>Each card will be assigned to the right agent (Frontend, Backend, QA, Architect, etc.) based on the task requirements. The team is allocated automatically according to the project needs.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">5</div>
                    <div>
                      <p className="font-medium text-neutral-900">Autonomous Execution</p>
                      <p>Agents work autonomously: devs move cards to QA when done, QA validates and moves to Done or Bug. You monitor progress and intervene when needed (HITL).</p>
                    </div>
                  </div>
                </>
              )}

              {!briefing && (
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-600">!</div>
                  <div>
                    <p className="font-medium text-neutral-900">No Briefing Uploaded</p>
                    <p>Without a briefing document, the board will be created empty. You can add tasks manually or upload a briefing later.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowDisclaimer(false)}>
                Go Back
              </Button>
              <Button
                onClick={handleConfirmCreate}
                disabled={loading}
                className="bg-primary hover:bg-primary-600"
              >
                {loading ? "Creating..." : "Confirm & Create Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
