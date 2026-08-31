import { prisma } from "@/lib/prisma";
import { getEffectiveUserAlbumRating } from "@/lib/albumAggregate";
import type { AlbumDTO, ForYouDTO, RelatedAlbumsDTO } from "@/lib/types";

// Rating scale is 0-10 (half-stars, see StarRating). >=7 is ~3.5+ stars,
// <=4 is ~2 stars or less.
const HIGH_RATING_THRESHOLD = 7;
const LOW_RATING_THRESHOLD = 4;
const RELATED_LIMIT = 8;
const FOR_YOU_LIMIT = 16;
// Same floor RelatedAlbums/PlatformStats use before trusting a pooled
// average — one lone 10/10 shouldn't dominate the "trending" fallback.
const MIN_COMMUNITY_LOGS = 2;

type AlbumRow = {
  id: string;
  mbid: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string | null;
};

function toAlbumDTO(a: AlbumRow): AlbumDTO {
  return {
    id: a.id,
    mbid: a.mbid,
    title: a.title,
    artist: a.artist,
    coverUrl: a.coverUrl,
    releaseDate: a.releaseDate,
  };
}

// Every album the viewer has already touched (logged, liked, or marked to
// listen) — never worth resurfacing as a "related" suggestion.
async function albumsKnownToUser(userId: string): Promise<Set<string>> {
  const rows = await prisma.album.findMany({
    where: {
      OR: [{ logs: { some: { userId } } }, { status: { some: { userId } } }],
    },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

// Average rating per user, for one specific album.
async function usersWhoRatedAlbum(
  albumId: string,
  minRating: number
): Promise<string[]> {
  const logRows = await prisma.listenLog.groupBy({
    by: ["userId"],
    where: { albumId, rating: { not: null } },
    _avg: { rating: true },
  });

  const byUser = new Map<string, number>();
  for (const r of logRows) if (r._avg.rating != null) byUser.set(r.userId, r._avg.rating);

  return [...byUser.entries()].filter(([, rating]) => rating >= minRating).map(([userId]) => userId);
}

// What other albums did these users rate highly? Ranked by average rating,
// then by how many of them agreed.
async function topAlbumsRatedByUsers(
  userIds: string[],
  excludeIds: Set<string>,
  limit: number
): Promise<AlbumRow[]> {
  if (userIds.length === 0) return [];

  const logRows = await prisma.listenLog.groupBy({
    by: ["albumId", "userId"],
    where: { userId: { in: userIds }, rating: { not: null } },
    _avg: { rating: true },
  });

  const perAlbum = new Map<string, number[]>();
  const add = (albumId: string, rating: number) => {
    if (excludeIds.has(albumId)) return;
    if (!perAlbum.has(albumId)) perAlbum.set(albumId, []);
    perAlbum.get(albumId)!.push(rating);
  };
  for (const r of logRows) if (r._avg.rating != null) add(r.albumId, r._avg.rating);

  const ranked = [...perAlbum.entries()]
    .map(([albumId, ratings]) => ({
      albumId,
      avg: ratings.reduce((s, v) => s + v, 0) / ratings.length,
      count: ratings.length,
    }))
    .filter((x) => x.avg >= HIGH_RATING_THRESHOLD)
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, limit);

  if (ranked.length === 0) return [];
  const albums = await prisma.album.findMany({ where: { id: { in: ranked.map((r) => r.albumId) } } });
  const byId = new Map(albums.map((a) => [a.id, a]));
  return ranked
    .map((r) => byId.get(r.albumId))
    .filter((a): a is NonNullable<typeof a> => a != null);
}

// "similar" — the same artist's other albums, plus albums that other users
// who also loved this one rated highly (a light collaborative signal). Shown
// when the viewer gave this album a high rating, or hasn't rated it yet.
async function findSimilarAlbums(album: AlbumRow, excludeIds: Set<string>): Promise<AlbumDTO[]> {
  const sameArtist = await prisma.album.findMany({
    where: { artist: album.artist, id: { notIn: [...excludeIds] } },
    take: RELATED_LIMIT,
    orderBy: { releaseDate: "desc" },
  });

  const picked = new Map<string, AlbumRow>(sameArtist.map((a) => [a.id, a]));
  if (picked.size < RELATED_LIMIT) {
    const fans = await usersWhoRatedAlbum(album.id, HIGH_RATING_THRESHOLD);
    const collaborative = await topAlbumsRatedByUsers(
      fans,
      new Set([...excludeIds, ...picked.keys()]),
      RELATED_LIMIT - picked.size
    );
    for (const a of collaborative) picked.set(a.id, a);
  }

  return [...picked.values()].slice(0, RELATED_LIMIT).map(toAlbumDTO);
}

// "discovery" — well-regarded albums by other artists. Shown when the viewer
// rated this album low, as an alternative path rather than more of the same.
async function findDiscoveryAlbums(album: AlbumRow, excludeIds: Set<string>): Promise<AlbumDTO[]> {
  const logGroups = await prisma.listenLog.groupBy({
    by: ["albumId"],
    where: { rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const merged = new Map<string, { sum: number; count: number }>();
  const add = (albumId: string, avg: number, count: number) => {
    const cur = merged.get(albumId) ?? { sum: 0, count: 0 };
    cur.sum += avg * count;
    cur.count += count;
    merged.set(albumId, cur);
  };
  for (const g of logGroups) if (g._avg.rating != null) add(g.albumId, g._avg.rating, g._count.rating);

  const candidateIds = [...merged.keys()].filter((id) => !excludeIds.has(id));
  if (candidateIds.length === 0) return [];

  const albums = await prisma.album.findMany({
    where: { id: { in: candidateIds }, artist: { not: album.artist } },
  });

  return albums
    .map((a) => ({ album: a, ...merged.get(a.id)! }))
    .map((x) => ({ album: x.album, avg: x.sum / x.count, count: x.count }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, RELATED_LIMIT)
    .map((x) => toAlbumDTO(x.album));
}

// This viewer's own albums with an average rating, one entry per album
// (relistens are averaged), newest-rating-first ties broken by rating.
async function userRatedAlbums(
  userId: string
): Promise<{ albumId: string; artist: string; rating: number }[]> {
  const logs = await prisma.listenLog.findMany({
    where: { userId, rating: { not: null } },
    select: { albumId: true, rating: true, album: { select: { artist: true } } },
  });

  const perAlbum = new Map<string, { artist: string; ratings: number[] }>();
  for (const l of logs) {
    if (l.rating == null) continue;
    const cur = perAlbum.get(l.albumId) ?? { artist: l.album.artist, ratings: [] };
    cur.ratings.push(l.rating);
    perAlbum.set(l.albumId, cur);
  }

  return [...perAlbum.entries()].map(([albumId, v]) => ({
    albumId,
    artist: v.artist,
    rating: v.ratings.reduce((s, r) => s + r, 0) / v.ratings.length,
  }));
}

// Cold-start fallback (brand new account, or no collaborative/same-artist
// matches found): the platform's best-regarded albums, same ranking
// PlatformStats uses for "highestRatedAlbum".
async function topPlatformAlbums(excludeIds: Set<string>, limit: number): Promise<AlbumDTO[]> {
  const groups = await prisma.listenLog.groupBy({
    by: ["albumId"],
    where: { rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const ranked = groups
    .filter(
      (g) => g._avg.rating != null && g._count.rating >= MIN_COMMUNITY_LOGS && !excludeIds.has(g.albumId)
    )
    .sort((a, b) => b._avg.rating! - a._avg.rating! || b._count.rating - a._count.rating)
    .slice(0, limit);

  if (ranked.length === 0) return [];
  const albums = await prisma.album.findMany({ where: { id: { in: ranked.map((r) => r.albumId) } } });
  const byId = new Map(albums.map((a) => [a.id, a]));
  return ranked
    .map((r) => byId.get(r.albumId))
    .filter((a): a is NonNullable<typeof a> => a != null)
    .map(toAlbumDTO);
}

// "For you" — personalized picks built from the viewer's whole listening
// history, not just one album: expand their favorite artists' discographies,
// plus a collaborative pass over users who share their taste (loved the same
// albums they loved). Falls back to platform-wide trending picks for new
// accounts or when neither signal turns up anything.
export async function getForYouRecommendations(userId: string): Promise<ForYouDTO> {
  const [rated, known] = await Promise.all([userRatedAlbums(userId), albumsKnownToUser(userId)]);
  const excludeIds = new Set(known);

  if (rated.length === 0) {
    return { mode: "trending", albums: await topPlatformAlbums(excludeIds, FOR_YOU_LIMIT) };
  }

  const highlyRated = rated.filter((r) => r.rating >= HIGH_RATING_THRESHOLD).sort((a, b) => b.rating - a.rating);
  const seeds = (highlyRated.length > 0 ? highlyRated : [...rated].sort((a, b) => b.rating - a.rating)).slice(
    0,
    8
  );

  const artistCounts = new Map<string, number>();
  for (const r of rated) artistCounts.set(r.artist, (artistCounts.get(r.artist) ?? 0) + 1);
  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([artist]) => artist);

  const picked = new Map<string, AlbumRow>();

  if (topArtists.length > 0) {
    const sameArtistAlbums = await prisma.album.findMany({
      where: { artist: { in: topArtists }, id: { notIn: [...excludeIds] } },
      orderBy: { releaseDate: "desc" },
      take: FOR_YOU_LIMIT,
    });
    for (const a of sameArtistAlbums) {
      if (picked.size >= FOR_YOU_LIMIT) break;
      picked.set(a.id, a);
    }
  }

  if (picked.size < FOR_YOU_LIMIT && seeds.length > 0) {
    const similarUserSets = await Promise.all(
      seeds.map((s) => usersWhoRatedAlbum(s.albumId, HIGH_RATING_THRESHOLD))
    );
    const similarUsers = [...new Set(similarUserSets.flat())].filter((id) => id !== userId);
    const collaborative = await topAlbumsRatedByUsers(
      similarUsers,
      new Set([...excludeIds, ...picked.keys()]),
      FOR_YOU_LIMIT - picked.size
    );
    for (const a of collaborative) picked.set(a.id, a);
  }

  if (picked.size === 0) {
    return { mode: "trending", albums: await topPlatformAlbums(excludeIds, FOR_YOU_LIMIT) };
  }

  return {
    mode: "personalized",
    albums: [...picked.values()].slice(0, FOR_YOU_LIMIT).map(toAlbumDTO),
  };
}

export async function getRelatedAlbums(albumId: string, userId: string): Promise<RelatedAlbumsDTO> {
  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album) return { mode: "neutral", albums: [] };

  const [effectiveRating, known] = await Promise.all([
    getEffectiveUserAlbumRating(userId, albumId),
    albumsKnownToUser(userId),
  ]);
  const excludeIds = new Set([albumId, ...known]);

  if (effectiveRating != null && effectiveRating <= LOW_RATING_THRESHOLD) {
    return { mode: "discovery", albums: await findDiscoveryAlbums(album, excludeIds) };
  }

  // High rating, or not rated yet: lead with similar/same-artist suggestions.
  const mode = effectiveRating != null && effectiveRating >= HIGH_RATING_THRESHOLD ? "similar" : "neutral";
  return { mode, albums: await findSimilarAlbums(album, excludeIds) };
}
