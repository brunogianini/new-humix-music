"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, Heart, ListPlus, Pencil, Plus, Repeat, Trash2, X } from "lucide-react";
import { StarRating, ratingToText } from "./StarRating";
import { TrackList } from "./TrackList";
import { RelatedAlbums } from "./RelatedAlbums";
import { useLibrary } from "@/context/LibraryContext";
import type { AlbumWithStats, DiaryEntryDTO } from "@/lib/types";
import type { AlbumLike, ArtistRef } from "./AlbumCard";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function artistMbidOf(a: AlbumLike): string | null {
  return "artistMbid" in a ? a.artistMbid : null;
}

export function AlbumModal({
  album,
  onClose,
  onOpenArtist,
  onOpenAlbum,
}: {
  album: AlbumLike;
  onClose: () => void;
  onOpenArtist: (artist: ArtistRef) => void;
  onOpenAlbum?: (album: AlbumLike) => void;
}) {
  const {
    albums,
    diaryLogs,
    lists,
    addToList,
    createList,
    deleteAlbum,
    ensureAlbum,
    logListen,
    setLiked,
    setWantToListen,
  } = useLibrary();

  const cached = albums.find((a) => a.mbid === album.mbid);
  const stats: AlbumWithStats =
    cached ??
    ("avgRating" in album
      ? album
      : {
          id: "id" in album ? album.id : "",
          mbid: album.mbid,
          title: album.title,
          artist: album.artist,
          coverUrl: album.coverUrl,
          releaseDate: album.releaseDate,
          liked: false,
          wantToListen: false,
          avgRating: null,
          logCount: 0,
          lastListenedOn: null,
          communityAvgRating: null,
          communityLogCount: 0,
        });

  const [imgError, setImgError] = useState(false);
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);

  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [listenedOn, setListenedOn] = useState(today());
  const [relisten, setRelisten] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  // Bumped whenever the viewer logs a new rating, so the related albums
  // panel refetches with the new effective rating.
  const [ratingVersion, setRatingVersion] = useState(0);
  // Related albums need a real Album row. For an album not yet in the
  // viewer's library, `stats.id` is empty until ensureAlbum() resolves here
  // (TrackList ensures it too, but that update doesn't reach this component).
  const [ensuredAlbumId, setEnsuredAlbumId] = useState<string | null>(stats.id || null);
  const [prevEnsureMbid, setPrevEnsureMbid] = useState(album.mbid);
  if (album.mbid !== prevEnsureMbid) {
    setPrevEnsureMbid(album.mbid);
    setEnsuredAlbumId(stats.id || null);
  }
  useEffect(() => {
    let cancelled = false;
    ensureAlbum(album)
      .then((a) => {
        if (!cancelled) setEnsuredAlbumId(a.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.mbid]);
  // Instant toggle feedback for brand-new albums that still need one lookup
  // request before they exist in context.
  const [likedOverride, setLikedOverride] = useState<boolean | null>(null);
  const [wantOverride, setWantOverride] = useState<boolean | null>(null);

  // Once the real data catches up to the optimistic guess, drop the override
  // (adjusted during render, not an effect, so there's no extra flash).
  if (likedOverride !== null && stats.liked === likedOverride) setLikedOverride(null);
  if (wantOverride !== null && stats.wantToListen === wantOverride) setWantOverride(null);

  // diaryLogs is kept in sync optimistically by the context, so deriving from
  // it here means the history below updates in the same tick as any action.
  const logs = useMemo(
    () =>
      diaryLogs
        .filter((l) => l.albumId === stats.id)
        .slice()
        .sort((a, b) => (a.listenedOn < b.listenedOn ? 1 : a.listenedOn > b.listenedOn ? -1 : 0)),
    [diaryLogs, stats.id]
  );

  // Reset the relisten default whenever a different album's modal opens,
  // without a useEffect round-trip (adjust-during-render pattern).
  const [prevAlbumId, setPrevAlbumId] = useState(stats.id);
  // Shown expanded only for the first log on an album; once there's history,
  // it collapses to a button so the card doesn't grow taller than the screen.
  const [showLogForm, setShowLogForm] = useState(logs.length === 0);
  if (stats.id !== prevAlbumId) {
    setPrevAlbumId(stats.id);
    setRelisten(logs.length > 0);
    setShowLogForm(logs.length === 0);
  }

  async function handleSubmitLog() {
    setSaving(true);
    try {
      await logListen(album, {
        rating,
        review: review.trim() || null,
        listenedOn: new Date(listenedOn).toISOString(),
        relisten,
      });
      setRating(null);
      setReview("");
      setListenedOn(today());
      setRatingVersion((v) => v + 1);
      setShowLogForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddToList(listId: string) {
    await addToList(listId, album);
    setListMenuOpen(false);
  }

  async function handleCreateAndAdd() {
    if (!newListName.trim()) return;
    const list = await createList(newListName.trim());
    await addToList(list.id, album);
    setNewListName("");
    setShowNewList(false);
    setListMenuOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl bg-neutral-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-neutral-300 hover:bg-black/70 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col gap-4 p-5 sm:flex-row">
          <div className="relative mx-auto h-44 w-44 shrink-0 sm:mx-0 sm:h-48 sm:w-48">
            <div
              aria-hidden
              className="absolute inset-[3%] translate-x-[14%] rotate-6 rounded-full bg-[repeating-radial-gradient(circle_at_50%_50%,#161616_0px,#161616_2px,#0a0a0a_3px,#0a0a0a_5px)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            >
              <div className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-800 ring-2 ring-black/70" />
              <div className="absolute left-1/2 top-1/2 h-[6%] w-[6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-950" />
            </div>
            <div className="absolute inset-0 -translate-x-[6%] overflow-hidden rounded-lg bg-neutral-800 shadow-xl ring-1 ring-white/10">
              {stats.coverUrl && !imgError ? (
                <img
                  src={stats.coverUrl}
                  alt={stats.title}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl">💿</div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-neutral-50">{stats.title}</h2>
            <button
              type="button"
              onClick={() => onOpenArtist({ name: stats.artist, mbid: artistMbidOf(album) })}
              className="text-neutral-400 hover:text-accent"
            >
              {stats.artist}
            </button>
            {stats.releaseDate && (
              <p className="text-sm text-neutral-500">{stats.releaseDate.slice(0, 4)}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !(likedOverride ?? stats.liked);
                  setLikedOverride(next);
                  void setLiked(album, next).catch(() => setLikedOverride(null));
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                  (likedOverride ?? stats.liked)
                    ? "bg-rose-500 text-white"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                <Heart size={14} fill={(likedOverride ?? stats.liked) ? "currentColor" : "none"} /> Curtir
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !(wantOverride ?? stats.wantToListen);
                  setWantOverride(next);
                  void setWantToListen(album, next).catch(() => setWantOverride(null));
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                  (wantOverride ?? stats.wantToListen)
                    ? "bg-accent text-neutral-950"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                <Bookmark size={14} fill={(wantOverride ?? stats.wantToListen) ? "currentColor" : "none"} /> Quero
                ouvir
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setListMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-700"
                >
                  <ListPlus size={14} /> Lista
                </button>
                {listMenuOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg bg-neutral-800 p-2 shadow-xl ring-1 ring-white/10">
                    {lists.length === 0 && !showNewList && (
                      <p className="px-2 py-1 text-xs text-neutral-500">Nenhuma lista ainda.</p>
                    )}
                    <div className="max-h-40 overflow-y-auto">
                      {lists.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => void handleAddToList(l.id)}
                          className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>
                    {showNewList ? (
                      <div className="mt-1 flex gap-1 border-t border-white/10 pt-2">
                        <input
                          autoFocus
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          placeholder="Nome da lista"
                          className="w-full rounded bg-neutral-900 px-2 py-1 text-sm outline-none ring-1 ring-white/10 focus:ring-accent/50"
                          onKeyDown={(e) => e.key === "Enter" && void handleCreateAndAdd()}
                        />
                        <button
                          type="button"
                          onClick={() => void handleCreateAndAdd()}
                          className="shrink-0 rounded bg-accent px-2 text-sm text-neutral-950 hover:bg-neutral-300"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowNewList(true)}
                        className="mt-1 block w-full rounded border-t border-white/10 px-2 py-1.5 pt-2 text-left text-sm text-accent-soft hover:bg-neutral-700"
                      >
                        + Nova lista
                      </button>
                    )}
                  </div>
                )}
              </div>

              {stats.id && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remover este álbum da sua biblioteca? Suas avaliações, curtidas e histórico serão apagados.")) {
                      void deleteAlbum(stats.id).then(onClose);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 hover:bg-red-900/60 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {(stats.logCount > 0 || stats.avgRating != null) && (
              <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
                <StarRating value={stats.avgRating} readOnly size={16} />
                <span>
                  {ratingToText(stats.avgRating)} de 5
                  {stats.logCount > 0 && ` · ouvido ${stats.logCount}x`}
                </span>
              </div>
            )}
            {stats.communityLogCount > 0 && (
              <div className="mt-1.5 flex items-center gap-2 text-sm text-neutral-500">
                <StarRating value={stats.communityAvgRating} readOnly size={14} />
                <span>
                  {ratingToText(stats.communityAvgRating)} de 5 na comunidade ·{" "}
                  {stats.communityLogCount} {stats.communityLogCount === 1 ? "avaliação" : "avaliações"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 p-5">
          {showLogForm ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  Registrar escuta
                </h3>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLogForm(false)}
                    className="text-xs text-neutral-500 hover:text-neutral-300"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <StarRating value={rating} onChange={setRating} size={22} />
                  <input
                    type="date"
                    value={listenedOn}
                    onChange={(e) => setListenedOn(e.target.value)}
                    max={today()}
                    className="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-200 outline-none ring-1 ring-white/10 focus:ring-accent/50"
                  />
                  <label className="flex items-center gap-1.5 text-sm text-neutral-400">
                    <input
                      type="checkbox"
                      checked={relisten}
                      onChange={(e) => setRelisten(e.target.checked)}
                      className="accent-accent"
                    />
                    <Repeat size={14} /> reescuta
                  </label>
                </div>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Escreva uma resenha (opcional)…"
                  rows={3}
                  className="w-full resize-none rounded bg-neutral-800 p-2 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSubmitLog()}
                  className="self-start rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300 disabled:opacity-50"
                >
                  {saving ? "Salvando…" : "Salvar registro"}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogForm(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-700"
            >
              <Plus size={14} /> Registrar escuta
            </button>
          )}
        </div>

        {logs.length > 0 && (
          <div className="border-t border-white/10 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Histórico ({logs.length})
            </h3>
            <ul className="flex flex-col gap-3">
              {logs.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  editing={editingLogId === log.id}
                  onEditToggle={() => setEditingLogId(editingLogId === log.id ? null : log.id)}
                  onSaved={() => setEditingLogId(null)}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-white/10 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Faixas
          </h3>
          <TrackList album={album} />
        </div>

        {ensuredAlbumId && onOpenAlbum && (
          <RelatedAlbums
            albumId={ensuredAlbumId}
            refreshToken={ratingVersion}
            onOpenAlbum={onOpenAlbum}
            onOpenArtist={onOpenArtist}
          />
        )}
      </div>
    </div>
  );
}

function LogRow({
  log,
  editing,
  onEditToggle,
  onSaved,
}: {
  log: DiaryEntryDTO;
  editing: boolean;
  onEditToggle: () => void;
  onSaved: () => void;
}) {
  const { updateLog, deleteLog } = useLibrary();
  const [rating, setRating] = useState<number | null>(log.rating);
  const [review, setReview] = useState(log.review ?? "");
  const [listenedOn, setListenedOn] = useState(log.listenedOn.slice(0, 10));

  if (editing) {
    return (
      <li className="rounded-lg bg-neutral-800/60 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <StarRating value={rating} onChange={setRating} size={18} />
          <input
            type="date"
            value={listenedOn}
            onChange={(e) => setListenedOn(e.target.value)}
            max={today()}
            className="rounded bg-neutral-900 px-2 py-1 text-sm text-neutral-200 outline-none ring-1 ring-white/10"
          />
        </div>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={2}
          className="mt-2 w-full resize-none rounded bg-neutral-900 p-2 text-sm outline-none ring-1 ring-white/10"
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
              onSaved();
            }}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-neutral-300"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={onEditToggle}
            className="rounded-full bg-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-600"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg bg-neutral-800/40 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span>{formatDate(log.listenedOn)}</span>
          {log.relisten && (
            <span className="inline-flex items-center gap-1 text-accent-soft">
              <Repeat size={11} /> reescuta
            </span>
          )}
        </div>
        <div className="mt-1">
          <StarRating value={log.rating} readOnly size={14} />
        </div>
        {log.review && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-300">{log.review}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onEditToggle}
          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => confirm("Remover este registro?") && void deleteLog(log.id).then(onSaved)}
          className="rounded p-1.5 text-neutral-500 hover:bg-red-900/60 hover:text-red-300"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
