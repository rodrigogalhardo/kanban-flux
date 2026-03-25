"use client";

import {
  Bot,
  MoreHorizontal,
  Pencil,
  Trash2,
  Zap,
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
  TrendingUp,
  Clock,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AgentStatusBadge } from "./agent-status-badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const ROLE_ICON_MAP: Record<string, LucideIcon> = {
  master: Crown,
  analyst: Search,
  architect: Building2,
  product: Lightbulb,
  frontend: Layout,
  backend: Server,
  dba: Database,
  devops: Container,
  cloud: Cloud,
  qa: CheckCircle2,
  security: Shield,
  hacker: Bug,
  knowledge: BookOpen,
  prd: FileText,
};

const ROLE_LABEL_MAP: Record<string, string> = {
  master: "Master Orchestrator",
  analyst: "Analyst",
  architect: "Solutions Architect",
  product: "Product Strategist",
  frontend: "Frontend Specialist",
  backend: "Backend & DB Expert",
  dba: "DBA Specialist",
  devops: "DevOps Engineer",
  cloud: "Cloud Architect",
  qa: "QA Engineer",
  security: "Security Expert",
  hacker: "Ethical Hacker",
  knowledge: "Knowledge Curator",
  prd: "Product Manager",
};

const PROVIDER_COLORS: Record<string, string> = {
  CLAUDE: "bg-orange-100 text-orange-700",
  GEMINI: "bg-blue-100 text-blue-700",
  OPENAI: "bg-green-100 text-green-700",
  CUSTOM: "bg-purple-100 text-purple-700",
};

export interface AgentData {
  id: string;
  userId: string;
  provider: string;
  model: string;
  role: string;
  systemPrompt: string | null;
  capabilities: string[];
  status: "IDLE" | "WORKING" | "PAUSED" | "ERROR";
  apiKeyId: string | null;
  maxConcurrent: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  _count?: {
    runs: number;
  };
  stats?: {
    total: number;
    completed: number;
    failed: number;
    totalTokens?: number;
    cardsWorked?: number;
    lastActive?: string | null;
  };
}

interface AgentCardProps {
  agent: AgentData;
  onClick?: (agent: AgentData) => void;
  onEdit?: (agent: AgentData) => void;
  onDelete?: (agent: AgentData) => void;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function AgentCard({ agent, onClick, onEdit, onDelete }: AgentCardProps) {
  const RoleIcon = ROLE_ICON_MAP[agent.role] || Bot;
  const roleLabel = ROLE_LABEL_MAP[agent.role] || agent.role;
  const providerColor = PROVIDER_COLORS[agent.provider] || "bg-gray-100 text-gray-700";
  const completedRuns = agent._count?.runs ?? 0;
  const stats = agent.stats;
  const successRate =
    stats && stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : null;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md",
        "relative"
      )}
      onClick={() => onClick?.(agent)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <RoleIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5">
                <Bot className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-neutral-900">
                {agent.user.name}
              </h3>
              <Badge variant="secondary" className="mt-0.5 text-[10px]">
                {roleLabel}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(agent);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(agent);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px]", providerColor)}>
            {agent.provider}
          </Badge>
          <span className="truncate text-xs text-secondary">{agent.model}</span>
        </div>

        {agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 3).map((cap) => (
              <span
                key={cap}
                className="inline-flex items-center rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-secondary"
              >
                {cap}
              </span>
            ))}
            {agent.capabilities.length > 3 && (
              <span className="inline-flex items-center rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-secondary">
                +{agent.capabilities.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Enhanced metrics row */}
        {stats && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-2">
            {successRate !== null && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <TrendingUp className={cn(
                  "h-3 w-3",
                  successRate >= 80 ? "text-green-500" : successRate >= 50 ? "text-amber-500" : "text-red-500"
                )} />
                <span className="text-secondary">
                  {successRate}% success
                </span>
              </div>
            )}
            {stats.totalTokens != null && stats.totalTokens > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-secondary">
                  {formatTokens(stats.totalTokens)} tokens
                </span>
              </div>
            )}
            {stats.cardsWorked != null && stats.cardsWorked > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <Layers className="h-3 w-3 text-blue-500" />
                <span className="text-secondary">
                  {stats.cardsWorked} cards
                </span>
              </div>
            )}
            {stats.lastActive && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-secondary">
                  {timeAgo(stats.lastActive)}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-between">
        <AgentStatusBadge status={agent.status} />
        <div className="flex items-center gap-1 text-xs text-secondary">
          <Zap className="h-3 w-3" />
          {completedRuns} runs
        </div>
      </CardFooter>
    </Card>
  );
}
