import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_WORKSPACE_ID = "default-workspace";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const template = await prisma.boardTemplate.findUnique({
    where: { id: params.id },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Parse optional projectId from body
  let projectId: string | undefined;
  try {
    const body = await req.json();
    projectId = body.projectId;
  } catch {
    // no body provided, that's fine
  }

  // Ensure workspace exists
  const workspace = await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    create: { id: DEFAULT_WORKSPACE_ID, name: "Default Workspace" },
    update: {},
  });

  // Create the board
  const board = await prisma.board.create({
    data: {
      name: template.name,
      description: template.description,
      workspaceId: workspace.id,
      projectId: projectId || null,
    },
  });

  // Create columns from template
  const columnNames = template.columns as string[];
  const createdColumns: Record<string, string> = {};

  for (let i = 0; i < columnNames.length; i++) {
    const col = await prisma.column.create({
      data: {
        title: columnNames[i],
        position: i,
        boardId: board.id,
      },
    });
    createdColumns[columnNames[i]] = col.id;
  }

  // Create cards from cardTemplates in the first column (Todo)
  const cardTemplates = (template.cardTemplates as Record<string, unknown>[]) || [];
  const todoColumnId = createdColumns[columnNames[0]];

  for (let i = 0; i < cardTemplates.length; i++) {
    const ct = cardTemplates[i];
    await prisma.card.create({
      data: {
        title: ct.title as string,
        description: (ct.description as string) || null,
        priority: (ct.priority as number) ?? 2,
        position: i,
        columnId: todoColumnId,
      },
    });
  }

  return NextResponse.json(
    {
      templateName: template.name,
      boardId: board.id,
      boardName: board.name,
      columnsCreated: columnNames.length,
      cardsCreated: cardTemplates.length,
    },
    { status: 201 }
  );
}
