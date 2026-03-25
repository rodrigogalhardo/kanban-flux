import { prisma } from "@/lib/prisma";

export async function buildProjectGraph(projectId: string) {
  // Clear existing graph for this project
  await prisma.graphEdge.deleteMany({ where: { projectId } });
  await prisma.graphNode.deleteMany({ where: { projectId } });

  // Get project with all boards, columns, cards, members, labels
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      boards: {
        include: {
          columns: {
            include: {
              cards: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: { id: true, name: true, isAgent: true },
                      },
                    },
                  },
                  labels: { include: { label: true } },
                  checklists: { include: { items: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const nodes: { id: string; entityId: string; type: string }[] = [];
  const edges: {
    sourceEntityId: string;
    targetEntityId: string;
    relation: string;
    weight?: number;
  }[] = [];

  // Create nodes for each card (task)
  for (const board of project.boards) {
    for (const column of board.columns) {
      for (const card of column.cards) {
        // Task node
        const taskNode = await prisma.graphNode.create({
          data: {
            projectId,
            name: card.title,
            type: "task",
            summary: card.description || undefined,
            metadata: {
              cardId: card.id,
              columnTitle: column.title,
              boardName: board.name,
              dueDate: card.dueDate,
              labels: card.labels.map((l) => l.label.name),
              checklistProgress: card.checklists.reduce(
                (acc, cl) => {
                  const total = cl.items.length;
                  const done = cl.items.filter((i) => i.completed).length;
                  return { total: acc.total + total, done: acc.done + done };
                },
                { total: 0, done: 0 }
              ),
            },
          },
        });
        nodes.push({ id: taskNode.id, entityId: card.id, type: "task" });

        // Create agent nodes and ASSIGNED_TO edges for each member
        for (const member of card.members) {
          if (member.user.isAgent) {
            // Check if agent node already exists
            let agentNode = nodes.find(
              (n) => n.entityId === member.user.id && n.type === "agent"
            );
            if (!agentNode) {
              const created = await prisma.graphNode.create({
                data: {
                  projectId,
                  name: member.user.name,
                  type: "agent",
                  metadata: { userId: member.user.id, isAgent: true },
                },
              });
              agentNode = {
                id: created.id,
                entityId: member.user.id,
                type: "agent",
              };
              nodes.push(agentNode);
            }
            // ASSIGNED_TO edge
            edges.push({
              sourceEntityId: agentNode.entityId,
              targetEntityId: card.id,
              relation: "ASSIGNED_TO",
            });
          }
        }

        // Create label nodes and edges
        for (const labelEntry of card.labels) {
          let labelNode = nodes.find(
            (n) => n.entityId === labelEntry.label.id && n.type === "label"
          );
          if (!labelNode) {
            const created = await prisma.graphNode.create({
              data: {
                projectId,
                name: labelEntry.label.name,
                type: "label",
                metadata: { color: labelEntry.label.color },
              },
            });
            labelNode = {
              id: created.id,
              entityId: labelEntry.label.id,
              type: "label",
            };
            nodes.push(labelNode);
          }
          edges.push({
            sourceEntityId: card.id,
            targetEntityId: labelEntry.label.id,
            relation: "TAGGED_WITH",
          });
        }
      }
    }
  }

  // Create all edges
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.entityId === edge.sourceEntityId);
    const targetNode = nodes.find((n) => n.entityId === edge.targetEntityId);
    if (sourceNode && targetNode) {
      await prisma.graphEdge.create({
        data: {
          projectId,
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          relation: edge.relation,
          weight: edge.weight || 1.0,
        },
      });
    }
  }

  // Return stats
  const nodeCount = await prisma.graphNode.count({ where: { projectId } });
  const edgeCount = await prisma.graphEdge.count({ where: { projectId } });

  return { nodeCount, edgeCount, projectId };
}

export async function getProjectGraph(projectId: string) {
  const nodes = await prisma.graphNode.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  const edges = await prisma.graphEdge.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  return { nodes, edges };
}
