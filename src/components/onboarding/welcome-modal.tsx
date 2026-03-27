"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bird, Sparkles, Bot, Rocket, GitBranch } from "lucide-react";

const STEPS = [
  {
    icon: Bird,
    title: "Welcome to Kanban Flux",
    description:
      "The first AI Agent Orchestration Platform. Your team of AI agents builds projects autonomously while you manage and monitor progress.",
    color: "text-primary",
  },
  {
    icon: Sparkles,
    title: "Start with a Briefing",
    description:
      "Go to Briefing in the sidebar. Describe your project idea and AI generates a professional briefing document. Or upload your own .md/.txt/.pdf file.",
    color: "text-amber-500",
  },
  {
    icon: Bot,
    title: "AI Agents Work for You",
    description:
      'The Analyst reads your briefing, creates task cards, and assigns the right agents (Frontend, Backend, QA, etc.). They work autonomously through the workflow: Todo \u2192 Brainstorming \u2192 In Progress \u2192 QA \u2192 Done.',
    color: "text-green-500",
  },
  {
    icon: GitBranch,
    title: "GitHub Integration",
    description:
      "Each project gets a GitHub repository. Agents commit code, create PRs, and the QA agent reviews before merge. CI/CD pipelines are auto-configured.",
    color: "text-blue-500",
  },
  {
    icon: Rocket,
    title: "You're in Control (HITL)",
    description:
      "Comment on any card and agents respond. Approve or reject PRs. View the Intelligence dashboard for predictions. You're the CEO, agents are the team.",
    color: "text-purple-500",
  },
];

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("kanban-onboarding-done");
    if (!seen) setOpen(true);
  }, []);

  function finish() {
    localStorage.setItem("kanban-onboarding-done", "true");
    setOpen(false);
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) finish();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <div className="text-center py-4">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ${current.color}`}
          >
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">
            {current.title}
          </h2>
          <p className="text-sm text-secondary leading-relaxed">
            {current.description}
          </p>
          <div className="flex justify-center gap-1.5 mt-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i === step ? "bg-primary" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <div className="flex justify-center gap-3 mt-6">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
            ) : (
              <Button onClick={finish}>Get Started</Button>
            )}
          </div>
          <button
            onClick={finish}
            className="mt-3 text-xs text-secondary hover:text-neutral-900"
          >
            Skip tour
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
