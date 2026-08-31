import { prisma } from "@/lib/prisma";
import { getEffectiveUserAlbumRating } from "@/lib/albumAggregate";
import { getArtistDiscography, type SearchResult } from "@/lib/spotify";
import type { AlbumDTO, ForYouDTO, RelatedAlbumsDTO } from "@/lib/types";

// Rating scale is 0-10 (half-stars, see StarRating). >=7 is ~3.5+ stars,
// <=4 is ~2 stars or less.
const HIGH_RATING_THRESHOLD = 7;
const LOW_RATING_THRESHOLD = 4;
const RELATED_LIMIT = 8;
const FOR_YOU_LIMIT = 16;
// Internally gather a wider pool than we actually show, then randomly
// sample FOR_YOU_LIMIT from it on every call — so the refresh button (which
// just re-requests this endpoint) surfaces a different mix each time
// instead of the same deterministic ranking.
const CANDIDATE_POOL_SIZE = FOR_YOU_LIMIT * 3;
// Same floor RelatedAlbums/PlatformStats use before trusting a pooled
// average — one lone 10/10 shouldn't dominate the "trending" fallback.
const MIN_COMMUNITY_LOGS = 2;
// How many of the viewer's top artists to look up live on Spotify when the
// local catalog (only albums someone has already searched/imported) runs
// out of same-artist/collaborative picks. Each lookup is a real API call,
// so this stays small.
const SPOTIFY_FALLBACK_ARTISTS = 3;
// "For You" never resurfaces an artist the viewer already has in their
// collection (logged/liked/want-to-listen) — see knownArtistsForUser(). What
// fills that space instead is a bounded set of *related* artists (found via
// findRelatedArtists' collaborative filtering), expanded into album picks
// the same way a same-artist pool used to be: capped per artist and
// reserved out of FOR_YOU_LIMIT so no single related artist — or the
// shuffled discovery portion that gives refresh its variety — gets crowded
// out.
const MAX_RELATED_ARTISTS = 6;
const PER_RELATED_ARTIST_LIMIT = 2;
const RELATED_ARTIST_RESERVED = Math.ceil(FOR_YOU_LIMIT * 0.5);

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

// Every artist the viewer already has in their collection (logged, liked,
// or marked to listen) — "For You"'s job is to introduce something new, so
// none of these should ever come back as a pick, no matter how strong the
// collaborative signal for more of them is.
async function knownArtistsForUser(userId: string): Promise<Set<string>> {
  const rows = await prisma.album.findMany({
    where: {
      OR: [{ logs: { some: { userId } } }, { status: { some: { userId } } }],
    },
    select: { artist: true },
  });
  return new Set(rows.map((r) => r.artist));
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
  limit: number,
  excludeArtists: Set<string> = new Set()
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
    .filter((a): a is NonNullable<typeof a> => a != null)
    .filter((a) => !excludeArtists.has(a.artist));
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

// This viewer's positive taste signals: albums they liked (heart icon)
// and/or rated above 3.5 stars (>HIGH_RATING_THRESHOLD on the 0-10
// half-star scale). A hated album they still logged shouldn't count toward
// "artists they love" — only an explicit like or a genuinely high rating
// does. `liked` is the dominant signal (see LIKE_WEIGHT below) — a rating
// alone is reinforcement, not a substitute for it. One entry per album
// (relistens are averaged into a single rating).
async function userPositiveSignals(
  userId: string
): Promise<{ albumId: string; artist: string; rating: number | null; liked: boolean }[]> {
  const [logs, likes] = await Promise.all([
    prisma.listenLog.findMany({
      where: { userId, rating: { not: null } },
      select: { albumId: true, rating: true, album: { select: { artist: true } } },
    }),
    prisma.albumStatus.findMany({
      where: { userId, liked: true },
      select: { albumId: true, album: { select: { artist: true } } },
    }),
  ]);

  const perAlbum = new Map<string, { artist: string; ratings: number[]; liked: boolean }>();
  for (const l of logs) {
    if (l.rating == null) continue;
    const cur = perAlbum.get(l.albumId) ?? { artist: l.album.artist, ratings: [], liked: false };
    cur.ratings.push(l.rating);
    perAlbum.set(l.albumId, cur);
  }
  for (const s of likes) {
    const cur = perAlbum.get(s.albumId) ?? { artist: s.album.artist, ratings: [], liked: false };
    cur.liked = true;
    perAlbum.set(s.albumId, cur);
  }

  const positive: { albumId: string; artist: string; rating: number | null; liked: boolean }[] = [];
  for (const [albumId, v] of perAlbum) {
    const rating = v.ratings.length ? v.ratings.reduce((s, r) => s + r, 0) / v.ratings.length : null;
    if (v.liked || (rating != null && rating > HIGH_RATING_THRESHOLD)) {
      positive.push({ albumId, artist: v.artist, rating, liked: v.liked });
    }
  }
  return positive;
}

// Same "already touched" definition as albumsKnownToUser(), but keyed by
// Spotify id (mbid) — needed to dedupe against live Spotify lookups, which
// don't have a local Album row (and therefore no local id) yet.
async function knownAlbumMbidsForUser(userId: string): Promise<Set<string>> {
  const rows = await prisma.album.findMany({
    where: {
      OR: [{ logs: { some: { userId } } }, { status: { some: { userId } } }],
    },
    select: { mbid: true },
  });
  return new Set(rows.map((r) => r.mbid));
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

// Reissues/remixes/live compilations that are really the same album as one
// already registered — never worth surfacing as a separate recommendation.
const ALTERNATE_EDITION_PATTERN =
  /\b(deluxe|anniversary|remaster(ed)?|remix(es)?|rmx|expanded|reissue|edition|bonus\s*tracks?|demos?|live\s*recordings?|dis[ck]\s*\d+)\b/i;

function normalizeAlbumTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[([][^)\]]*[)\]]/g, " ") // strip "(...)" / "[...]" qualifiers
    .replace(/[-–—:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// True when `title` reads as an alternate/deluxe pressing of one of
// `siblingTitles` — another title already registered for the same artist
// ("Disk 2", a remix set, an anniversary remaster, "Kid A Mnesia", a live
// recording of an album that already exists under its studio title) —
// rather than a distinct release of its own. Callers must exclude the
// title's own entry from `siblingTitles` first.
function isAlternateEdition(title: string, siblingTitles: string[]): boolean {
  if (ALTERNATE_EDITION_PATTERN.test(title)) return true;
  const normalized = normalizeAlbumTitle(title);
  return siblingTitles.some(
    (sibling) => normalized === sibling || (sibling.length < normalized.length && normalized.startsWith(`${sibling} `))
  );
}

// When the local catalog (only albums someone has already searched/saved)
// runs out of same-artist picks, ask Spotify directly for the rest of the
// viewer's favorite artists' discographies. Best-effort: one artist failing
// (rate limit, not found) shouldn't drop the others.
async function liveDiscographyPicks(
  artists: string[],
  excludeMbids: Set<string>,
  registeredTitlesByArtist: Map<string, string[]>,
  limit: number
): Promise<SearchResult[]> {
  if (limit <= 0 || artists.length === 0) return [];

  const results = await Promise.allSettled(
    artists.slice(0, SPOTIFY_FALLBACK_ARTISTS).map((name) => getArtistDiscography({ name }))
  );

  const picked = new Map<string, SearchResult>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    // Shortest title first, so a base album is accepted (and becomes a
    // sibling in its own right) before its longer reissues/live variants are
    // evaluated — Spotify's discography can list both side by side.
    const siblings = [...(registeredTitlesByArtist.get(r.value.artist.name) ?? [])];
    const releases = [...r.value.releases].sort((a, b) => a.title.length - b.title.length);
    for (const release of releases) {
      if (picked.size >= limit) break;
      if (excludeMbids.has(release.mbid) || picked.has(release.mbid)) continue;
      if (isAlternateEdition(release.title, siblings)) continue;
      siblings.push(normalizeAlbumTitle(release.title));
      picked.set(release.mbid, release);
    }
  }
  return [...picked.values()];
}

// Artist-level collaborative filtering: "listeners into your favorite
// artists are also into these OTHER artists". Spotify's own related-artists
// endpoint is off-limits to newer API apps and we track no genre data, so
// this is built entirely from the community's own taste correlations:
//   1) find "fans" — other users with a positive signal (liked, or rated
//      >=HIGH_RATING_THRESHOLD) on a local album by one of seedArtists. A
//      fan who overlaps on more than one seed artist counts for more —
//      their taste has more in common with the viewer's, not less.
//   2) look at what ELSE those fans loved, outside seedArtists/excludeArtists
//      (the viewer's own collection), and rank candidate artists by how many
//      distinct fans back them, then by total overlap-weighted score.
// Best-effort like the rest of this module's DB-driven passes: an artist
// with zero fans locally (e.g. a brand-new catalog) just contributes nothing
// rather than erroring.
async function findRelatedArtists(
  seedArtists: string[],
  excludeArtists: Set<string>,
  viewerId: string,
  limit: number
): Promise<string[]> {
  if (seedArtists.length === 0) return [];

  const seedAlbums = await prisma.album.findMany({
    where: { artist: { in: seedArtists } },
    select: { id: true, artist: true },
  });
  if (seedAlbums.length === 0) return [];
  const artistBySeedAlbum = new Map(seedAlbums.map((a) => [a.id, a.artist]));
  const seedAlbumIds = seedAlbums.map((a) => a.id);

  const [logRows, likeRows] = await Promise.all([
    prisma.listenLog.groupBy({
      by: ["albumId", "userId"],
      where: { albumId: { in: seedAlbumIds }, userId: { not: viewerId }, rating: { not: null } },
      _avg: { rating: true },
    }),
    prisma.albumStatus.findMany({
      where: { albumId: { in: seedAlbumIds }, userId: { not: viewerId }, liked: true },
      select: { albumId: true, userId: true },
    }),
  ]);

  // fanOverlap[userId] = the set of the viewer's seed artists this user is
  // independently a fan of — its size is that fan's overlap weight below.
  const fanOverlap = new Map<string, Set<string>>();
  const markFan = (userId: string, albumId: string) => {
    const artist = artistBySeedAlbum.get(albumId);
    if (!artist) return;
    const set = fanOverlap.get(userId) ?? new Set<string>();
    set.add(artist);
    fanOverlap.set(userId, set);
  };
  for (const r of logRows) {
    if (r._avg.rating != null && r._avg.rating >= HIGH_RATING_THRESHOLD) markFan(r.userId, r.albumId);
  }
  for (const r of likeRows) markFan(r.userId, r.albumId);

  const fanIds = [...fanOverlap.keys()];
  if (fanIds.length === 0) return [];

  const [fanLogs, fanLikes] = await Promise.all([
    prisma.listenLog.findMany({
      where: { userId: { in: fanIds }, rating: { gte: HIGH_RATING_THRESHOLD } },
      select: { userId: true, album: { select: { artist: true } } },
    }),
    prisma.albumStatus.findMany({
      where: { userId: { in: fanIds }, liked: true },
      select: { userId: true, album: { select: { artist: true } } },
    }),
  ]);

  const scores = new Map<string, { score: number; fans: Set<string> }>();
  const addSignal = (userId: string, artist: string) => {
    if (seedArtists.includes(artist) || excludeArtists.has(artist)) return;
    const weight = fanOverlap.get(userId)?.size ?? 1;
    const cur = scores.get(artist) ?? { score: 0, fans: new Set<string>() };
    cur.score += weight;
    cur.fans.add(userId);
    scores.set(artist, cur);
  };
  for (const r of fanLogs) addSignal(r.userId, r.album.artist);
  for (const r of fanLikes) addSignal(r.userId, r.album.artist);

  return [...scores.entries()]
    .sort((a, b) => b[1].fans.size - a[1].fans.size || b[1].score - a[1].score)
    .slice(0, limit)
    .map(([artist]) => artist);
}

// "For you" — personalized picks built from the viewer's whole positive
// taste signal, not just one album: liked albums and albums rated above 3.5
// stars feed both the related-artist expansion (collaborative filtering over
// the community's taste, see findRelatedArtists — local catalog first, then
// live Spotify lookups once that runs dry) and a collaborative pass over
// users who share their taste (loved the same albums they loved). Likes are
// the dominant signal throughout — a rating without a like only reinforces
// or fills gaps, never outranks an actual like. An artist the viewer already
// has in their collection (see knownArtistsForUser) never comes back as a
// pick anywhere on this page — the point is to surface something new, not
// hand back more of what they already follow. Falls back to platform-wide
// trending picks only for accounts with no positive signal at all — an
// account with history but no new picks still reports mode "personalized"
// (with an empty list), since "rate something to get started" would be a
// wrong thing to tell them.
export async function getForYouRecommendations(userId: string): Promise<ForYouDTO> {
  const [signals, known, excludeArtists] = await Promise.all([
    userPositiveSignals(userId),
    albumsKnownToUser(userId),
    knownArtistsForUser(userId),
  ]);
  const excludeIds = new Set(known);

  if (signals.length === 0) {
    const trending = await topPlatformAlbums(excludeIds, CANDIDATE_POOL_SIZE);
    return { mode: "trending", albums: shuffle(trending).slice(0, FOR_YOU_LIMIT) };
  }

  // Liked albums lead the seed list regardless of rating — a rating-only
  // signal only fills in once likes run out, and only breaks ties by score.
  const seeds = [...signals]
    .sort((a, b) => {
      if (a.liked !== b.liked) return a.liked ? -1 : 1;
      return (b.rating ?? HIGH_RATING_THRESHOLD) - (a.rating ?? HIGH_RATING_THRESHOLD);
    })
    .slice(0, 8);

  // Favorite artists are tiered, not summed: any artist with at least one
  // like outranks every rated-only artist, no matter how many albums of
  // theirs got a high rating without a like — volume of ratings must never
  // let a rated-only artist crowd out someone the viewer actually liked.
  const likedCounts = new Map<string, number>();
  const ratedOnlyCounts = new Map<string, number>();
  for (const s of signals) {
    const bucket = s.liked ? likedCounts : ratedOnlyCounts;
    bucket.set(s.artist, (bucket.get(s.artist) ?? 0) + 1);
  }
  const byCountDesc = (a: [string, number], b: [string, number]) => b[1] - a[1];
  const likedArtists = [...likedCounts.entries()].sort(byCountDesc).map(([artist]) => artist);
  const ratedOnlyArtists = [...ratedOnlyCounts.entries()]
    .filter(([artist]) => !likedCounts.has(artist))
    .sort(byCountDesc)
    .map(([artist]) => artist);
  const topArtists = [...likedArtists, ...ratedOnlyArtists].slice(0, 5);

  // Related-artist picks — found via findRelatedArtists' collaborative
  // filtering, never an artist already in excludeArtists — are gathered
  // artist-by-artist, in relevance order (strongest fan overlap first) and
  // capped per artist, otherwise one related artist with a bigger catalog on
  // file would flood the pool and crowd out another. This reserved portion
  // stays in that order (not shuffled), so it reads consistently across
  // refreshes; only the collaborative/discovery portion below is randomized
  // for variety.
  const relatedArtists = await findRelatedArtists(topArtists, excludeArtists, userId, MAX_RELATED_ARTISTS);
  const related = new Map<string, AlbumRow>();
  const registeredTitlesByArtist = new Map<string, string[]>();

  if (relatedArtists.length > 0) {
    const relatedCatalog = await prisma.album.findMany({ where: { artist: { in: relatedArtists } } });
    for (const a of relatedCatalog) {
      const list = registeredTitlesByArtist.get(a.artist) ?? [];
      list.push(normalizeAlbumTitle(a.title));
      registeredTitlesByArtist.set(a.artist, list);
    }

    const catalogByArtist = new Map<string, AlbumRow[]>();
    for (const a of relatedCatalog) {
      if (excludeIds.has(a.id)) continue;
      const ownTitle = normalizeAlbumTitle(a.title);
      const siblings = (registeredTitlesByArtist.get(a.artist) ?? []).filter((t) => t !== ownTitle);
      if (isAlternateEdition(a.title, siblings)) continue;
      const list = catalogByArtist.get(a.artist) ?? [];
      list.push(a);
      catalogByArtist.set(a.artist, list);
    }

    for (const artist of relatedArtists) {
      if (related.size >= RELATED_ARTIST_RESERVED) break;
      const releases = (catalogByArtist.get(artist) ?? []).sort(
        (x, y) => (y.releaseDate ?? "").localeCompare(x.releaseDate ?? "")
      );
      let addedForArtist = 0;
      for (const a of releases) {
        if (addedForArtist >= PER_RELATED_ARTIST_LIMIT || related.size >= RELATED_ARTIST_RESERVED) break;
        related.set(a.id, a);
        addedForArtist++;
      }
    }
  }

  // Everything else — collaborative picks plus a live Spotify fallback —
  // feeds a wider discovery pool that gets shuffled on every call. Both
  // exclude excludeArtists too, so an already-known artist can never sneak
  // back in through the "people who loved this album also loved..." signal.
  const discovery = new Map<string, AlbumRow>();
  const discoveryExcludeIds = new Set([...excludeIds, ...related.keys()]);

  if (seeds.length > 0) {
    const similarUserSets = await Promise.all(
      seeds.map((s) => usersWhoRatedAlbum(s.albumId, HIGH_RATING_THRESHOLD))
    );
    const similarUsers = [...new Set(similarUserSets.flat())].filter((id) => id !== userId);
    const collaborative = await topAlbumsRatedByUsers(
      similarUsers,
      discoveryExcludeIds,
      CANDIDATE_POOL_SIZE,
      excludeArtists
    );
    for (const a of collaborative) discovery.set(a.id, a);
  }

  let discoveryAlbums: (AlbumDTO | SearchResult)[] = [...discovery.values()].map(toAlbumDTO);

  if (discoveryAlbums.length < CANDIDATE_POOL_SIZE && relatedArtists.length > 0) {
    const knownMbids = await knownAlbumMbidsForUser(userId);
    const localMbids = [...related.values(), ...discovery.values()].map((a) => a.mbid);
    const excludeMbids = new Set([...knownMbids, ...localMbids]);
    const live = await liveDiscographyPicks(
      relatedArtists,
      excludeMbids,
      registeredTitlesByArtist,
      CANDIDATE_POOL_SIZE - discoveryAlbums.length
    );
    discoveryAlbums = discoveryAlbums.concat(live);
  }

  const relatedAlbums = [...related.values()].map(toAlbumDTO);
  const remainingSlots = Math.max(FOR_YOU_LIMIT - relatedAlbums.length, 0);
  const albums: (AlbumDTO | SearchResult)[] = [
    ...relatedAlbums,
    ...shuffle(discoveryAlbums).slice(0, remainingSlots),
  ];

  if (albums.length === 0) {
    const trending = await topPlatformAlbums(excludeIds, CANDIDATE_POOL_SIZE);
    return { mode: "personalized", albums: shuffle(trending).slice(0, FOR_YOU_LIMIT) };
  }

  return { mode: "personalized", albums: albums.slice(0, FOR_YOU_LIMIT) };
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
