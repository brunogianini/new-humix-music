import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { albumInputSchema } from "@/lib/validation";
import { ensureAlbum } from "@/lib/albums";
import { prisma } from "@/lib/prisma";
import { attachAlbumRatings, toAlbumWithStats } from "@/lib/albumAggregate";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const albums = await prisma.album.findMany({
    where: {
      OR: [
        { logs: { some: { userId } } },
        { status: { some: { userId, liked: true } } },
        { status: { some: { userId, wantToListen: true } } },
      ],
    },
    include: {
      logs: { where: { userId } },
      status: { where: { userId } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = await attachAlbumRatings(albums.map(toAlbumWithStats), userId);
  return NextResponse.json({ albums: result });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = albumInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const album = await ensureAlbum(parsed.data);
  return NextResponse.json({ album });
}
