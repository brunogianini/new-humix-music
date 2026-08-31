import { prisma } from "@/lib/prisma";
import { getEffectiveUserAlbumRating } from "@/lib/albumAggregate";
import type { AlbumDTO, RelatedAlbumsDTO } from "@/lib/types";

// Rating scale is 0-10 (half-stars, see StarRating). >=7 is ~3.5+ stars,
// <=4 is ~2 stars or less.
const HIGH_RATING_THRESHOLD = 7;
const LOW_RATING_THRESHOLD = 4;
const RELATED_LIMIT = 8;

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
