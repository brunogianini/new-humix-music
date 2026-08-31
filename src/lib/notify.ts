import { prisma } from "@/lib/prisma";

export async function notifyFollowersOfListenLog(
  actorId: string,
  listenLogId: string,
  albumId: string
) {
  const followers = await prisma.follow.findMany({
    where: { followingId: actorId },
    select: { followerId: true },
  });
  if (followers.length === 0) return;
  await prisma.notification.createMany({
    data: followers.map((f) => ({
      recipientId: f.followerId,
      actorId,
      type: "LISTEN_LOG",
      albumId,
      listenLogId,
    })),
  });
}

export async function notifyFollowersOfNewList(actorId: string, listId: string) {
  const followers = await prisma.follow.findMany({
    where: { followingId: actorId },
    select: { followerId: true },
  });
  if (followers.length === 0) return;
  await prisma.notification.createMany({
    data: followers.map((f) => ({
      recipientId: f.followerId,
      actorId,
      type: "LIST_CREATED",
      listId,
    })),
  });
}

export async function notifyFollowed(actorId: string, recipientId: string) {
  await prisma.notification.create({
    data: { recipientId, actorId, type: "FOLLOW" },
  });
}

export async function notifyRecommended(actorId: string, recipientId: string, albumId: string) {
  await prisma.notification.create({
    data: { recipientId, actorId, type: "RECOMMENDATION", albumId },
  });
}

export async function notifyRecommendationCompleted(
  actorId: string,
  recipientId: string,
  albumId: string
) {
  await prisma.notification.create({
    data: { recipientId, actorId, type: "RECOMMENDATION_COMPLETED", albumId },
  });
}

export async function notifyShamed(actorId: string, recipientId: string, albumId: string) {
  await prisma.notification.create({
    data: { recipientId, actorId, type: "SHAME_NOTE", albumId },
  });
}
