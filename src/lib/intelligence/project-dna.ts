import { prisma } from "@/lib/prisma";

export async function generateProjectDNA(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      boards: {
        include: {
          columns: {
            include: {
              cards: {
                include: {
                  labels: { include: { label: true } },
                  attachments: { select: { filename: true, fileType: true } },
                  comments: { select: { text: true }, take: 20 },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return null;

  // Extract tech stack from labels and file extensions
  const techStack = new Set<string>();
  const patterns = new Set<string>();
  let totalCards = 0,
    doneCards = 0;

  for (const board of project.boards) {
    for (const col of board.columns) {
      for (const card of col.cards) {
        totalCards++;
        if (col.title.toLowerCase() === "done") doneCards++;
        card.labels.forEach((l) => techStack.add(l.label.name));
        card.attachments.forEach((a) => {
          const ext = a.filename.split(".").pop() || "";
          if (["ts", "tsx"].includes(ext)) techStack.add("TypeScript");
          if (["js", "jsx"].includes(ext)) techStack.add("JavaScript");
          if (["py"].includes(ext)) techStack.add("Python");
          if (["prisma"].includes(ext)) {
            techStack.add("Prisma");
            patterns.add("Prisma ORM");
          }
          if (["sql"].includes(ext)) techStack.add("SQL");
        });
        // Extract patterns from comments
        const allText = card.comments
          .map((c) => c.text)
          .join(" ")
          .toLowerCase();
        if (allText.includes("rest api")) patterns.add("REST API");
        if (allText.includes("graphql")) patterns.add("GraphQL");
        if (allText.includes("microservice")) patterns.add("Microservices");
        if (allText.includes("docker")) patterns.add("Docker");
        if (allText.includes("tailwind")) {
          techStack.add("Tailwind CSS");
        }
        if (allText.includes("next.js") || allText.includes("nextjs"))
          techStack.add("Next.js");
        if (allText.includes("react")) techStack.add("React");
      }
    }
  }

  const successRate = totalCards > 0 ? (doneCards / totalCards) * 100 : 0;

  const dna = await prisma.projectDNA.upsert({
    where: { projectId },
    create: {
      projectId,
      techStack: Array.from(techStack),
      patterns: Array.from(patterns),
      successRate,
    },
    update: {
      techStack: Array.from(techStack),
      patterns: Array.from(patterns),
      successRate,
    },
  });

  return dna;
}
