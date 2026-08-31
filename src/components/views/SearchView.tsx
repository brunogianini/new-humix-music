"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AlbumCard, type AlbumLike, type ArtistRef } from "../AlbumCard";
import { UserSearchResults } from "../profile/UserSearchResults";
import type { SearchResult } from "@/lib/spotify";

export function SearchView({
  onOpenAlbum,
  onOpenArtist,
}: {
  onOpenAlbum: (album: AlbumLike) => void;
  onOpenArtist: (artist: ArtistRef) => void;
}) {
  const [scope, setScope] = useState<"albums" | "people">("albums");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEmpty = !query.trim();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || scope !== "albums") return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Falha na busca.");
        setResults(data.results ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha na busca.");
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, scope]);

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex w-fit rounded-full bg-neutral-800 p-1 ring-1 ring-white/10">
        {(["albums", "people"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              scope === s ? "bg-accent text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {s === "albums" ? "Álbuns" : "Pessoas"}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
        />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            scope === "albums" ? "Buscar álbuns por título ou artista…" : "Buscar pessoas por nome…"
          }
          className="w-full rounded-full bg-neutral-800 py-2.5 pl-10 pr-4 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
        />
      </div>

      {scope === "people" ? (
        <UserSearchResults query={query} />
      ) : (
        <>
          {!isEmpty && loading && <p className="text-sm text-neutral-500">Buscando…</p>}
          {!isEmpty && error && <p className="text-sm text-red-400">{error}</p>}
          {!isEmpty && !loading && searched && results.length === 0 && !error && (
            <p className="text-sm text-neutral-500">Nenhum álbum encontrado para “{query}”.</p>
          )}

          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {!isEmpty &&
              results.map((r) => (
                <div key={r.mbid} className="flex flex-col">
                  <AlbumCard album={r} onOpen={onOpenAlbum} onOpenArtist={onOpenArtist} />
                  {r.primaryType && (
                    <span className="mt-1 self-start rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                      {r.primaryType}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
