"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import { Card, CardContent } from "@/components/ui/card";
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
  Upload,
  Mic,
  MicOff,
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
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recognition, setRecognition] = useState<any>(null);

  function toggleVoice() {
    if (isListening && recognition) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in your browser. Try Chrome."
      );
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      // For final results, append to idea
      if (event.results[event.resultIndex].isFinal) {
        setIdea((prev) => prev + (prev ? " " : "") + transcript);
      }
    };

    rec.onerror = () => {
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.start();
    setRecognition(rec);
    setIsListening(true);
  }

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
          <div className="space-y-6 max-w-3xl">
            {/* State 1: AI Generation Form */}
            <Card>
              <CardContent className="p-6 space-y-5">
                <form onSubmit={handleGenerate} className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-900">
                      Describe your project idea
                    </label>
                    {/* Voice input */}
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "outline"}
                      size="sm"
                      className="mb-2"
                      onClick={toggleVoice}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                          Stop Recording...
                        </>
                      ) : (
                        <>
                          <Mic className="mr-1.5 h-3.5 w-3.5" />
                          Voice Input
                        </>
                      )}
                    </Button>
                    {isListening && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-red-500">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        Listening... speak now
                      </div>
                    )}
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
                    className="w-full bg-primary hover:bg-primary-600"
                    size="lg"
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
              </CardContent>
            </Card>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            {/* Upload existing briefing */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
                  <Upload className="mb-3 h-8 w-8 text-secondary" />
                  <p className="text-sm font-medium text-neutral-900 mb-1">
                    Upload an existing briefing
                  </p>
                  <p className="text-xs text-secondary mb-4">
                    Supports .txt, .md, and .pdf files
                  </p>
                  <input
                    type="file"
                    accept=".txt,.md,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        let text: string;
                        if (file.name.endsWith(".pdf")) {
                          const buffer = await file.arrayBuffer();
                          const res = await fetch("/api/briefing/parse-pdf", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/octet-stream",
                            },
                            body: buffer,
                          });
                          const data = await res.json();
                          text = data.text;
                        } else {
                          text = await file.text();
                        }
                        setBriefing(text);
                        setProjectName(
                          file.name.replace(/\.(txt|md|pdf)$/i, "")
                        );
                      }
                    }}
                    className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
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
