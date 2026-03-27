"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Store,
  Rocket,
  Users,
  Download,
  CheckCircle2,
  Loader2,
  Bot,
  Server,
  BarChart3,
  Globe,
  LayoutTemplate,
  Columns3,
  CreditCard,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface AgentConfig {
  role: string;
  name: string;
  provider: string;
  model: string;
  capabilities: string[];
  systemPromptSummary: string;
}

interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  agents: AgentConfig[];
  isPublic: boolean;
  usageCount: number;
  createdAt: string;
}

interface DeployResult {
  templateName: string;
  agents: { role: string; status: string; id: string }[];
}

interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  columns: string[];
  cardTemplates: { title: string; priority: number; labels: string[] }[] | null;
  isPublic: boolean;
  createdAt: string;
}

interface BoardDeployResult {
  templateName: string;
  boardId: string;
  boardName: string;
  columnsCreated: number;
  cardsCreated: number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  saas: "SaaS",
  "landing-page": "Landing Page",
  api: "API",
  data: "Data & AI",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  saas: <Rocket className="h-4 w-4" />,
  "landing-page": <Globe className="h-4 w-4" />,
  api: <Server className="h-4 w-4" />,
  data: <BarChart3 className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  saas: "bg-blue-100 text-blue-800",
  "landing-page": "bg-green-100 text-green-800",
  api: "bg-purple-100 text-purple-800",
  data: "bg-amber-100 text-amber-800",
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function MarketplacePage() {
  const [templates, setTemplates] = useState<TeamTemplate[]>([]);
  const [boardTemplates, setBoardTemplates] = useState<BoardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployingBoard, setDeployingBoard] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [boardDeployResult, setBoardDeployResult] = useState<BoardDeployResult | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("teams");

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/marketplace");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBoardTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/marketplace/boards");
      if (res.ok) {
        const data = await res.json();
        setBoardTemplates(data);
      }
    } catch (err) {
      console.error("Failed to fetch board templates:", err);
    } finally {
      setBoardsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchBoardTemplates();
  }, [fetchTemplates, fetchBoardTemplates]);

  const handleDeploy = async (templateId: string) => {
    setDeploying(templateId);
    setDeployResult(null);
    try {
      const res = await fetch(`/api/marketplace/${templateId}/deploy`, {
        method: "POST",
      });
      if (res.ok) {
        const result: DeployResult = await res.json();
        setDeployResult(result);
        // Refresh templates to update usage count
        fetchTemplates();
      }
    } catch (err) {
      console.error("Deploy failed:", err);
    } finally {
      setDeploying(null);
    }
  };

  const handleDeployBoard = async (templateId: string) => {
    setDeployingBoard(templateId);
    setBoardDeployResult(null);
    try {
      const res = await fetch(`/api/marketplace/boards/${templateId}/deploy`, {
        method: "POST",
      });
      if (res.ok) {
        const result: BoardDeployResult = await res.json();
        setBoardDeployResult(result);
      }
    } catch (err) {
      console.error("Board deploy failed:", err);
    } finally {
      setDeployingBoard(null);
    }
  };

  const filtered =
    activeCategory === "all"
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  const filteredBoards =
    activeCategory === "all"
      ? boardTemplates
      : boardTemplates.filter((t) => t.category === activeCategory);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                Agent Marketplace
              </h1>
              <p className="text-sm text-secondary">
                Pre-built AI teams ready to deploy
              </p>
            </div>
          </div>
        </div>

        {/* Deploy result banners */}
        {deployResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900">
                Team &quot;{deployResult.templateName}&quot; deployed
                successfully!
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 ml-7">
              {deployResult.agents.map((agent) => (
                <Badge
                  key={agent.role}
                  variant={
                    agent.status === "created" ? "default" : "secondary"
                  }
                  className="text-xs"
                >
                  {agent.role}{" "}
                  {agent.status === "created" ? "(created)" : "(exists)"}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {boardDeployResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900">
                Board &quot;{boardDeployResult.boardName}&quot; created
                successfully!
              </h3>
            </div>
            <p className="ml-7 text-sm text-green-800">
              {boardDeployResult.columnsCreated} columns and {boardDeployResult.cardsCreated} cards created.
            </p>
          </div>
        )}

        {/* Main tabs: Teams vs Boards */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="teams" className="gap-1.5">
              <Users className="h-4 w-4" />
              Team Templates
            </TabsTrigger>
            <TabsTrigger value="boards" className="gap-1.5">
              <LayoutTemplate className="h-4 w-4" />
              Board Templates
            </TabsTrigger>
          </TabsList>

          {/* Category filter */}
          <div className="mt-4">
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <TabsTrigger key={key} value={key}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <TabsContent value="teams" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-secondary">
                <Store className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">No templates found</p>
                <p className="text-sm">Try a different category filter</p>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((template) => (
                  <Card
                    key={template.id}
                    className="flex flex-col border border-gray-200 shadow-sm transition-shadow hover:shadow-lg"
                  >
                    <CardHeader className="pb-3 px-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            {CATEGORY_ICONS[template.category] || (
                              <Bot className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <CardTitle className="text-lg leading-tight truncate">
                            {template.name}
                          </CardTitle>
                        </div>
                        <Badge
                          className={`text-xs shrink-0 ${
                            CATEGORY_COLORS[template.category] || ""
                          }`}
                          variant="secondary"
                        >
                          {CATEGORY_LABELS[template.category] ||
                            template.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4 px-5">
                      <p className="text-sm text-secondary leading-relaxed">
                        {template.description}
                      </p>

                      {/* Agent list */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Agents ({template.agents.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {template.agents.map((agent) => (
                            <Badge
                              key={agent.role}
                              variant="outline"
                              className="text-xs"
                            >
                              <Bot className="h-3 w-3 mr-1" />
                              {agent.name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-3 text-xs text-secondary">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {template.agents.length} agents
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="h-3.5 w-3.5" />
                            {template.usageCount} deploys
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleDeploy(template.id)}
                          disabled={deploying === template.id}
                        >
                          {deploying === template.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Deploying...
                            </>
                          ) : (
                            <>
                              <Rocket className="h-4 w-4 mr-1" />
                              Deploy Team
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="boards" className="mt-4">
            {boardsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredBoards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-secondary">
                <LayoutTemplate className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">No board templates found</p>
                <p className="text-sm">Try a different category filter</p>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {filteredBoards.map((template) => (
                  <Card
                    key={template.id}
                    className="flex flex-col border border-gray-200 shadow-sm transition-shadow hover:shadow-lg"
                  >
                    <CardHeader className="pb-3 px-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            {CATEGORY_ICONS[template.category] || (
                              <LayoutTemplate className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <CardTitle className="text-lg leading-tight truncate">
                            {template.name}
                          </CardTitle>
                        </div>
                        <Badge
                          className={`text-xs shrink-0 ${
                            CATEGORY_COLORS[template.category] || ""
                          }`}
                          variant="secondary"
                        >
                          {CATEGORY_LABELS[template.category] ||
                            template.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4 px-5">
                      <p className="text-sm text-secondary leading-relaxed">
                        {template.description}
                      </p>

                      {/* Columns */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                          Columns ({template.columns.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {template.columns.map((col) => (
                            <Badge
                              key={col}
                              variant="outline"
                              className="text-xs"
                            >
                              <Columns3 className="h-3 w-3 mr-1" />
                              {col}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Card templates */}
                      {template.cardTemplates && template.cardTemplates.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Cards ({template.cardTemplates.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {template.cardTemplates.slice(0, 4).map((ct) => (
                              <Badge
                                key={ct.title}
                                variant="outline"
                                className="text-xs"
                              >
                                <CreditCard className="h-3 w-3 mr-1" />
                                {ct.title}
                              </Badge>
                            ))}
                            {template.cardTemplates.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{template.cardTemplates.length - 4} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-3 text-xs text-secondary">
                          <span className="flex items-center gap-1">
                            <Columns3 className="h-3.5 w-3.5" />
                            {template.columns.length} columns
                          </span>
                          {template.cardTemplates && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3.5 w-3.5" />
                              {template.cardTemplates.length} cards
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleDeployBoard(template.id)}
                          disabled={deployingBoard === template.id}
                        >
                          {deployingBoard === template.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Rocket className="h-4 w-4 mr-1" />
                              Create Board
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
