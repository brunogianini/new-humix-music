import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import type { DiaryEntryDTO } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);

  const logs = await prisma.listenLog.findMany({
    where: { userId: id },
    include: { album: true },
    orderBy: [{ listenedOn: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
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
