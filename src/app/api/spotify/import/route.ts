import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { ensureAlbum } from "@/lib/albums";
import { getArtistDiscography } from "@/lib/spotify";
import { fetchFollowedArtists, fetchSavedAlbums, refreshAccessToken } from "@/lib/spotifyAuth";

const MAX_ALBUMS_PER_ARTIST = 5;

async function addToLibrary(userId: string, album: { id: string }) {
  await prisma.albumStatus.upsert({
    where: { albumId_userId: { albumId: album.id, userId } },
    update: { wantToListen: true },
    create: { albumId: album.id, userId, wantToListen: true },
  });
}

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const account = await prisma.externalAccount.findUnique({
    where: { userId_provider: { userId, provider: "SPOTIFY" } },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Conecte sua conta do Spotify primeiro." },
      { status: 400 }
    );
  }

  let accessToken = account.accessToken;
  if (account.expiresAt.getTime() < Date.now() + 60_000) {
    try {
      const refreshed = await refreshAccessToken(account.refreshToken);
      accessToken = refreshed.accessToken;
      await prisma.externalAccount.update({
        where: { id: account.id },
        data: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
        },
      });
    } catch (err) {
      console.error(err);
      return NextResponse.json(
        { error: "Sessão do Spotify expirou. Reconecte sua conta." },
        { status: 401 }
      );
    }
  }

  try {
    const [savedAlbums, followedArtists] = await Promise.all([
      fetchSavedAlbums(accessToken),
      fetchFollowedArtists(accessToken),
    ]);

    let importedAlbums = 0;
    for (const item of savedAlbums) {
      const album = await ensureAlbum(item);
      await addToLibrary(userId, album);
      importedAlbums++;
    }

    let importedFromArtists = 0;
    for (const artist of followedArtists) {
      try {
        const { releases } = await getArtistDiscography({ id: artist.id, name: artist.name });
        for (const release of releases.slice(0, MAX_ALBUMS_PER_ARTIST)) {
          const album = await ensureAlbum({
            mbid: release.mbid,
            title: release.title,
            artist: release.artist,
            coverUrl: release.coverUrl,
            releaseDate: release.releaseDate,
          });
          await addToLibrary(userId, album);
          importedFromArtists++;
        }
      } catch (err) {
        console.error(`Falha ao importar discografia de ${artist.name}`, err);
      }
    }

    return NextResponse.json({ importedAlbums, importedFromArtists });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Falha ao importar do Spotify." }, { status: 502 });
  }
}
