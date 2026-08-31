"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AlbumCard, type AlbumLike, type ArtistRef } from "./AlbumCard";
import type { ForYouDTO } from "@/lib/types";

const TITLES: Record<ForYouDTO["mode"], string> = {
  personalized: "Recomendado pra você",
  trending: "Em alta na comunidade",
};

export function ForYou({
  onOpenAlbum,
  onOpenArtist,
}: {
  onOpenAlbum: (album: AlbumLike) => void;
  onOpenArtist: (artist: ArtistRef) => void;
}) {
  const [data, setData] = useState<ForYouDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ForYouDTO>("/api/for-you")
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
  }, []);

  if (loading || !data || data.albums.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        {TITLES[data.mode]}
      </h2>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {data.albums.map((a) => (
          <AlbumCard
            key={a.id}
            album={a}
            onOpen={onOpenAlbum}
            onOpenArtist={onOpenArtist}
            showQuickActions={false}
          />
        ))}
      </div>
    </section>
  );
}
