import { prisma } from "@/lib/prisma";

export async function autoPrioritizeBoard(boardId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        include: {
          cards: {
            include: {
              dependencies: true,
              dependedOnBy: true,
            },
          },
        },
      },
    },
  });

  if (!board) return;

  const updated: { cardId: string; oldPriority: number; newPriority: number }[] = [];

  for (const col of board.columns) {
    for (const card of col.cards) {
      let suggestedPriority = 2; // default P2

      // Cards that block others should be higher priority
      if (card.dependedOnBy.length > 0) {
        suggestedPriority = Math.max(0, 2 - card.dependedOnBy.length);
      }

      // Cards with due dates approaching should be higher priority
      if (card.dueDate) {
        const daysUntilDue = Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 1) suggestedPriority = 0;
        else if (daysUntilDue <= 3) suggestedPriority = Math.min(suggestedPriority, 1);
        else if (daysUntilDue <= 7) suggestedPriority = Math.min(suggestedPriority, 2);
      }

      // Cards with many dependencies (blockers) should be lower priority
      if (card.dependencies.length > 2) {
        suggestedPriority = Math.max(suggestedPriority, 2);
      }

      // Update if priority changed
      if (suggestedPriority !== card.priority) {
        await prisma.card.update({
          where: { id: card.id },
          data: { priority: suggestedPriority },
        });

        // Record history for the auto-prioritization
        await prisma.cardHistory.create({
          data: {
            cardId: card.id,
            action: "priority_changed",
            details: `Auto-prioritized from P${card.priority} to P${suggestedPriority}`,
            metadata: { oldPriority: card.priority, newPriority: suggestedPriority, source: "auto-prioritize" },
          },
        });

        updated.push({
          cardId: card.id,
          oldPriority: card.priority,
          newPriority: suggestedPriority,
        });
      }
    }
  }

  return { boardId, cardsUpdated: updated.length, changes: updated };
}
