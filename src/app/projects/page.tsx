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
  createdAt: string;
  updatedAt: string;
  boardCount: number;
  agentCount: number;
  boards: { id: string; name: string }[];
}

const projectCovers = [
  "from-primary to-primary-400",
  "from-tertiary to-blue-400",
  "from-purple-500 to-pink-500",
  "from-success to-emerald-400",
  "from-warning to-orange-400",
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
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
                      </div>
                    </div>
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, createRepo }),
      });
      setName("");
      setDescription("");
      setCreateRepo(false);
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
    </Dialog>
  );
}
