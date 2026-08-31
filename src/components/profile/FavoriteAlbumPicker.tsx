"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { SearchResult } from "@/lib/spotify";
import type { AlbumDTO } from "@/lib/types";

export function FavoriteAlbumPicker({
  value,
  onChange,
}: {
  value: AlbumDTO | null;
  onChange: (album: AlbumDTO | SearchResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(res.ok ? (data.results ?? []) : []);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-neutral-800 p-2 ring-1 ring-white/10">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-neutral-700">
          {value.coverUrl && (
            <img src={value.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-neutral-100">{value.title}</p>
          <p className="truncate text-xs text-neutral-500">{value.artist}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar álbum favorito…"
          className="w-full rounded-full bg-neutral-800 py-2 pl-9 pr-3 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
        />
      </div>
      {loading && <p className="text-xs text-neutral-500">Buscando…</p>}
      {query.trim() && results.length > 0 && (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg bg-neutral-800/60 p-1">
          {results.map((r) => (
            <button
              key={r.mbid}
              type="button"
              onClick={() => {
                onChange(r);
                setQuery("");
                setResults([]);
              }}
              className="flex items-center gap-2 rounded p-1.5 text-left hover:bg-neutral-700"
            >
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-neutral-700">
                {r.coverUrl && <img src={r.coverUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-100">{r.title}</p>
                <p className="truncate text-xs text-neutral-500">{r.artist}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
