import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import type { DiaryEntryDTO } from "@/lib/types";
import { attachAlbumRatings, toAlbumWithStats } from "@/lib/albumAggregate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;

  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      status: { where: { userId } },
      logs: { where: { userId }, orderBy: { listenedOn: "desc" } },
    },
  });

  if (!album) {
    return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
  }

  const [stats] = await attachAlbumRatings([toAlbumWithStats(album)], userId);

  const logs: DiaryEntryDTO[] = album.logs.map((l) => ({
    id: l.id,
    albumId: l.albumId,
    rating: l.rating,
    review: l.review,
    listenedOn: l.listenedOn.toISOString(),
    relisten: l.relisten,
    createdAt: l.createdAt.toISOString(),
    album: {
      id: album.id,
      mbid: album.mbid,
      title: album.title,
      artist: album.artist,
      coverUrl: album.coverUrl,
      releaseDate: album.releaseDate,
    },
  }));

  return NextResponse.json({ album: stats, logs });
}

// Album is a shared/global row (needed for the pooled community rating), so
// "removing" it for one user must never delete it or other users' data —
// only the calling user's own log/status/list-entry rows for that album.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;

  await prisma.$transaction([
    prisma.listenLog.deleteMany({ where: { albumId: id, userId } }),
    prisma.albumStatus.deleteMany({ where: { albumId: id, userId } }),
    prisma.listEntry.deleteMany({ where: { albumId: id, list: { userId } } }),
  ]);

  return NextResponse.json({ ok: true });
}
