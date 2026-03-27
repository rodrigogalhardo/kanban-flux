import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        boards: {
          include: {
            columns: {
              orderBy: { position: "asc" },
              include: {
                cards: {
                  include: {
                    labels: { include: { label: true } },
                    members: { include: { user: { select: { name: true, isAgent: true } } } },
                    checklists: { include: { items: true } },
                    comments: { include: { user: { select: { name: true } } } },
                    attachments: { select: { filename: true, fileType: true, content: true } },
                    dependencies: { include: { dependsOn: { select: { title: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      exportVersion: "1.0",
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description,
        githubRepo: project.githubRepo,
        status: project.status,
      },
      boards: project.boards.map(b => ({
        name: b.name,
        columns: b.columns.map(c => ({
          title: c.title,
          position: c.position,
          cards: c.cards.map(card => ({
            title: card.title,
            description: card.description,
            priority: card.priority,
            dueDate: card.dueDate,
            labels: card.labels.map(l => l.label.name),
            agents: card.members.filter(m => m.user.isAgent).map(m => m.user.name),
            checklists: card.checklists.map(cl => ({
              title: cl.title,
              items: cl.items.map(i => ({ text: i.text, completed: i.completed })),
            })),
            comments: card.comments.map(cm => ({ user: cm.user.name, text: cm.text })),
            attachments: card.attachments.map(a => ({ filename: a.filename, type: a.fileType })),
            dependencies: card.dependencies.map(d => d.dependsOn.title),
          })),
        })),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
}
