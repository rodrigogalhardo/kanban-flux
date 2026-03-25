"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn, formatDate } from "@/lib/utils";

interface ApiKey {
  id: string;
  label: string;
  provider: string;
  lastFour: string;
  createdAt: string;
}

const PROVIDERS = [
  { value: "GEMINI", label: "Gemini" },
  { value: "CLAUDE", label: "Claude" },
  { value: "OPENAI", label: "OpenAI" },
  { value: "CUSTOM", label: "Custom" },
];

const PROVIDER_BADGE_COLORS: Record<string, string> = {
  CLAUDE: "bg-orange-100 text-orange-700",
  GEMINI: "bg-blue-100 text-blue-700",
  OPENAI: "bg-green-100 text-green-700",
  CUSTOM: "bg-purple-100 text-purple-700",
};

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formProvider, setFormProvider] = useState("CLAUDE");
  const [formLabel, setFormLabel] = useState("");
  const [formKey, setFormKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      } else {
        setError("Failed to load API keys");
      }
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!collapsed) {
      fetchKeys();
    }
  }, [collapsed, fetchKeys]);

  async function handleAddKey(e: React.FormEvent) {
    e.preventDefault();
    if (!formLabel.trim() || !formKey.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/agents/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formProvider,
          label: formLabel,
          key: formKey,
        }),
      });

      if (res.ok) {
        setFormProvider("CLAUDE");
        setFormLabel("");
        setFormKey("");
        setShowForm(false);
        setError(null);
        fetchKeys();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save API key");
      }
    } catch (err) {
      console.error("Failed to save API key:", err);
      setError("Failed to save API key. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey(id: string) {
    try {
      const res = await fetch(`/api/agents/keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete API key");
      }
      setDeleteConfirm(null);
      fetchKeys();
    } catch (err) {
      console.error("Failed to delete API key:", err);
      setError("Failed to delete API key. Please try again.");
    }
  }

  return (
    <div className="rounded-xl border bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between p-4 text-left hover:bg-surface/50 transition-colors rounded-xl"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-secondary" />
          <h2 className="text-base font-semibold text-neutral-900">API Keys</h2>
          <Badge variant="secondary" className="text-[10px]">
            {keys.length}
          </Badge>
        </div>
        {collapsed ? (
          <ChevronRight className="h-5 w-5 text-secondary" />
        ) : (
          <ChevronDown className="h-5 w-5 text-secondary" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t px-4 pb-4">
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-secondary">
              Manage API keys for your AI agent providers.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Key
            </Button>
          </div>

          {showForm && (
            <form
              onSubmit={handleAddKey}
              className="mt-4 rounded-lg border bg-surface/50 p-3 space-y-3"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-900">
                    Provider
                  </label>
                  <Select
                    value={formProvider}
                    onValueChange={(val) => val && setFormProvider(val)}
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
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-neutral-900">
                    Label
                  </label>
                  <Input
                    placeholder="e.g., Production Claude Key"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-900">
                  API Key
                </label>
                <div className="relative">
                  <Input
                    type={showKeyInput ? "text" : "password"}
                    placeholder="sk-..."
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-neutral-900"
                  >
                    {showKeyInput ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setFormLabel("");
                    setFormKey("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !formLabel.trim() || !formKey.trim()}
                  className="bg-primary hover:bg-primary-600"
                >
                  {saving ? "Saving..." : "Save Key"}
                </Button>
              </div>
            </form>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="mt-4 space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border p-3 flex items-center gap-3"
                >
                  <div className="h-5 w-16 rounded-full bg-gray-200" />
                  <div className="h-4 w-32 rounded bg-gray-200" />
                  <div className="ml-auto h-4 w-20 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed py-8 text-center">
              <Key className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-secondary">
                No API keys configured yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] shrink-0",
                      PROVIDER_BADGE_COLORS[key.provider] || "bg-gray-100 text-gray-700"
                    )}
                  >
                    {key.provider}
                  </Badge>
                  <span className="text-sm font-medium text-neutral-900 truncate">
                    {key.label}
                  </span>
                  <span className="text-xs text-secondary font-mono">
                    ****{key.lastFour}
                  </span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-xs text-secondary whitespace-nowrap">
                    {formatDate(key.createdAt)}
                  </span>
                  <div className="ml-auto">
                    {deleteConfirm === key.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => handleDeleteKey(key.id)}
                        >
                          Confirm
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="h-7 w-7 text-secondary hover:text-red-600"
                        onClick={() => setDeleteConfirm(key.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
