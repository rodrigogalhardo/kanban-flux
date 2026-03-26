"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import {
  Sparkles,
  Download,
  FileText,
  File,
  Loader2,
  Rocket,
  Lightbulb,
  Users,
  Layers,
} from "lucide-react";

export default function BriefingPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [projectType, setProjectType] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [features, setFeatures] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [projectName, setProjectName] = useState("");
  const [tokenUsage, setTokenUsage] = useState(0);
  const [error, setError] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!idea.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/briefing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, projectType, targetAudience, features }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate briefing");
        return;
      }

      setBriefing(data.briefing);
      setProjectName(data.projectName);
      setTokenUsage(data.tokenUsage);
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload(format: "md" | "txt") {
    const extension = format;
    const mimeType = format === "md" ? "text/markdown" : "text/plain";
    const filename = `${projectName || "briefing"}.${extension}`;
    const blob = new Blob([briefing], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCreateProject() {
    setCreatingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: idea.substring(0, 200),
          createRepo: true,
          briefing,
        }),
      });

      if (res.ok) {
        router.push("/projects");
      }
    } finally {
      setCreatingProject(false);
    }
  }

  function handleReset() {
    setBriefing("");
    setProjectName("");
    setTokenUsage(0);
    setError("");
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Briefing Generator
          </h1>
          <p className="text-secondary">
            Describe your idea and let AI create a professional project briefing
          </p>
        </div>

        {!briefing ? (
          /* State 1: Input Form */
          <form onSubmit={handleGenerate} className="space-y-6 max-w-3xl">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-900">
                Describe your project idea
              </label>
              <Textarea
                placeholder="e.g., I want to build a SaaS platform that helps small restaurants manage online orders, reservations, and loyalty programs. It should have a customer-facing app and an admin dashboard..."
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={6}
                required
                className="resize-y"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                  <Layers className="h-3.5 w-3.5 text-secondary" />
                  Project Type
                </label>
                <Input
                  placeholder="e.g., SaaS, Mobile App, API"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                  <Users className="h-3.5 w-3.5 text-secondary" />
                  Target Audience
                </label>
                <Input
                  placeholder="e.g., Small businesses, Developers"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                  <Lightbulb className="h-3.5 w-3.5 text-secondary" />
                  Key Features
                </label>
                <Input
                  placeholder="e.g., Auth, Payments, Dashboard"
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !idea.trim()}
              className="bg-primary hover:bg-primary-600"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating briefing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Briefing
                </>
              )}
            </Button>
          </form>
        ) : (
          /* State 2: Generated Briefing */
          <div className="space-y-6">
            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
              <Badge variant="secondary" className="text-sm">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {projectName}
              </Badge>

              {tokenUsage > 0 && (
                <span className="text-xs text-secondary">
                  {tokenUsage.toLocaleString()} tokens used
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload("md")}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  .md
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload("txt")}
                >
                  <File className="mr-1.5 h-3.5 w-3.5" />
                  .txt
                </Button>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-600"
                  onClick={handleCreateProject}
                  disabled={creatingProject}
                >
                  {creatingProject ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-1.5 h-3.5 w-3.5" />
                      Create Project from Briefing
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Briefing content */}
            <div className="rounded-xl border bg-white p-6">
              <Markdown content={briefing} />
            </div>

            {/* Reset link */}
            <div className="text-center">
              <button
                onClick={handleReset}
                className="text-sm text-primary hover:underline"
              >
                Generate another briefing
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
