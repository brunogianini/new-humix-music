"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useLibrary } from "@/context/LibraryContext";
import type { SearchResult } from "@/lib/spotify";

export function RecommendAlbumModal({
  friendId,
  friendName,
  onClose,
}: {
  friendId: string;
  friendName: string;
  onClose: () => void;
}) {
  const { ensureAlbum, notify } = useLibrary();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || picked) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(res.ok ? (data.results ?? []) : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, picked]);

  async function handleSend() {
    if (!picked) return;
    setSending(true);
    setError(null);
    try {
      const album = await ensureAlbum(picked);
      await apiFetch("/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ toUserId: friendId, albumId: album.id, message: message.trim() || null }),
      });
      notify(`Você recomendou ${album.title} para ${friendName}.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar a recomendação.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-neutral-900 p-5 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-50">Recomendar álbum para {friendName}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>

        {picked ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg bg-neutral-800/60 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-neutral-800">
                {picked.coverUrl && <img src={picked.coverUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-100">{picked.title}</p>
                <p className="truncate text-xs text-neutral-500">{picked.artist}</p>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300"
              >
                Trocar
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Uma mensagem para acompanhar a recomendação (opcional)…"
              rows={3}
              maxLength={280}
              className="w-full resize-none rounded bg-neutral-800 p-2 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <p className="text-xs text-neutral-500">
              {friendName} tem 7 dias para ouvir e escrever uma resenha.
            </p>
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSend()}
              className="self-start rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300 disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Recomendar"}
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar álbum por título ou artista…"
                className="w-full rounded-full bg-neutral-800 py-2 pl-9 pr-4 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading && <p className="px-1 py-2 text-sm text-neutral-500">Buscando…</p>}
              {!loading && query.trim() && results.length === 0 && (
                <p className="px-1 py-2 text-sm text-neutral-500">Nenhum álbum encontrado.</p>
              )}
              <div className="flex flex-col gap-1">
                {(query.trim() ? results : []).map((r) => (
                  <button
                    key={r.mbid}
                    type="button"
                    onClick={() => setPicked(r)}
                    className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-neutral-800"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-neutral-800">
                      {r.coverUrl && <img src={r.coverUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-100">{r.title}</p>
                      <p className="truncate text-xs text-neutral-500">{r.artist}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
