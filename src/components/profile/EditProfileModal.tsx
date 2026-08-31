"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth, type CurrentUser } from "@/context/AuthContext";
import { useLibrary } from "@/context/LibraryContext";
import { AvatarCoverUpload } from "./AvatarCoverUpload";
import { FavoriteAlbumPicker } from "./FavoriteAlbumPicker";
import { FeaturedTabSelector } from "./FeaturedTabSelector";
import { PinnedListsPicker } from "./PinnedListsPicker";
import type { AlbumDTO } from "@/lib/types";
import type { SearchResult } from "@/lib/spotify";

export function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuth();
  const { notify, ensureAlbum } = useLibrary();

  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(user.coverUrl);
  const [featuredTab, setFeaturedTab] = useState<"diary" | "lists" | "stats">(
    (user.featuredTab as "diary" | "lists" | "stats") ?? "diary"
  );
  const [favoriteAlbum, setFavoriteAlbum] = useState<AlbumDTO | null>(null);
  const [pinnedListIds, setPinnedListIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [pinned, favorite] = await Promise.all([
        apiFetch<{ listIds: string[] }>("/api/profile/pinned-lists"),
        user.favoriteAlbumId
          ? apiFetch<{ profile: { favoriteAlbum: AlbumDTO | null } }>(`/api/users/${user.id}`)
          : Promise.resolve(null),
      ]);
      setPinnedListIds(pinned.listIds);
      if (favorite) setFavoriteAlbum(favorite.profile.favoriteAlbum);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFavoriteAlbumChange(album: AlbumDTO | SearchResult | null) {
    if (!album) {
      setFavoriteAlbum(null);
      return;
    }
    const resolved = await ensureAlbum(album);
    setFavoriteAlbum(resolved);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<{ user: CurrentUser }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          bio: bio.trim() || null,
          avatarUrl,
          coverUrl,
          featuredTab,
          favoriteAlbumId: favoriteAlbum?.id ?? null,
        }),
      });
      await apiFetch("/api/profile/pinned-lists", {
        method: "PUT",
        body: JSON.stringify({ listIds: pinnedListIds }),
      });
      updateUser(data.user);
      notify("Perfil atualizado.");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-neutral-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-sm font-semibold text-neutral-100">Editar perfil</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto p-5">
          <AvatarCoverUpload
            label="Foto de perfil"
            shape="avatar"
            currentUrl={avatarUrl}
            uploadEndpoint="/api/profile/avatar"
            onChange={setAvatarUrl}
          />
          <AvatarCoverUpload
            label="Capa"
            shape="cover"
            currentUrl={coverUrl}
            uploadEndpoint="/api/profile/cover"
            onChange={setCoverUrl}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-400">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Fale um pouco sobre você…"
              className="w-full resize-none rounded bg-neutral-800 p-2 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-400">Álbum favorito</label>
            <FavoriteAlbumPicker value={favoriteAlbum} onChange={(a) => void handleFavoriteAlbumChange(a)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-400">Aba em destaque</label>
            <FeaturedTabSelector value={featuredTab} onChange={setFeaturedTab} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-400">Listas destacadas</label>
            <PinnedListsPicker value={pinnedListIds} onChange={setPinnedListIds} />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-neutral-800 px-4 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
