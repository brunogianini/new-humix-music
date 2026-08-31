"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useLibrary } from "@/context/LibraryContext";
import type { RecommendationDTO } from "@/lib/types";
import type { AlbumLike } from "../AlbumCard";

function daysLeft(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

function statusLabel(rec: RecommendationDTO): { text: string; className: string } {
  switch (rec.status) {
    case "PENDING": {
      const days = daysLeft(rec.expiresAt);
      return {
        text: days <= 0 ? "expira hoje" : `expira em ${days} ${days === 1 ? "dia" : "dias"}`,
        className: "text-amber-400",
      };
    }
    case "COMPLETED":
      return { text: "cumprida ✓", className: "text-accent-soft" };
    case "SHAMED":
      return { text: "não cumprida — nota enviada", className: "text-red-400" };
    case "EXPIRED":
      return { text: "prazo esgotado", className: "text-red-400" };
  }
}

function RecommendationRow({
  rec,
  scope,
  onOpenAlbum,
  onShamed,
}: {
  rec: RecommendationDTO;
  scope: "received" | "sent";
  onOpenAlbum: (album: AlbumLike) => void;
  onShamed: (id: string, text: string) => void;
}) {
  const [shaming, setShaming] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const other = scope === "received" ? rec.fromUser : rec.toUser;
  const status = statusLabel(rec);

  async function handleSendShame() {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/recommendations/${rec.id}/shame`, {
        method: "POST",
        body: JSON.stringify({ text: text.trim() }),
      });
      onShamed(rec.id, text.trim());
      setShaming(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar a nota.");
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onOpenAlbum(rec.album)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-neutral-800">
            {rec.album.coverUrl && (
              <img src={rec.album.coverUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-neutral-100">{rec.album.title}</p>
            <p className="truncate text-xs text-neutral-500">{rec.album.artist}</p>
          </div>
        </button>
        <div className="shrink-0 text-right text-xs">
          <Link href={`/u/${other.id}`} className="text-neutral-400 hover:underline">
            {scope === "received" ? "de " : "para "}
            {other.name || "alguém"}
          </Link>
          <p className={`mt-0.5 inline-flex items-center gap-1 ${status.className}`}>
            <Clock size={11} /> {status.text}
          </p>
        </div>
      </div>

      {rec.message && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-400">“{rec.message}”</p>
      )}

      {scope === "sent" && rec.status === "EXPIRED" && (
        <div className="mt-2">
          {shaming ? (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escreva a nota de vergonha (fica pública no perfil dele/dela)…"
                rows={2}
                maxLength={280}
                className="w-full resize-none rounded bg-neutral-800 p-2 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void handleSendShame()}
                  className="rounded-full bg-red-900/60 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-900 disabled:opacity-50"
                >
                  {sending ? "Enviando…" : "Publicar nota"}
                </button>
                <button
                  type="button"
                  onClick={() => setShaming(false)}
                  className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShaming(true)}
              className="text-xs text-red-400 hover:underline"
            >
              😳 Deixar nota de vergonha
            </button>
          )}
        </div>
      )}

      {scope === "sent" && rec.status === "SHAMED" && rec.shameNote && (
        <p className="mt-2 text-xs text-neutral-500">Nota publicada: “{rec.shameNote.text}”</p>
      )}
    </li>
  );
}

export function FriendsView({ onOpenAlbum }: { onOpenAlbum: (album: AlbumLike) => void }) {
  const { notify } = useLibrary();
  const [scope, setScope] = useState<"received" | "sent">("received");
  const [recommendations, setRecommendations] = useState<RecommendationDTO[] | null>(null);

  useEffect(() => {
    void apiFetch<{ recommendations: RecommendationDTO[] }>(`/api/recommendations?scope=${scope}`).then((d) =>
      setRecommendations(d.recommendations)
    );
  }, [scope]);

  function handleScopeChange(next: "received" | "sent") {
    setScope(next);
    setRecommendations(null);
  }

  function handleShamed(id: string, text: string) {
    setRecommendations((cur) =>
      cur?.map((r) =>
        r.id === id
          ? { ...r, status: "SHAMED", shameNote: { id: "local", text, createdAt: new Date().toISOString() } }
          : r
      ) ?? null
    );
    notify("Nota de vergonha publicada.");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex w-fit rounded-full bg-neutral-800 p-1 ring-1 ring-white/10">
        {(["received", "sent"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleScopeChange(s)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              scope === s ? "bg-accent text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {s === "received" ? "Recebidas" : "Enviadas"}
          </button>
        ))}
      </div>

      {recommendations == null && <p className="text-sm text-neutral-500">Carregando…</p>}
      {recommendations?.length === 0 && (
        <div className="rounded-lg bg-neutral-900 p-8 text-center text-neutral-500">
          {scope === "received"
            ? "Nenhuma recomendação recebida ainda. Peça pra um amigo mútuo te recomendar um álbum!"
            : "Você ainda não recomendou nenhum álbum. Vá ao perfil de um amigo mútuo pra recomendar."}
        </div>
      )}
      {recommendations && recommendations.length > 0 && (
        <ul className="flex flex-col gap-2">
          {recommendations.map((rec) => (
            <RecommendationRow
              key={rec.id}
              rec={rec}
              scope={scope}
              onOpenAlbum={onOpenAlbum}
              onShamed={handleShamed}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
