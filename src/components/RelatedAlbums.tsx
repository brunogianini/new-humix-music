"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AlbumCard, type AlbumLike, type ArtistRef } from "./AlbumCard";
import type { RelatedAlbumsDTO } from "@/lib/types";

// "neutral" mode (album not rated yet, or rating in the middle band) is
// intentionally never shown — the section only surfaces once we have a
// clear signal (loved it → similar, disliked it → discovery).
const TITLES: Partial<Record<RelatedAlbumsDTO["mode"], string>> = {
  similar: "Porque você amou este álbum",
  discovery: "Talvez isso desperte seu interesse",
};

export function RelatedAlbums({
  albumId,
  refreshToken,
  onOpenAlbum,
  onOpenArtist,
}: {
  albumId: string;
  refreshToken?: number;
  onOpenAlbum: (album: AlbumLike) => void;
  onOpenArtist: (artist: ArtistRef) => void;
}) {
  const [data, setData] = useState<RelatedAlbumsDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // Reset without an extra effect-triggered render (same adjust-during-render
  // pattern as ArtistView's artistKey reset).
  const key = `${albumId}:${refreshToken ?? 0}`;
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setLoading(true);
    setData(null);
  }

  useEffect(() => {
    if (!albumId) return;
    let cancelled = false;
    apiFetch<RelatedAlbumsDTO>(`/api/albums/${albumId}/related`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [albumId, refreshToken]);

  if (!albumId || loading) return null;
  if (!data || data.albums.length === 0) return null;
  if (data.mode === "neutral") return null;

  return (
    <div className="border-t border-white/10 p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        {TITLES[data.mode]}
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {data.albums.map((a) => (
          <div key={a.id} className="w-32 shrink-0">
            <AlbumCard
              album={a}
              onOpen={onOpenAlbum}
              onOpenArtist={onOpenArtist}
              showQuickActions={false}
              showTracks={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
