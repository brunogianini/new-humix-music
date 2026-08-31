"use client";

import { useState } from "react";
import { Pencil, Repeat, Trash2 } from "lucide-react";
import { StarRating } from "../StarRating";
import { useLibrary } from "@/context/LibraryContext";
import type { DiaryEntryDTO } from "@/lib/types";
import type { AlbumLike, ArtistRef } from "../AlbumCard";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DiaryView({
  onOpenAlbum,
  onOpenArtist,
}: {
  onOpenAlbum: (album: AlbumLike) => void;
  onOpenArtist: (artist: ArtistRef) => void;
}) {
  const { diaryLogs, loading } = useLibrary();

  if (loading) return <p className="text-sm text-neutral-500">Carregando…</p>;

  if (diaryLogs.length === 0) {
    return (
      <div className="rounded-lg bg-neutral-900 p-8 text-center text-neutral-500">
        Seu diário está vazio. Busque um álbum e registre sua primeira escuta.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {diaryLogs.map((log) => (
        <DiaryRow key={log.id} log={log} onOpenAlbum={onOpenAlbum} onOpenArtist={onOpenArtist} />
      ))}
    </ul>
  );
}

function DiaryRow({
  log,
  onOpenAlbum,
  onOpenArtist,
}: {
  log: DiaryEntryDTO;
  onOpenAlbum: (album: AlbumLike) => void;
  onOpenArtist: (artist: ArtistRef) => void;
}) {
  const { updateLog, deleteLog } = useLibrary();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState<number | null>(log.rating);
  const [review, setReview] = useState(log.review ?? "");
  const [listenedOn, setListenedOn] = useState(log.listenedOn.slice(0, 10));
  const [imgError, setImgError] = useState(false);

  return (
    <li className="flex gap-3 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5">
      <button
        type="button"
        onClick={() => onOpenAlbum(log.album)}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-800"
      >
        {log.album.coverUrl && !imgError ? (
          <img
            src={log.album.coverUrl}
            alt={log.album.title}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg">💿</div>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <button
              type="button"
              onClick={() => onOpenAlbum(log.album)}
              className="truncate text-left text-sm font-medium text-neutral-100 hover:text-accent"
            >
              {log.album.title}
            </button>
            <button
              type="button"
              onClick={() => onOpenArtist({ name: log.album.artist, mbid: null })}
              className="truncate text-left text-sm font-normal text-neutral-500 hover:text-accent"
            >
              {log.album.artist}
            </button>
          </div>
          <span className="shrink-0 text-xs text-neutral-500">
            {formatDate(log.listenedOn)}
          </span>
        </div>

        {editing ? (
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-3">
              <StarRating value={rating} onChange={setRating} size={16} />
              <input
                type="date"
                value={listenedOn}
                onChange={(e) => setListenedOn(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none ring-1 ring-white/10"
              />
            </div>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={2}
              className="mt-2 w-full resize-none rounded bg-neutral-800 p-2 text-sm outline-none ring-1 ring-white/10"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await updateLog(log.id, {
                    rating,
                    review: review.trim() || null,
                    listenedOn: new Date(listenedOn).toISOString(),
                  });
                  setEditing(false);
                }}
                className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-neutral-300"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full bg-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1 flex items-center gap-2">
              <StarRating value={log.rating} readOnly size={14} />
              {log.relisten && (
                <span className="inline-flex items-center gap-1 text-xs text-accent-soft">
                  <Repeat size={11} /> reescuta
                </span>
              )}
            </div>
            {log.review && (
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-neutral-300">
                {log.review}
              </p>
            )}
          </>
        )}
      </div>

      {!editing && (
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => confirm("Remover este registro?") && void deleteLog(log.id)}
            className="rounded p-1.5 text-neutral-500 hover:bg-red-900/60 hover:text-red-300"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </li>
  );
}
