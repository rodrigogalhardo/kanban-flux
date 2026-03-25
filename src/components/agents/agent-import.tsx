"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Bot,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ParsedFile {
  filename: string;
  content: string;
  name?: string;
  role?: string;
  provider?: string;
  model?: string;
  status: "pending" | "importing" | "success" | "error";
  result?: string;
}

const PROVIDER_BADGE_COLORS: Record<string, string> = {
  CLAUDE: "bg-orange-100 text-orange-700",
  GEMINI: "bg-blue-100 text-blue-700",
  OPENAI: "bg-green-100 text-green-700",
  CUSTOM: "bg-purple-100 text-purple-700",
};

function quickParseFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const data: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx > -1) {
      const key = line.substring(0, idx).trim();
      const val = line.substring(idx + 1).trim();
      if (val) data[key] = val;
    }
  }
  return data;
}

export function AgentImport({
  onImportComplete,
}: {
  onImportComplete: () => void;
}) {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((fileList: FileList) => {
    const mdFiles = Array.from(fileList).filter((f) => f.name.endsWith(".md"));

    Promise.all(
      mdFiles.map((file) =>
        file.text().then((content) => {
          const parsed = quickParseFrontmatter(content);
          return {
            filename: file.name,
            content,
            name: parsed.name,
            role: parsed.role,
            provider: parsed.provider,
            model: parsed.model,
            status: "pending" as const,
          };
        })
      )
    ).then((parsed) => {
      setFiles((prev) => [...prev, ...parsed]);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleImportAll = async () => {
    setImporting(true);
    const updated = [...files];

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status !== "pending") continue;
      updated[i] = { ...updated[i], status: "importing" };
      setFiles([...updated]);

      try {
        const res = await fetch("/api/agents/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: updated[i].content }),
        });
        const data = await res.json();
        if (res.ok) {
          updated[i] = {
            ...updated[i],
            status: "success",
            result: data.action === "created" ? "Created" : "Updated",
          };
        } else {
          updated[i] = {
            ...updated[i],
            status: "error",
            result: data.error || "Import failed",
          };
        }
      } catch {
        updated[i] = {
          ...updated[i],
          status: "error",
          result: "Network error",
        };
      }
      setFiles([...updated]);
    }

    setImporting(false);
    onImportComplete();
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => setFiles([]);

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-primary/50"
        }`}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".md";
          input.multiple = true;
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files) handleFiles(target.files);
          };
          input.click();
        }}
      >
        <Upload className="h-8 w-8 mx-auto mb-3 text-secondary" />
        <p className="text-sm font-medium text-neutral-900">
          Drop markdown files here or click to browse
        </p>
        <p className="text-xs text-secondary mt-1">
          .md files with YAML frontmatter (name, role, provider, model,
          capabilities)
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-900">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
              {successCount > 0 && (
                <span className="text-green-600 ml-1">
                  ({successCount} imported)
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-500 ml-1">
                  ({errorCount} failed)
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearAll}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>
              {pendingCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleImportAll}
                  disabled={importing}
                  className="bg-primary hover:bg-primary-600"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-1.5" />
                      Import {pendingCount} Agent
                      {pendingCount !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {files.map((file, idx) => (
              <div
                key={`${file.filename}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-secondary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.name || file.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {file.role && (
                        <Badge variant="secondary" className="text-xs">
                          {file.role}
                        </Badge>
                      )}
                      {file.provider && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${PROVIDER_BADGE_COLORS[file.provider.toUpperCase()] || ""}`}
                        >
                          {file.provider}
                        </Badge>
                      )}
                      {file.model && (
                        <span className="text-xs text-secondary">
                          {file.model}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {file.status === "pending" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-secondary hover:text-neutral-900 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                  {file.status === "importing" && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {file.status === "success" && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-medium">{file.result}</span>
                    </div>
                  )}
                  {file.status === "error" && (
                    <div className="flex items-center gap-1 text-red-500">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs">{file.result}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
