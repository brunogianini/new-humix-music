import { prisma } from "@/lib/prisma";
import type { AlbumDTO, FriendshipDTO, RecommendationDTO, RecommendationStatus, ShameNoteDTO } from "@/lib/types";

export async function isMutualFollow(userAId: string, userBId: string): Promise<boolean> {
  const [aFollowsB, bFollowsA] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userAId, followingId: userBId } },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userBId, followingId: userAId } },
    }),
  ]);
  return aFollowsB != null && bFollowsA != null;
}

type RecommendationRow = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  message: string | null;
  listenLogId: string | null;
  completedAt: Date | null;
  album: {
    id: string;
    mbid: string;
    title: string;
    artist: string;
    coverUrl: string | null;
    releaseDate: string | null;
  };
  fromUser: { id: string; name: string | null; avatarUrl: string | null };
  toUser: { id: string; name: string | null; avatarUrl: string | null };
  shameNote: { id: string; text: string; createdAt: Date } | null;
};

const RECOMMENDATION_INCLUDE = {
  album: true,
  fromUser: { select: { id: true, name: true, avatarUrl: true } },
  toUser: { select: { id: true, name: true, avatarUrl: true } },
  shameNote: true,
} as const;

export function recommendationStatus(rec: {
  listenLogId: string | null;
  expiresAt: Date;
  shameNote: unknown | null;
}): RecommendationStatus {
  if (rec.listenLogId != null) return "COMPLETED";
  if (rec.expiresAt.getTime() >= Date.now()) return "PENDING";
  return rec.shameNote != null ? "SHAMED" : "EXPIRED";
}

function toAlbumDTO(a: RecommendationRow["album"]): AlbumDTO {
  return {
    id: a.id,
    mbid: a.mbid,
    title: a.title,
    artist: a.artist,
    coverUrl: a.coverUrl,
    releaseDate: a.releaseDate,
  };
}

export function toRecommendationDTO(rec: RecommendationRow): RecommendationDTO {
  return {
    id: rec.id,
    status: recommendationStatus(rec),
    createdAt: rec.createdAt.toISOString(),
    expiresAt: rec.expiresAt.toISOString(),
    completedAt: rec.completedAt?.toISOString() ?? null,
    message: rec.message,
    album: toAlbumDTO(rec.album),
    fromUser: rec.fromUser,
    toUser: rec.toUser,
    shameNote: rec.shameNote
      ? { id: rec.shameNote.id, text: rec.shameNote.text, createdAt: rec.shameNote.createdAt.toISOString() }
      : null,
  };
}

export async function listRecommendations(
  userId: string,
  scope: "received" | "sent"
): Promise<RecommendationDTO[]> {
  const rows = await prisma.albumRecommendation.findMany({
    where: scope === "received" ? { toUserId: userId } : { fromUserId: userId },
    include: RECOMMENDATION_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecommendationDTO);
}

// Points/streak are derived from the pair's recommendation history rather
// than a mutable counter, so there's nothing to keep in sync when a
// recommendation expires (same lazy-compute approach as lib/streak.ts).
export async function getFriendship(userAId: string, userBId: string): Promise<FriendshipDTO> {
  const rows = await prisma.albumRecommendation.findMany({
    where: {
      OR: [
        { fromUserId: userAId, toUserId: userBId },
        { fromUserId: userBId, toUserId: userAId },
      ],
    },
    select: { listenLogId: true, expiresAt: true, shameNote: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  const points = rows.filter((r) => r.listenLogId != null).length;

  const resolved = rows
    .map((r) => recommendationStatus(r))
    .filter((s): s is "COMPLETED" | "EXPIRED" | "SHAMED" => s !== "PENDING");

  let streak = 0;
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (resolved[i] !== "COMPLETED") break;
    streak += 1;
  }

  return { points, streak };
}

export async function getShameNotesForUser(userId: string): Promise<ShameNoteDTO[]> {
  const notes = await prisma.shameNote.findMany({
    where: { targetUserId: userId },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  return notes.map((n) => ({
    id: n.id,
    text: n.text,
    createdAt: n.createdAt.toISOString(),
    author: n.author,
  }));
}
