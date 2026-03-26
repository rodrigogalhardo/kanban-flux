"use client";

import { useState, useCallback } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { KanbanColumn } from "./column";
import { CardDetailModal } from "@/components/card/card-detail-modal";
import type { BoardWithColumns, CardWithDetails } from "@/types";

export function BoardView({
  initialBoard,
}: {
  initialBoard: BoardWithColumns;
}) {
  const [board, setBoard] = useState(initialBoard);
  const [selectedCard, setSelectedCard] = useState<CardWithDetails | null>(null);

  const refreshBoard = useCallback(async () => {
    const res = await fetch(`/api/boards/${board.id}`);
    const data = await res.json();
    setBoard(data);
  }, [board.id]);

  async function onDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const newColumns = board.columns.map((col) => ({
      ...col,
      cards: [...col.cards],
    }));
    const sourceCol = newColumns.find((c) => c.id === source.droppableId)!;
    const destCol = newColumns.find((c) => c.id === destination.droppableId)!;

    const [movedCard] = sourceCol.cards.splice(source.index, 1);
    destCol.cards.splice(destination.index, 0, {
      ...movedCard,
      columnId: destCol.id,
    });

    sourceCol.cards.forEach((card, i) => (card.position = i));
    destCol.cards.forEach((card, i) => (card.position = i));

    setBoard({ ...board, columns: newColumns });

    const cardsToUpdate = [
      ...sourceCol.cards,
      ...(source.droppableId !== destination.droppableId ? destCol.cards : []),
    ];

    await fetch("/api/cards/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: cardsToUpdate.map((c) => ({
          id: c.id,
          columnId: c.columnId,
          position: c.position,
        })),
      }),
    });
  }

  async function handleAddCard(columnId: string, title: string) {
    await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, columnId }),
    });
    refreshBoard();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {board.name}
        </h1>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              onCardClick={setSelectedCard}
              onAddCard={handleAddCard}
            />
          ))}
        </div>
      </DragDropContext>

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          open={!!selectedCard}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCard(null);
              refreshBoard();
            }
          }}
          boardId={board.id}
        />
      )}
    </div>
  );
}
