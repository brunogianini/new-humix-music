import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { searchAlbums } from "@/lib/spotify";
import { attachUserAlbumStatus } from "@/lib/albumAggregate";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await attachUserAlbumStatus(await searchAlbums(q), userId);
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Falha ao buscar álbuns no Spotify." },
      { status: 502 }
    );
  }
}
