import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { getArtistDiscography } from "@/lib/spotify";
import { attachUserAlbumStatus } from "@/lib/albumAggregate";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  const name = req.nextUrl.searchParams.get("name") ?? "";

  if (!id && !name.trim()) {
    return NextResponse.json({ error: "Informe o artista." }, { status: 400 });
  }

  try {
    const data = await getArtistDiscography({ id, name });
    const releases = await attachUserAlbumStatus(data.releases, userId);
    return NextResponse.json({ ...data, releases });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Falha ao buscar o artista no Spotify." },
      { status: 502 }
    );
  }
}
