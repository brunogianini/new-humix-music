"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Disc3 } from "lucide-react";
import { AlbumCard, type AlbumLike, type ArtistRef } from "../AlbumCard";
import type { SearchResult } from "@/lib/spotify";

export function ArtistView({
  artist,
  onOpenAlbum,
  onBack,
}: {
  artist: ArtistRef;
  onOpenAlbum: (album: AlbumLike) => void;
  onBack: () => void;
}) {
  const [releases, setReleases] = useState<SearchResult[]>([]);
  const [displayName, setDisplayName] = useState(artist.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset loading/error the instant a different artist is opened, without an
  // extra effect-triggered render (adjust-during-render, same pattern as
  // AlbumModal's prevAlbumId reset).
  const artistKey = `${artist.mbid ?? ""}|${artist.name}`;
  const [prevArtistKey, setPrevArtistKey] = useState(artistKey);
  if (artistKey !== prevArtistKey) {
    setPrevArtistKey(artistKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ name: artist.name });
    if (artist.mbid) params.set("id", artist.mbid);

    fetch(`/api/artists?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Falha ao carregar o artista.");
        return data as { artist: { id: string; name: string }; releases: SearchResult[] };
      })
      .then((data) => {
        if (cancelled) return;
        setDisplayName(data.artist?.name ?? artist.name);
        setReleases(data.releases ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar o artista.");
          setReleases([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artist.mbid, artist.name]);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-accent-soft ring-1 ring-white/10">
          <Disc3 size={30} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold text-neutral-50">{displayName}</h2>
          <p className="text-sm text-neutral-500">
            {loading
              ? "Carregando discografia…"
              : `${releases.length} álbum${releases.length === 1 ? "" : "ns"} e EP${releases.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && releases.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhum álbum ou EP encontrado para este artista.
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {releases.map((r) => (
          <AlbumCard key={r.mbid} album={r} onOpen={onOpenAlbum} />
        ))}
      </div>
    </div>
  );
}
