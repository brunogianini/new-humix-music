import { prisma } from "@/lib/prisma";
import type { AlbumDTO, PlatformStatsDTO, StatsDTO } from "@/lib/types";

// Minimum number of ratings before an album/artist can win a community
// ranking — otherwise a single 10/10 from one listen would dominate.
const MIN_LOGS_FOR_RANKING = 2;

function toAlbumDTO(album: {
  id: string;
  mbid: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string | null;
}): AlbumDTO {
  return {
    id: album.id,
    mbid: album.mbid,
    title: album.title,
    artist: album.artist,
    coverUrl: album.coverUrl,
    releaseDate: album.releaseDate,
  };
}

export async function getPersonalStats(userId: string): Promise<StatsDTO> {
  const [logs, likedCount, wantToListenCount] = await Promise.all([
    prisma.listenLog.findMany({ where: { userId }, include: { album: true } }),
    prisma.albumStatus.count({ where: { userId, liked: true } }),
    prisma.albumStatus.count({ where: { userId, wantToListen: true } }),
  ]);

  const distinctAlbumIds = new Set(logs.map((l) => l.albumId));
  const distinctArtists = new Set(logs.map((l) => l.album.artist));

  const ratings = logs.map((l) => l.rating).filter((r): r is number => r != null);
  const avgRating =
    ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

  const ratingDistribution = new Array(11).fill(0);
  for (const r of ratings) ratingDistribution[r]++;

  const artistCounts = new Map<string, number>();
  for (const l of logs) {
    artistCounts.set(l.album.artist, (artistCounts.get(l.album.artist) ?? 0) + 1);
  }
  const topArtists = [...artistCounts.entries()]
    .map(([artist, count]) => ({ artist, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const currentYear = new Date().getFullYear();
  const logsThisYear = logs.filter((l) => l.listenedOn.getFullYear() === currentYear).length;

  return {
    totalLogs: logs.length,
    distinctAlbums: distinctAlbumIds.size,
    distinctArtists: distinctArtists.size,
    avgRating,
    ratingDistribution,
    topArtists,
    logsThisYear,
    likedCount,
    wantToListenCount,
  };
}

export async function getPlatformStats(userId: string): Promise<PlatformStatsDTO> {
  const [albumGroups, mostLoggedGroup, myTop] = await Promise.all([
    prisma.listenLog.groupBy({
      by: ["albumId"],
      where: { rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.listenLog.groupBy({
      by: ["albumId"],
      _count: { albumId: true },
      orderBy: { _count: { albumId: "desc" } },
      take: 1,
    }),
    prisma.listenLog.findFirst({
      where: { userId, rating: { not: null } },
      orderBy: { rating: "desc" },
      include: { album: true },
    }),
  ]);

  const albums = await prisma.album.findMany({
    where: { id: { in: albumGroups.map((g) => g.albumId) } },
  });
  const albumById = new Map(albums.map((a) => [a.id, a]));

  // Community "top band": pool per-album averages up to the artist level,
  // weighted by log count (no separate Artist model to group by directly).
  const artistAgg = new Map<string, { sumRating: number; count: number }>();
  for (const g of albumGroups) {
    const album = albumById.get(g.albumId);
    if (!album) continue;
    const avg = g._avg.rating ?? 0;
    const count = g._count.rating;
    const cur = artistAgg.get(album.artist) ?? { sumRating: 0, count: 0 };
    cur.sumRating += avg * count;
    cur.count += count;
    artistAgg.set(album.artist, cur);
  }
  let topArtist: PlatformStatsDTO["topArtist"] = null;
  for (const [artist, agg] of artistAgg) {
    if (agg.count < MIN_LOGS_FOR_RANKING) continue;
    const communityAvgRating = agg.sumRating / agg.count;
    if (!topArtist || communityAvgRating > topArtist.communityAvgRating) {
      topArtist = { artist, communityAvgRating, totalLogs: agg.count };
    }
  }

  let highestRatedAlbum: PlatformStatsDTO["highestRatedAlbum"] = null;
  for (const g of albumGroups) {
    if (g._count.rating < MIN_LOGS_FOR_RANKING) continue;
    const communityAvgRating = g._avg.rating ?? 0;
    if (!highestRatedAlbum || communityAvgRating > highestRatedAlbum.communityAvgRating) {
      const album = albumById.get(g.albumId);
      if (!album) continue;
      highestRatedAlbum = {
        album: toAlbumDTO(album),
        communityAvgRating,
        communityLogCount: g._count.rating,
      };
    }
  }

  let mostLoggedAlbum: PlatformStatsDTO["mostLoggedAlbum"] = null;
  const topLogged = mostLoggedGroup[0];
  if (topLogged) {
    const album =
      albumById.get(topLogged.albumId) ??
      (await prisma.album.findUnique({ where: { id: topLogged.albumId } }));
    if (album) {
      mostLoggedAlbum = { album: toAlbumDTO(album), logCount: topLogged._count.albumId };
    }
  }

  const myTopAlbum =
    myTop && myTop.rating != null ? { album: toAlbumDTO(myTop.album), rating: myTop.rating } : null;

  // Best community-rated album per release year. releaseDate is a free-form
  // string ("YYYY" or "YYYY-MM-DD"), so grouping by year needs raw SQL.
  type YearRow = { year: string; albumId: string; avgRating: number; logCount: number };
  const yearRows = await prisma.$queryRaw<YearRow[]>`
    SELECT substr(a."releaseDate", 1, 4) AS "year", l."albumId" AS "albumId",
           AVG(l."rating") AS "avgRating", COUNT(*) AS "logCount"
    FROM "ListenLog" l
    JOIN "Album" a ON a.id = l."albumId"
    WHERE l."rating" IS NOT NULL AND a."releaseDate" IS NOT NULL
    GROUP BY "year", l."albumId"
  `;

  const pickBestPerYear = (minLogs: number) => {
    const byYear = new Map<string, YearRow>();
    for (const row of yearRows) {
      if (Number(row.logCount) < minLogs) continue;
      const cur = byYear.get(row.year);
      if (!cur || Number(row.avgRating) > Number(cur.avgRating)) {
        byYear.set(row.year, row);
      }
    }
    return byYear;
  };

  let byYear = pickBestPerYear(MIN_LOGS_FOR_RANKING);
  if (byYear.size === 0) byYear = pickBestPerYear(1);

  const yearAlbums = await prisma.album.findMany({
    where: { id: { in: [...byYear.values()].map((r) => r.albumId) } },
  });
  const yearAlbumById = new Map(yearAlbums.map((a) => [a.id, a]));

  const topAlbumsByYear: PlatformStatsDTO["topAlbumsByYear"] = [...byYear.entries()]
    .map(([year, row]) => {
      const album = yearAlbumById.get(row.albumId);
      if (!album) return null;
      return {
        year: Number(year),
        album: toAlbumDTO(album),
        communityAvgRating: Number(row.avgRating),
        communityLogCount: Number(row.logCount),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.year - a.year);

  return { topAlbumsByYear, myTopAlbum, topArtist, mostLoggedAlbum, highestRatedAlbum };
}
