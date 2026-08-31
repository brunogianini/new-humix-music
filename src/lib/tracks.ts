import { prisma } from "@/lib/prisma";
import { getAlbumTracks as fetchSpotifyTracks } from "@/lib/spotify";
import type { TrackDTO } from "@/lib/types";

// Tracks are shared/global per Album (same reasoning as Album itself — see
// albums.ts) so the tracklist is cached once and shared across users.
// Fetched from Spotify lazily, on first view, and cached locally from then on.
export async function ensureTracksForAlbum(album: { id: string; mbid: string }) {
  const existing = await prisma.track.findMany({
    where: { albumId: album.id },
    orderBy: { trackNumber: "asc" },
  });
  if (existing.length > 0) return existing;

  const spotifyTracks = await fetchSpotifyTracks(album.mbid);
  if (spotifyTracks.length === 0) return [];

  await prisma.track.createMany({
    data: spotifyTracks.map((t) => ({
      albumId: album.id,
      spotifyId: t.id,
      title: t.title,
      trackNumber: t.trackNumber,
      durationMs: t.durationMs,
    })),
  });

  return prisma.track.findMany({
    where: { albumId: album.id },
    orderBy: { trackNumber: "asc" },
  });
}

export async function getTracks(albumId: string): Promise<TrackDTO[]> {
  const tracks = await prisma.track.findMany({
    where: { albumId },
    orderBy: { trackNumber: "asc" },
  });

  return tracks.map((t) => ({
    id: t.id,
    title: t.title,
    trackNumber: t.trackNumber,
    durationMs: t.durationMs,
  }));
}
