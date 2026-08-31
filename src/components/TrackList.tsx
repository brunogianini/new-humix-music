"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useLibrary } from "@/context/LibraryContext";
import type { TrackDTO } from "@/lib/types";
import type { AlbumLike } from "./AlbumCard";

function formatDuration(ms: number | null): string {
  if (ms == null) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TrackList({
  album,
  compact = false,
}: {
  album: AlbumLike;
  compact?: boolean;
}) {
  const { ensureAlbum } = useLibrary();
  const [tracks, setTracks] = useState<TrackDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset for a new album without an extra effect-triggered render (same
  // adjust-during-render pattern as ArtistView's artistKey reset).
  const [prevMbid, setPrevMbid] = useState(album.mbid);
  if (album.mbid !== prevMbid) {
    setPrevMbid(album.mbid);
    setLoading(true);
    setError(null);
    setTracks(null);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const real = await ensureAlbum(album);
        const data = await apiFetch<{ tracks: TrackDTO[] }>(`/api/albums/${real.id}/tracks`);
        if (!cancelled) setTracks(data.tracks);
      } catch {
        if (!cancelled) setError("Não foi possível carregar as faixas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only the identity of the album (mbid) should re-trigger the fetch —
    // ensureAlbum is stable-ish but re-creating it shouldn't re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.mbid]);

  if (loading) {
    return <p className="text-xs text-neutral-500">Carregando faixas…</p>;
  }
  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }
  if (!tracks || tracks.length === 0) {
    return <p className="text-xs text-neutral-500">Faixas não disponíveis para este álbum.</p>;
  }

  return (
    <ul
      className={`flex flex-col divide-y divide-white/5 ${
        compact ? "" : "max-h-72 overflow-y-auto pr-1"
      }`}
    >
      {tracks.map((t) => (
        <li
          key={t.id}
          className={`flex items-center gap-2 ${compact ? "py-1 text-xs" : "py-2 text-sm"}`}
        >
          <span className="w-4 shrink-0 text-right text-neutral-500">{t.trackNumber}</span>
          <span className="min-w-0 flex-1 truncate text-neutral-200">{t.title}</span>
          {!compact && (
            <span className="shrink-0 text-neutral-500">{formatDuration(t.durationMs)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
