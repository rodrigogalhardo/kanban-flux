import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-time migration endpoint: adds "QA" and "Bug" columns to all boards
 * that don't already have them. Safe to call multiple times.
 *
 * POST /api/boards/migrate-columns
 */
export async function POST() {
  const boards = await prisma.board.findMany({
    include: {
      columns: { orderBy: { position: "asc" } },
    },
  });

  const results: { boardId: string; boardName: string; added: string[] }[] = [];

  for (const board of boards) {
    const columnTitles = board.columns.map((c) => c.title.toLowerCase());
    const maxPosition = board.columns.reduce(
      (max, c) => Math.max(max, c.position),
      -1
    );
    const added: string[] = [];
    let nextPosition = maxPosition + 1;

    // Add QA column if missing (insert before Done if possible)
    if (!columnTitles.includes("qa")) {
      // Find Done column position so we can insert QA before it
      const doneCol = board.columns.find(
        (c) => c.title.toLowerCase() === "done"
      );
      if (doneCol) {
        // Shift Done and Bug (if exists) up by 1
        await prisma.column.updateMany({
          where: {
            boardId: board.id,
            position: { gte: doneCol.position },
          },
          data: { position: { increment: 1 } },
        });
        await prisma.column.create({
          data: {
            title: "QA",
            position: doneCol.position,
            boardId: board.id,
          },
        });
      } else {
        await prisma.column.create({
          data: {
            title: "QA",
            position: nextPosition,
            boardId: board.id,
          },
        });
        nextPosition++;
      }
      added.push("QA");
    }

    // Re-fetch columns after potential QA insert to get updated positions
    const updatedColumns = await prisma.column.findMany({
      where: { boardId: board.id },
      orderBy: { position: "asc" },
    });
    const updatedTitles = updatedColumns.map((c) => c.title.toLowerCase());
    const updatedMaxPos = updatedColumns.reduce(
      (max, c) => Math.max(max, c.position),
      -1
    );

    // Add Bug column if missing (at the end)
    if (!updatedTitles.includes("bug")) {
      await prisma.column.create({
        data: {
          title: "Bug",
          position: updatedMaxPos + 1,
          boardId: board.id,
        },
      });
      added.push("Bug");
    }

    if (added.length > 0) {
      results.push({
        boardId: board.id,
        boardName: board.name,
        added,
      });
    }
  }

  return NextResponse.json({
    message: `Migration complete. Updated ${results.length} board(s).`,
    results,
  });
}
