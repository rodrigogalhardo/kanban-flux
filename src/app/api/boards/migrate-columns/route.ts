import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Migration endpoint: ensures all boards have the correct column structure:
 * Todo (0) → Brainstorming (1) → In Progress (2) → QA (3) → Bug (4) → Done (5)
 *
 * - Renames "To Do" to "Todo" if needed
 * - Adds "Brainstorming" column (position 1) if missing
 * - Adds "QA" and "Bug" columns if missing
 * - Reorders columns to match the correct workflow
 *
 * Safe to call multiple times.
 *
 * POST /api/boards/migrate-columns
 */
export async function POST() {
  const boards = await prisma.board.findMany({
    include: {
      columns: { orderBy: { position: "asc" } },
    },
  });

  const TARGET_COLUMNS = ["Todo", "Brainstorming", "In Progress", "QA", "Bug", "Done"];

  const results: { boardId: string; boardName: string; changes: string[] }[] = [];

  for (const board of boards) {
    const changes: string[] = [];

    // Step 1: Rename "To Do" to "Todo" if it exists
    const toDoCol = board.columns.find(
      (c) => c.title.toLowerCase() === "to do"
    );
    if (toDoCol) {
      await prisma.column.update({
        where: { id: toDoCol.id },
        data: { title: "Todo" },
      });
      changes.push('Renamed "To Do" → "Todo"');
    }

    // Re-fetch columns after potential rename
    let currentColumns = await prisma.column.findMany({
      where: { boardId: board.id },
      orderBy: { position: "asc" },
    });
    const currentTitles = currentColumns.map((c) => c.title.toLowerCase());

    // Step 2: Add missing columns
    // Check for Brainstorming
    if (!currentTitles.includes("brainstorming")) {
      // We'll add it and fix positions later
      await prisma.column.create({
        data: {
          title: "Brainstorming",
          position: 999, // temporary, will be fixed
          boardId: board.id,
        },
      });
      changes.push('Added "Brainstorming" column');
    }

    // Check for QA
    if (!currentTitles.includes("qa")) {
      await prisma.column.create({
        data: {
          title: "QA",
          position: 998,
          boardId: board.id,
        },
      });
      changes.push('Added "QA" column');
    }

    // Check for Bug
    if (!currentTitles.includes("bug")) {
      await prisma.column.create({
        data: {
          title: "Bug",
          position: 997,
          boardId: board.id,
        },
      });
      changes.push('Added "Bug" column');
    }

    // Check for Todo (might not exist if board never had "To Do" either)
    if (!currentTitles.includes("todo") && !toDoCol) {
      await prisma.column.create({
        data: {
          title: "Todo",
          position: 996,
          boardId: board.id,
        },
      });
      changes.push('Added "Todo" column');
    }

    // Check for In Progress
    if (!currentTitles.includes("in progress")) {
      await prisma.column.create({
        data: {
          title: "In Progress",
          position: 995,
          boardId: board.id,
        },
      });
      changes.push('Added "In Progress" column');
    }

    // Check for Done
    if (!currentTitles.includes("done")) {
      await prisma.column.create({
        data: {
          title: "Done",
          position: 994,
          boardId: board.id,
        },
      });
      changes.push('Added "Done" column');
    }

    // Step 3: Reorder all columns to match target order
    currentColumns = await prisma.column.findMany({
      where: { boardId: board.id },
      orderBy: { position: "asc" },
    });

    // Build a map of target column name (lowercase) → target position
    const targetPositionMap = new Map<string, number>();
    for (let i = 0; i < TARGET_COLUMNS.length; i++) {
      targetPositionMap.set(TARGET_COLUMNS[i].toLowerCase(), i);
    }

    // Separate known columns and any extra custom columns
    const knownColumns = currentColumns.filter((c) =>
      targetPositionMap.has(c.title.toLowerCase())
    );
    const customColumns = currentColumns.filter(
      (c) => !targetPositionMap.has(c.title.toLowerCase())
    );

    // Sort known columns by target position
    knownColumns.sort(
      (a, b) =>
        (targetPositionMap.get(a.title.toLowerCase()) ?? 99) -
        (targetPositionMap.get(b.title.toLowerCase()) ?? 99)
    );

    // Update positions: known columns first, then custom columns after
    let position = 0;
    for (const col of knownColumns) {
      if (col.position !== position) {
        await prisma.column.update({
          where: { id: col.id },
          data: { position },
        });
      }
      position++;
    }
    for (const col of customColumns) {
      if (col.position !== position) {
        await prisma.column.update({
          where: { id: col.id },
          data: { position },
        });
      }
      position++;
    }

    const positionsChanged = knownColumns.some(
      (col, i) => col.position !== i
    );
    if (positionsChanged) {
      changes.push("Reordered columns to: " + TARGET_COLUMNS.join(" → "));
    }

    if (changes.length > 0) {
      results.push({
        boardId: board.id,
        boardName: board.name,
        changes,
      });
    }
  }

  return NextResponse.json({
    message: `Migration complete. Updated ${results.length} of ${boards.length} board(s).`,
    targetOrder: TARGET_COLUMNS.join(" → "),
    results,
  });
}
