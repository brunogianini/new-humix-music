import { prisma } from "@/lib/prisma";
import type { AlbumWithStats } from "@/lib/types";
import type { SearchResult } from "@/lib/spotify";

type AlbumWithUserRelations = {
  id: string;
  mbid: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string | null;
  logs: { rating: number | null; listenedOn: Date }[];
  status: { liked: boolean; wantToListen: boolean }[];
};

// `status` is a to-many relation (one row per user) even though each caller
// only ever includes the current user's row, hence `status[0]`.
//
// avgRating/communityAvgRating/communityLogCount start out null/0 here —
// attachAlbumRatings() fills them in, since that requires a DB query.
export function toAlbumWithStats(album: AlbumWithUserRelations): AlbumWithStats {
  const lastListenedOn = album.logs.length
    ? album.logs.map((l) => l.listenedOn.toISOString()).sort().at(-1)!
    : null;
  const status = album.status[0];

  return {
    id: album.id,
    mbid: album.mbid,
    title: album.title,
    artist: album.artist,
    coverUrl: album.coverUrl,
    releaseDate: album.releaseDate,
    liked: status?.liked ?? false,
    wantToListen: status?.wantToListen ?? false,
    avgRating: null,
    logCount: album.logs.length,
    lastListenedOn,
    communityAvgRating: null,
    communityLogCount: 0,
  };
}

// Per-user average rating for an album, across that user's diary logs.
// Returns one map entry per user who has rated the album.
async function computePerUserRatings(albumIds: string[]): Promise<Map<string, Map<string, number>>> {
  const perAlbum = new Map<string, Map<string, number>>();

  if (albumIds.length === 0) return perAlbum;

  const logGroups = await prisma.listenLog.groupBy({
    by: ["albumId", "userId"],
    where: { albumId: { in: albumIds }, rating: { not: null } },
    _avg: { rating: true },
  });

  for (const g of logGroups) {
    if (g._avg.rating == null) continue;
    if (!perAlbum.has(g.albumId)) perAlbum.set(g.albumId, new Map());
    perAlbum.get(g.albumId)!.set(g.userId, g._avg.rating);
  }

  return perAlbum;
}

// Fills in avgRating (viewer's own rating) and the pooled community
// score/count for each album. Must run after toAlbumWithStats() since it
// needs one extra DB round-trip per batch.
export async function attachAlbumRatings(
  albums: AlbumWithStats[],
  viewerUserId: string
): Promise<AlbumWithStats[]> {
  if (albums.length === 0) return albums;

  const ids = albums.map((a) => a.id);
  const perAlbum = await computePerUserRatings(ids);

  return albums.map((a) => {
    const users = perAlbum.get(a.id);
    const viewerRating = users?.get(viewerUserId) ?? null;
    const allRatings = users ? [...users.values()] : [];
    const communityAvgRating = allRatings.length
      ? allRatings.reduce((s, v) => s + v, 0) / allRatings.length
      : null;

    return {
      ...a,
      avgRating: viewerRating,
      communityAvgRating,
      communityLogCount: allRatings.length,
    };
  });
}

// A user's single effective rating for one album (used by recommendations.ts
// to decide whether to suggest similar or alternative albums).
export async function getEffectiveUserAlbumRating(
  userId: string,
  albumId: string
): Promise<number | null> {
  const logAvg = await prisma.listenLog.aggregate({
    where: { userId, albumId, rating: { not: null } },
    _avg: { rating: true },
  });
  return logAvg._avg.rating ?? null;
}

// Spotify search/discography results are keyed by mbid (the Spotify album
// id) and carry no per-user state on their own. This joins them against
// this viewer's local AlbumStatus rows so already-saved releases show as
// liked/marked-to-listen instead of always rendering unmarked.
export async function attachUserAlbumStatus<T extends SearchResult>(
  results: T[],
  userId: string
): Promise<T[]> {
  if (results.length === 0) return results;

  const mbids = results.map((r) => r.mbid);
  const albums = await prisma.album.findMany({
    where: { mbid: { in: mbids } },
    select: { mbid: true, status: { where: { userId } } },
  });
  const byMbid = new Map(albums.map((a) => [a.mbid, a.status[0]]));

  return results.map((r) => {
    const status = byMbid.get(r.mbid);
    if (!status) return r;
    return { ...r, liked: status.liked, wantToListen: status.wantToListen };
  });
}
