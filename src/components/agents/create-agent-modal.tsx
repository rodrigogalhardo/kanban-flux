"use client";

import { useState, useEffect } from "react";
import {
  Crown,
  Search,
  Building2,
  Lightbulb,
  Layout,
  Server,
  Database,
  Container,
  Cloud,
  CheckCircle2,
  Shield,
  Bug,
  BookOpen,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LucideIcon } from "lucide-react";

interface ApiKey {
  id: string;
  label: string;
  provider: string;
  lastFour: string;
  createdAt: string;
}

interface CreateAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface AgentRole {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultPrompt: string;
}

const AGENT_ROLES: AgentRole[] = [
  { value: "master", label: "Master Orchestrator", description: "Regente do time - gerencia projetos de ponta a ponta", icon: Crown, defaultPrompt: "You are the Master Orchestrator. You manage end-to-end project execution, coordinating all team agents, tracking progress, resolving blockers, and ensuring deliverables meet quality standards." },
  { value: "analyst", label: "Analyst", description: "Pesquisa de mercado, validacao e escopo MVP", icon: Search, defaultPrompt: "You are a Market Analyst agent. You perform market research, validate ideas, define MVP scope, and deliver competitive analysis reports." },
  { value: "architect", label: "Solutions Architect", description: "Arquitetura de software e solucoes enterprise", icon: Building2, defaultPrompt: "You are a Solutions Architect agent. You design software architectures, define system boundaries, select technology stacks, and create architecture decision records." },
  { value: "product", label: "Product Strategist", description: "Estrategia de produto, PLG e Growth", icon: Lightbulb, defaultPrompt: "You are a Product Strategist agent. You develop product strategy, define PLG and Growth frameworks, create go-to-market plans, and track product metrics." },
  { value: "frontend", label: "Frontend Specialist", description: "Interfaces premium e UI/UX", icon: Layout, defaultPrompt: "You are a Frontend Specialist agent. You build premium interfaces, implement responsive UI/UX designs, optimize performance, and ensure accessibility standards." },
  { value: "backend", label: "Backend & DB Expert", description: "Sistemas e banco de dados", icon: Server, defaultPrompt: "You are a Backend & DB Expert agent. You design and implement server-side systems, APIs, database schemas, and ensure scalable data architectures." },
  { value: "dba", label: "DBA Specialist", description: "SQL, NoSQL, vetorial e graph databases", icon: Database, defaultPrompt: "You are a DBA Specialist agent. You manage SQL, NoSQL, vector, and graph databases, optimize queries, design schemas, and ensure data integrity." },
  { value: "devops", label: "DevOps Engineer", description: "Automacao, containers e CI/CD", icon: Container, defaultPrompt: "You are a DevOps Engineer agent. You automate deployments, manage containers and orchestration, set up CI/CD pipelines, and monitor infrastructure." },
  { value: "cloud", label: "Cloud Architect", description: "Provisionamento cloud e seguranca", icon: Cloud, defaultPrompt: "You are a Cloud Architect agent. You design cloud infrastructure, manage provisioning, implement security best practices, and optimize cloud costs." },
  { value: "qa", label: "QA Engineer", description: "Validacao, testes e auditoria", icon: CheckCircle2, defaultPrompt: "You are a QA Engineer agent. You design test strategies, write automated tests, perform code audits, and ensure quality gates are met before deployment." },
  { value: "security", label: "Security Expert", description: "ISO, NIST, MITRE e OWASP", icon: Shield, defaultPrompt: "You are a Security Expert agent. You implement security frameworks (ISO, NIST, MITRE, OWASP), perform security reviews, and enforce compliance standards." },
  { value: "hacker", label: "Ethical Hacker", description: "Red/Blue team e pentesting", icon: Bug, defaultPrompt: "You are an Ethical Hacker agent. You perform red/blue team exercises, penetration testing, vulnerability assessments, and security hardening recommendations." },
  { value: "knowledge", label: "Knowledge Curator", description: "Memoria evolutiva e licoes aprendidas", icon: BookOpen, defaultPrompt: "You are a Knowledge Curator agent. You maintain evolutionary memory, document lessons learned, curate knowledge bases, and ensure institutional knowledge is preserved." },
  { value: "prd", label: "Product Manager", description: "PRD e User Stories", icon: FileText, defaultPrompt: "You are a Product Manager agent. You write PRDs, create user stories, define acceptance criteria, and manage product backlogs with clear prioritization." },
];

const PROVIDERS = [
  { value: "GEMINI", label: "Gemini" },
  { value: "CLAUDE", label: "Claude" },
  { value: "OPENAI", label: "OpenAI" },
  { value: "CUSTOM", label: "Custom" },
];

const MODEL_PLACEHOLDERS: Record<string, string> = {
  GEMINI: "gemini-2.0-flash",
  CLAUDE: "claude-sonnet-4-20250514",
  OPENAI: "gpt-4o",
  CUSTOM: "your-model-name",
};

export function CreateAgentModal({
  open,
  onOpenChange,
  onCreated,
}: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [provider, setProvider] = useState("CLAUDE");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [apiKeyId, setApiKeyId] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    async function fetchKeys() {
      try {
        const res = await fetch("/api/agents/keys");
        if (res.ok) {
          const data = await res.json();
          setApiKeys(data);
        }
      } catch {
        // silently fail
      }
    }
    fetchKeys();
  }, [open]);

  useEffect(() => {
    if (role) {
      const selectedRole = AGENT_ROLES.find((r) => r.value === role);
      if (selectedRole) {
        setSystemPrompt(selectedRole.defaultPrompt);
      }
    }
  }, [role]);

  function resetForm() {
    setName("");
    setRole("");
    setProvider("CLAUDE");
    setModel("");
    setSystemPrompt("");
    setCapabilities("");
    setApiKeyId("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role || !provider || !model.trim()) return;

    setLoading(true);
    setError("");
    try {
      const capsArray = capabilities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          provider,
          model,
          systemPrompt: systemPrompt || null,
          capabilities: capsArray,
          apiKeyId: apiKeyId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create agent");
        return;
      }

      resetForm();
      onOpenChange(false);
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  const selectedRole = AGENT_ROLES.find((r) => r.value === role);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create AI Agent</DialogTitle>
          <DialogDescription>
            Configure a new autonomous AI agent for your workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-900">
              Agent Name
            </label>
            <Input
              placeholder="e.g., Claude Architect"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-900">
              Role
            </label>
            <Select value={role} onValueChange={(val) => val && setRole(val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {AGENT_ROLES.map((r) => {
                  const Icon = r.icon;
                  return (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{r.label}</span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedRole && (
              <p className="mt-1 text-xs text-secondary">
                {selectedRole.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-900">
                Provider
              </label>
              <Select
                value={provider}
                onValueChange={(val) => val && setProvider(val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-900">
                Model
              </label>
              <Input
                placeholder={MODEL_PLACEHOLDERS[provider] || "model-name"}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-900">
              System Prompt
            </label>
            <Textarea
              placeholder="Define the agent's behavior and instructions..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-24"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-900">
              Capabilities
            </label>
            <Input
              placeholder="e.g., code-review, testing, documentation (comma-separated)"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
            />
            <p className="mt-1 text-xs text-secondary">
              Separate multiple capabilities with commas.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-900">
              API Key
            </label>
            <Select
              value={apiKeyId}
              onValueChange={(val) => val && setApiKeyId(val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an API key (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No key</SelectItem>
                {apiKeys.map((key) => (
                  <SelectItem key={key.id} value={key.id}>
                    <span>{key.label}</span>
                    <span className="ml-1 text-xs text-secondary">
                      ({key.provider} ****{key.lastFour})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !role || !model.trim()}
              className="bg-primary hover:bg-primary-600"
            >
              {loading ? "Creating..." : "Create Agent"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
