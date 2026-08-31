const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

// The `mbid`/`artistMbid` field names are a holdover from the MusicBrainz
// integration this replaced — they now hold Spotify album/artist ids.
// Kept as-is because AlbumDTO/Prisma's `mbid` column already stores these
// ids for every saved album and renaming it would require a migration.
export type SearchResult = {
  mbid: string;
  title: string;
  artist: string;
  artistMbid: string | null;
  releaseDate: string | null;
  primaryType: string | null;
  coverUrl: string;
  // Set by attachUserAlbumStatus() once the caller knows who's asking —
  // absent (not just false) for releases the viewer has never touched.
  liked?: boolean;
  wantToListen?: boolean;
};

export type ArtistInfo = { id: string; name: string };

export type TrackInfo = {
  id: string;
  title: string;
  trackNumber: number;
  durationMs: number | null;
};

type SpotifyImage = { url: string };
type SpotifyArtistRef = { id: string; name: string };
type SpotifyAlbum = {
  id: string;
  name: string;
  album_type: string;
  release_date: string | null;
  images: SpotifyImage[];
  artists: SpotifyArtistRef[];
};
type SpotifySearchResponse = { albums?: { items: SpotifyAlbum[] } };
type SpotifyArtistSearchResponse = { artists?: { items: SpotifyArtistRef[] } };
type SpotifyArtistAlbumsResponse = { items: SpotifyAlbum[]; next: string | null };
type SpotifyTrack = { id: string; name: string; track_number: number; duration_ms: number | null };
type SpotifyAlbumTracksResponse = { items: SpotifyTrack[]; next: string | null };

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET não configurados.");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Falha ao autenticar no Spotify: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function spotifyFetch(pathOrUrl: string): Promise<Response> {
  const token = await getAccessToken();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function fetchWithRetry(pathOrUrl: string, retries = 2): Promise<Response> {
  let res = await spotifyFetch(pathOrUrl);

  if (res.status === 401) {
    // Cached token was revoked/expired early — drop it and retry once.
    cachedToken = null;
    res = await spotifyFetch(pathOrUrl);
  }

  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 1;
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return fetchWithRetry(pathOrUrl, retries - 1);
  }

  return res;
}

function isDeluxe(title: string): boolean {
  return /deluxe/i.test(title);
}

function toSearchResult(album: SpotifyAlbum, artistOverride?: ArtistInfo): SearchResult {
  const primaryArtist = artistOverride ?? album.artists[0];
  return {
    mbid: album.id,
    title: album.name,
    artist: artistOverride?.name ?? album.artists.map((a) => a.name).join(", "),
    artistMbid: primaryArtist?.id ?? null,
    releaseDate: album.release_date || null,
    primaryType: album.album_type
      ? album.album_type[0].toUpperCase() + album.album_type.slice(1)
      : null,
    coverUrl: album.images[0]?.url ?? "",
  };
}

export async function searchAlbums(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const res = await fetchWithRetry(`/search?q=${encodeURIComponent(q)}&type=album&limit=20`);
  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = (await res.json()) as SpotifySearchResponse;

  return (data.albums?.items ?? [])
    .filter((a) => a.name && a.artists?.length)
    .filter((a) => a.album_type === "album")
    .filter((a) => !isDeluxe(a.name))
    .map((a) => toSearchResult(a));
}

// Full tracklist for an album, keyed by the Spotify album id stored in
// Album.mbid. Used to seed the local Track table on first view — Spotify has
// no per-track rating concept, so ratings live entirely in our own DB.
export async function getAlbumTracks(spotifyAlbumId: string): Promise<TrackInfo[]> {
  const tracks: SpotifyTrack[] = [];
  let next: string | null = `/albums/${spotifyAlbumId}/tracks?limit=50`;
  while (next) {
    const res: Response = await fetchWithRetry(next);
    if (!res.ok) {
      throw new Error(`Spotify album tracks lookup failed: ${res.status}`);
    }
    const data = (await res.json()) as SpotifyAlbumTracksResponse;
    tracks.push(...data.items);
    next = data.next;
  }

  return tracks
    .filter((t) => t.id && t.name)
    .map((t) => ({
      id: t.id,
      title: t.name,
      trackNumber: t.track_number,
      durationMs: t.duration_ms ?? null,
    }));
}

async function searchArtistByName(name: string): Promise<ArtistInfo | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const res = await fetchWithRetry(
    `/search?q=${encodeURIComponent(`artist:"${trimmed}"`)}&type=artist&limit=1`
  );
  if (!res.ok) return null;

  const data = (await res.json()) as SpotifyArtistSearchResponse;
  const a = data.artists?.items?.[0];
  return a ? { id: a.id, name: a.name } : null;
}

// Discography for an artist's page. When the caller already knows the
// Spotify artist id (captured from a prior search result) we skip the
// name-resolution lookup and go straight to the albums listing.
export async function getArtistDiscography(opts: {
  id?: string | null;
  name: string;
}): Promise<{ artist: ArtistInfo; releases: SearchResult[] }> {
  const artist = opts.id ? { id: opts.id, name: opts.name } : await searchArtistByName(opts.name);
  if (!artist) {
    throw new Error("Artista não encontrado no Spotify.");
  }

  const albums: SpotifyAlbum[] = [];
  let next: string | null = `/artists/${artist.id}/albums?include_groups=album&limit=50`;
  while (next) {
    const res: Response = await fetchWithRetry(next);
    if (!res.ok) {
      throw new Error(`Spotify artist lookup failed: ${res.status}`);
    }
    const data = (await res.json()) as SpotifyArtistAlbumsResponse;
    albums.push(...data.items);
    next = data.next;
  }

  const seenTitles = new Set<string>();
  const releases = albums
    .filter((a) => a.name)
    .filter((a) => a.album_type === "album")
    .filter((a) => !isDeluxe(a.name))
    .filter((a) => {
      const key = a.name.trim().toLowerCase();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .map((a) => toSearchResult(a, artist))
    .sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"));

  return { artist, releases };
}
