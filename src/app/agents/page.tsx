"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AgentGrid } from "@/components/agents/agent-grid";
import { CreateAgentModal } from "@/components/agents/create-agent-modal";
import { EditAgentModal } from "@/components/agents/edit-agent-modal";
import { ApiKeyManager } from "@/components/agents/api-key-manager";
import { AgentImport } from "@/components/agents/agent-import";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Plus, Upload, ChevronDown, ChevronRight } from "lucide-react";
import type { AgentData } from "@/components/agents/agent-card";

type StatusFilter = "ALL" | "WORKING" | "IDLE" | "ERROR";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentData | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [importCollapsed, setImportCollapsed] = useState(true);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      const res = await fetch(`/api/agents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  async function handleDelete(agent: AgentData) {
    if (!confirm(`Delete agent "${agent.user.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      fetchAgents();
    } catch {
      // silently fail
    }
  }

  function handleEdit(agent: AgentData) {
    setEditAgent(agent);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold text-neutral-900">
                AI Agents
              </h1>
            </div>
            <p className="mt-1 text-secondary">
              Manage your autonomous AI workforce
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Agent
          </Button>
        </div>

        <Tabs
          value={statusFilter}
          onValueChange={(val) => val && setStatusFilter(val as StatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="WORKING">Working</TabsTrigger>
            <TabsTrigger value="IDLE">Idle</TabsTrigger>
            <TabsTrigger value="ERROR">Error</TabsTrigger>
          </TabsList>
        </Tabs>

        <AgentGrid
          agents={agents}
          loading={loading}
          onSelect={(agent) => handleEdit(agent)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Import Agents from Markdown */}
        <div className="rounded-xl border bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-left hover:bg-surface/50 transition-colors rounded-xl"
            onClick={() => setImportCollapsed(!importCollapsed)}
          >
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-secondary" />
              <h2 className="text-base font-semibold text-neutral-900">
                Import Agents from Markdown
              </h2>
            </div>
            {importCollapsed ? (
              <ChevronRight className="h-5 w-5 text-secondary" />
            ) : (
              <ChevronDown className="h-5 w-5 text-secondary" />
            )}
          </button>

          {!importCollapsed && (
            <div className="border-t px-4 pb-4 pt-4">
              <p className="text-sm text-secondary mb-4">
                Upload .md files with YAML frontmatter to configure agents. Each
                file defines one agent with its role, provider, model, and system
                prompt.
              </p>
              <AgentImport onImportComplete={() => fetchAgents()} />
            </div>
          )}
        </div>

        <ApiKeyManager />

        <CreateAgentModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onCreated={fetchAgents}
        />

        {editAgent && (
          <EditAgentModal
            agent={editAgent}
            open={!!editAgent}
            onClose={() => setEditAgent(null)}
            onUpdated={fetchAgents}
          />
        )}
      </div>
    </AppLayout>
  );
}
