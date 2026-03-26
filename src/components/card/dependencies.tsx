"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRight, ArrowLeft, X, Plus, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DepCard {
  id: string;
  title: string;
  column?: { title: string };
}

interface Dependency {
  id: string;
  type: string;
  dependsOn: DepCard;
}

interface DependedOnBy {
  id: string;
  type: string;
  card: DepCard;
}

export function DependenciesSection({
  cardId,
  boardId,
}: {
  cardId: string;
  boardId: string;
}) {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [dependedOnBy, setDependedOnBy] = useState<DependedOnBy[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [boardCards, setBoardCards] = useState<DepCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [selectedType, setSelectedType] = useState("DEPENDS_ON");

  const fetchDeps = useCallback(async () => {
    try {
      const res = await fetch(`/api/cards/${cardId}/dependencies`);
      const data = await res.json();
      setDependencies(data.dependencies || []);
      setDependedOnBy(data.dependedOnBy || []);
    } catch {
      /* ignore */
    }
  }, [cardId]);

  useEffect(() => {
    fetchDeps();
  }, [fetchDeps]);

  async function loadBoardCards() {
    try {
      const res = await fetch(`/api/boards/${boardId}`);
      const board = await res.json();
      const cards: DepCard[] = [];
      board.columns?.forEach((col: { title: string; cards: { id: string; title: string }[] }) => {
        col.cards?.forEach((c) => {
          if (c.id !== cardId) {
            cards.push({
              id: c.id,
              title: c.title,
              column: { title: col.title },
            });
          }
        });
      });
      setBoardCards(cards);
    } catch {
      /* ignore */
    }
  }

  async function addDependency() {
    if (!selectedCardId) return;
    await fetch(`/api/cards/${cardId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dependsOnId: selectedCardId,
        type: selectedType,
      }),
    });
    setSelectedCardId("");
    setShowAdd(false);
    fetchDeps();
  }

  async function removeDependency(dependsOnId: string) {
    await fetch(
      `/api/cards/${cardId}/dependencies?dependsOnId=${dependsOnId}`,
      { method: "DELETE" }
    );
    fetchDeps();
  }

  const typeColors: Record<string, string> = {
    DEPENDS_ON: "bg-amber-100 text-amber-700",
    BLOCKS: "bg-red-100 text-red-700",
    RELATED: "bg-blue-100 text-blue-700",
  };

  const typeLabels: Record<string, string> = {
    DEPENDS_ON: "Depends on",
    BLOCKS: "Blocks",
    RELATED: "Related to",
  };

  const hasAny = dependencies.length > 0 || dependedOnBy.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <GitBranch className="h-4 w-4" />
          Dependencies
        </h4>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => {
            setShowAdd(!showAdd);
            if (!showAdd) loadBoardCards();
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {showAdd && (
        <div className="mb-3 p-2 rounded-lg bg-surface border border-gray-200 space-y-2">
          <Select value={selectedType} onValueChange={(val) => val && setSelectedType(val)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DEPENDS_ON">Depends on</SelectItem>
              <SelectItem value="BLOCKS">Blocks</SelectItem>
              <SelectItem value="RELATED">Related to</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCardId} onValueChange={(val) => val && setSelectedCardId(val)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select a card..." />
            </SelectTrigger>
            <SelectContent>
              {boardCards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="truncate">{c.title}</span>
                  <span className="ml-2 text-xs text-secondary">
                    ({c.column?.title})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={addDependency}
              disabled={!selectedCardId}
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {hasAny ? (
        <div className="space-y-1.5">
          {dependencies.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center gap-2 text-xs p-1.5 rounded bg-surface group"
            >
              <ArrowRight className="h-3 w-3 text-secondary shrink-0" />
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${typeColors[dep.type] || ""}`}
              >
                {typeLabels[dep.type] || dep.type}
              </Badge>
              <span className="truncate flex-1 text-neutral-900">
                {dep.dependsOn.title}
              </span>
              {dep.dependsOn.column && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 shrink-0"
                >
                  {dep.dependsOn.column.title}
                </Badge>
              )}
              <button
                onClick={() => removeDependency(dep.dependsOn.id)}
                className="opacity-0 group-hover:opacity-100 text-secondary hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {dependedOnBy.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center gap-2 text-xs p-1.5 rounded bg-surface"
            >
              <ArrowLeft className="h-3 w-3 text-secondary shrink-0" />
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600"
              >
                Depended by
              </Badge>
              <span className="truncate flex-1 text-neutral-900">
                {dep.card.title}
              </span>
              {dep.card.column && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 shrink-0"
                >
                  {dep.card.column.title}
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showAdd && (
          <p className="text-xs text-secondary">No dependencies</p>
        )
      )}
    </div>
  );
}
