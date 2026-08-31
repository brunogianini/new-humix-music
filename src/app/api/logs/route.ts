import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { logCreateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { notifyFollowersOfListenLog, notifyRecommendationCompleted } from "@/lib/notify";
import type { DiaryEntryDTO } from "@/lib/types";

// A review (not just a rating) fulfills any pending recommendation a friend
// sent for this album, as long as it's written before the 7-day deadline.
// One review can fulfill recommendations from several friends at once.
async function fulfillRecommendations(userId: string, albumId: string, logId: string, review: string | null) {
  if (!review) return;

  const pending = await prisma.albumRecommendation.findMany({
    where: { toUserId: userId, albumId, listenLogId: null, expiresAt: { gte: new Date() } },
  });
  if (pending.length === 0) return;

  const now = new Date();
  await prisma.albumRecommendation.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { listenLogId: logId, completedAt: now },
  });

  for (const rec of pending) {
    await notifyRecommendationCompleted(userId, rec.fromUserId, albumId);
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const logs = await prisma.listenLog.findMany({
    where: { userId },
    include: { album: true },
    orderBy: [{ listenedOn: "desc" }, { createdAt: "desc" }],
  });

  const result: DiaryEntryDTO[] = logs.map((l) => ({
    id: l.id,
    albumId: l.albumId,
    rating: l.rating,
    review: l.review,
    listenedOn: l.listenedOn.toISOString(),
    relisten: l.relisten,
    createdAt: l.createdAt.toISOString(),
    album: {
      id: l.album.id,
      mbid: l.album.mbid,
      title: l.album.title,
      artist: l.album.artist,
      coverUrl: l.album.coverUrl,
      releaseDate: l.album.releaseDate,
    },
  }));

  return NextResponse.json({ logs: result });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = logCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { albumId, rating, review, listenedOn, relisten } = parsed.data;

  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album) {
    return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
  }

  const log = await prisma.listenLog.create({
    data: {
      albumId,
      userId,
      rating: rating ?? null,
      review: review?.trim() ? review.trim() : null,
      listenedOn: listenedOn ? new Date(listenedOn) : new Date(),
      relisten: relisten ?? false,
    },
  });

  await notifyFollowersOfListenLog(userId, log.id, albumId);
  await fulfillRecommendations(userId, albumId, log.id, log.review);

  return NextResponse.json({ log });
}
