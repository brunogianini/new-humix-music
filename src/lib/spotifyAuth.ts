import "server-only";
import type { ArtistInfo } from "@/lib/spotify";

// Authorization Code flow — lets a user link *their own* Spotify library
// (saved albums, followed artists). Separate from spotify.ts's Client
// Credentials flow, which is app-level and never sees user data.
const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const SCOPES = "user-library-read user-follow-read";

function getClientCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET/SPOTIFY_REDIRECT_URI não configurados."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function getAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getClientCredentials();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type SpotifyTokens = { accessToken: string; refreshToken: string; expiresIn: number };

export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokens> {
  const { clientId, clientSecret, redirectUri } = getClientCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar código por token: ${res.status}`);

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = getClientCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar token: ${res.status}`);

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in,
  };
}

async function userFetch(pathOrUrl: string, accessToken: string): Promise<Response> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function fetchSpotifyProfile(accessToken: string): Promise<{ id: string }> {
  const res = await userFetch("/me", accessToken);
  if (!res.ok) throw new Error(`Falha ao buscar perfil do Spotify: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

export type ImportedAlbum = {
  mbid: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string | null;
};

type SpotifySavedAlbumsResponse = {
  items: {
    album: {
      id: string;
      name: string;
      release_date: string | null;
      images: { url: string }[];
      artists: { name: string }[];
    };
  }[];
  next: string | null;
};

export async function fetchSavedAlbums(accessToken: string): Promise<ImportedAlbum[]> {
  const albums: ImportedAlbum[] = [];
  let next: string | null = "/me/albums?limit=50";
  while (next) {
    const res: Response = await userFetch(next, accessToken);
    if (!res.ok) throw new Error(`Falha ao buscar álbuns salvos: ${res.status}`);
    const data = (await res.json()) as SpotifySavedAlbumsResponse;
    for (const item of data.items) {
      albums.push({
        mbid: item.album.id,
        title: item.album.name,
        artist: item.album.artists.map((a) => a.name).join(", "),
        coverUrl: item.album.images[0]?.url ?? null,
        releaseDate: item.album.release_date,
      });
    }
    next = data.next;
  }
  return albums;
}

type SpotifyFollowedArtistsResponse = {
  artists: { items: ArtistInfo[]; next: string | null };
};

export async function fetchFollowedArtists(accessToken: string): Promise<ArtistInfo[]> {
  const artists: ArtistInfo[] = [];
  let next: string | null = "/me/following?type=artist&limit=50";
  while (next) {
    const res: Response = await userFetch(next, accessToken);
    if (!res.ok) throw new Error(`Falha ao buscar artistas seguidos: ${res.status}`);
    const data = (await res.json()) as SpotifyFollowedArtistsResponse;
    artists.push(...data.artists.items.map((a) => ({ id: a.id, name: a.name })));
    next = data.artists.next;
  }
  return artists;
}
