"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeft, Check, Loader2 } from "lucide-react";

interface Board {
  id: string;
  name: string;
  columns?: { id: string; title: string; position: number }[];
}

export function MoveToBoard({
  cardId,
  currentBoardId,
  onMoved,
}: {
  cardId: string;
  currentBoardId: string;
  onMoved: () => void;
}) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [showSelect, setShowSelect] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    if (showSelect && boards.length === 0) {
      fetch("/api/boards")
        .then((r) => r.json())
        .then((data) => {
          const otherBoards = (Array.isArray(data) ? data : []).filter(
            (b: Board) => b.id !== currentBoardId
          );
          setBoards(otherBoards);
        })
        .catch(() => setBoards([]));
    }
  }, [showSelect, boards.length, currentBoardId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleMove(targetBoardId: any) {
    if (!targetBoardId || typeof targetBoardId !== "string") return;
    setMoving(true);
    try {
      // Fetch the target board's columns to get the first one
      const res = await fetch(`/api/boards/${targetBoardId}`);
      const board = await res.json();
      const columns = board.columns || [];
      if (columns.length === 0) {
        setMoving(false);
        return;
      }
      // Sort by position and pick the first column
      const sorted = [...columns].sort(
        (a: { position: number }, b: { position: number }) =>
          a.position - b.position
      );
      const firstColumnId = sorted[0].id;

      // Move the card to the first column of the target board
      await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: firstColumnId }),
      });

      setMoved(true);
      setTimeout(() => {
        onMoved();
      }, 1000);
    } catch (err) {
      console.error("Failed to move card:", err);
    } finally {
      setMoving(false);
    }
  }

  if (moved) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm px-3 py-1.5">
        <Check className="h-4 w-4" />
        <span>Card moved!</span>
      </div>
    );
  }

  if (!showSelect) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-secondary"
        onClick={() => setShowSelect(true)}
      >
        <ArrowRightLeft className="h-4 w-4" />
        Move to Board
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-secondary px-1">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        <span>Move to Board</span>
      </div>
      <Select
        onValueChange={(val) => handleMove(val)}
        disabled={moving || boards.length === 0}
      >
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue
            placeholder={
              moving
                ? "Moving..."
                : boards.length === 0
                ? "No other boards"
                : "Select board..."
            }
          />
        </SelectTrigger>
        <SelectContent>
          {boards.map((board) => (
            <SelectItem key={board.id} value={board.id}>
              {board.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {moving && (
        <div className="flex items-center gap-1 text-xs text-secondary px-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Moving card...</span>
        </div>
      )}
    </div>
  );
}
