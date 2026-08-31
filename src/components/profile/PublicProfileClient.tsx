"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Disc3, Pencil, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { StreakHeatmap } from "@/components/StreakHeatmap";
import { StarRating, ratingToText } from "@/components/StarRating";
import { AlbumModal } from "@/components/AlbumModal";
import { FollowButton } from "./FollowButton";
import { FollowListModal } from "./FollowListModal";
import { EditProfileModal } from "./EditProfileModal";
import { FriendshipBadge } from "./FriendshipBadge";
import { RecommendAlbumModal } from "./RecommendAlbumModal";
import type { AlbumLike } from "@/components/AlbumCard";
import type { DiaryEntryDTO, ListSummaryDTO, PublicProfileDTO } from "@/lib/types";

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "hoje";
  if (days === 1) return "1 dia atrás";
  return `${days} dias atrás`;
}

const TABS: { id: "diary" | "lists" | "stats"; label: string }[] = [
  { id: "diary", label: "Diário" },
  { id: "lists", label: "Listas" },
  { id: "stats", label: "Estatísticas" },
];

function ListCover({ covers }: { covers: string[] }) {
  return (
    <div className="flex gap-1">
      {covers.length > 0 ? (
        covers.slice(0, 4).map((c, i) =>
          c ? (
            <img key={i} src={c} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div key={i} className="h-10 w-10 rounded bg-neutral-800" />
          )
        )
      ) : (
        <div className="h-10 w-10 rounded bg-neutral-800" />
      )}
    </div>
  );
}

export function PublicProfileClient({ profile }: { profile: PublicProfileDTO }) {
  const [activeTab, setActiveTab] = useState<"diary" | "lists" | "stats">(profile.featuredTab);
  const [logs, setLogs] = useState<DiaryEntryDTO[] | null>(null);
  const [lists, setLists] = useState<ListSummaryDTO[] | null>(null);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const [editing, setEditing] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState<AlbumLike | null>(null);

  useEffect(() => {
    if (activeTab === "diary" && logs == null) {
      void apiFetch<{ logs: DiaryEntryDTO[] }>(`/api/users/${profile.id}/logs`).then((d) =>
        setLogs(d.logs)
      );
    }
    if (activeTab === "lists" && lists == null) {
      void apiFetch<{ lists: ListSummaryDTO[] }>(`/api/users/${profile.id}/lists`).then((d) =>
        setLists(d.lists)
      );
    }
  }, [activeTab, logs, lists, profile.id]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-neutral-950/90 px-5 backdrop-blur md:px-8">
        <Link href="/" className="flex items-center gap-2 text-accent">
          <Disc3 size={22} />
        </Link>
        <NotificationBell />
      </div>

      <div className="mx-auto max-w-4xl px-5 py-6 md:px-8">
        <div className="h-40 w-full overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/10 sm:h-52">
          {profile.coverUrl && (
            <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="-mt-10 flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-neutral-800 ring-4 ring-neutral-950">
              {profile.avatarUrl && (
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="pb-1">
              <h1 className="text-lg font-semibold text-neutral-50">
                {profile.name || "Sem nome"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <button type="button" onClick={() => setFollowModal("followers")} className="hover:underline">
                  <span className="text-neutral-300">{profile.followerCount}</span> seguidores
                </button>
                <button type="button" onClick={() => setFollowModal("following")} className="hover:underline">
                  <span className="text-neutral-300">{profile.followingCount}</span> seguindo
                </button>
                {profile.friendship && <FriendshipBadge friendship={profile.friendship} />}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2 pb-1">
            {profile.isSelf ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-1.5 text-sm text-neutral-200 ring-1 ring-white/10 hover:bg-neutral-700"
              >
                <Pencil size={14} /> Editar perfil
              </button>
            ) : (
              <>
                <FollowButton userId={profile.id} initialIsFollowing={profile.isFollowing} />
                {profile.isMutualFollow && (
                  <button
                    type="button"
                    onClick={() => setRecommending(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-1.5 text-sm text-neutral-200 ring-1 ring-white/10 hover:bg-neutral-700"
                  >
                    <Sparkles size={14} /> Recomendar álbum
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {profile.bio && <p className="mt-4 whitespace-pre-wrap break-words text-sm text-neutral-300">{profile.bio}</p>}

        {profile.favoriteAlbum && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Álbum favorito
            </h3>
            <button
              type="button"
              onClick={() => setActiveAlbum(profile.favoriteAlbum)}
              className="flex items-center gap-3 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5 hover:ring-accent/40"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-neutral-800">
                {profile.favoriteAlbum.coverUrl && (
                  <img src={profile.favoriteAlbum.coverUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm text-neutral-100">{profile.favoriteAlbum.title}</p>
                <p className="truncate text-xs text-neutral-500">{profile.favoriteAlbum.artist}</p>
              </div>
            </button>
          </div>
        )}

        {profile.pinnedLists.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Listas destacadas
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {profile.pinnedLists.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5">
                  <ListCover covers={l.covers} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-100">{l.name}</p>
                    <p className="text-xs text-neutral-500">{l.entryCount} álbuns</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.shameNotes.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              😳 Mural da vergonha
            </h3>
            <div className="flex flex-col gap-2">
              {profile.shameNotes.map((note) => (
                <div key={note.id} className="rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5">
                  <p className="whitespace-pre-wrap break-words text-sm text-neutral-300">
                    &ldquo;{note.text}&rdquo;
                  </p>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    — {note.author.name || "Alguém"}, {formatRelative(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <StreakHeatmap streak={profile.streak} />
        </div>

        <div className="mt-6 flex gap-1 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === t.id
                  ? "border-b-2 border-accent text-neutral-50"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "diary" && (
            <div className="flex flex-col gap-2">
              {logs == null && <p className="text-sm text-neutral-500">Carregando…</p>}
              {logs?.length === 0 && <p className="text-sm text-neutral-500">Nenhuma escuta registrada.</p>}
              {logs?.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setActiveAlbum(log.album)}
                  className="flex items-center gap-3 rounded-lg bg-neutral-900 p-3 text-left ring-1 ring-white/5 hover:ring-accent/40"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-neutral-800">
                    {log.album.coverUrl && (
                      <img src={log.album.coverUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-neutral-100">{log.album.title}</p>
                    <p className="truncate text-xs text-neutral-500">{log.album.artist}</p>
                    <StarRating value={log.rating} readOnly size={12} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === "lists" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lists == null && <p className="text-sm text-neutral-500">Carregando…</p>}
              {lists?.length === 0 && <p className="text-sm text-neutral-500">Nenhuma lista ainda.</p>}
              {lists?.map((l) => (
                <div key={l.id} className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
                  <ListCover covers={l.covers} />
                  <div>
                    <p className="text-sm text-neutral-100">{l.name}</p>
                    <p className="text-xs text-neutral-500">{l.entryCount} álbuns</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "stats" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
                <p className="text-2xl font-semibold text-neutral-50">{profile.stats.totalLogs}</p>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Escutas</p>
              </div>
              <div className="rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
                <p className="text-2xl font-semibold text-neutral-50">{profile.stats.distinctAlbums}</p>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Álbuns</p>
              </div>
              <div className="rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
                <p className="text-2xl font-semibold text-neutral-50">{profile.stats.distinctArtists}</p>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Artistas</p>
              </div>
              <div className="rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
                <p className="text-2xl font-semibold text-neutral-50">
                  {profile.stats.avgRating != null ? ratingToText(profile.stats.avgRating) : "—"}
                </p>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Nota média</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {followModal && (
        <FollowListModal userId={profile.id} kind={followModal} onClose={() => setFollowModal(null)} />
      )}
      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
      {recommending && (
        <RecommendAlbumModal
          friendId={profile.id}
          friendName={profile.name || "seu amigo"}
          onClose={() => setRecommending(false)}
        />
      )}
      {activeAlbum && (
        <AlbumModal
          album={activeAlbum}
          onClose={() => setActiveAlbum(null)}
          onOpenAlbum={setActiveAlbum}
          onOpenArtist={() => {}}
        />
      )}
    </div>
  );
}
