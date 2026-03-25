import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  cardId?: string;
  boardId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      ...data,
      metadata: data.metadata
        ? (data.metadata as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

export async function notifyCardMembers(
  cardId: string,
  excludeUserId: string,
  data: {
    type: string;
    title: string;
    message: string;
  }
) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { members: { select: { userId: true } } },
  });
  if (!card) return;

  const userIds = card.members
    .map((m) => m.userId)
    .filter((id) => id !== excludeUserId);

  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      cardId,
    })),
  });
}
