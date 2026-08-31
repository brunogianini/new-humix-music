import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { ensureTracksForAlbum, getTracks } from "@/lib/tracks";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;

  const album = await prisma.album.findUnique({ where: { id } });
  if (!album) {
    return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
  }

  try {
    await ensureTracksForAlbum(album);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Falha ao buscar as faixas no Spotify." }, { status: 502 });
  }

  const tracks = await getTracks(id);
  return NextResponse.json({ tracks });
}
