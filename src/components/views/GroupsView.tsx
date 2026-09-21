"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, Plus, Trash2, UserPlus, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useLibrary } from "@/context/LibraryContext";
import { StarRating, ratingToText } from "@/components/StarRating";
import type {
  GroupAlbumRatingDTO,
  GroupDetailDTO,
  GroupSessionDTO,
  GroupSummaryDTO,
  UserSummaryDTO,
} from "@/lib/types";
import type { AlbumLike } from "../AlbumCard";

function isPastDate(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

function AlbumCover({ album, size = 44 }: { album: AlbumLike; size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded bg-neutral-800"
      style={{ width: size, height: size }}
    >
      {album.coverUrl && <img src={album.coverUrl} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}

function AddMemberBox({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
  const { notify } = useLibrary();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSummaryDTO[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void apiFetch<{ users: UserSummaryDTO[] }>(
        `/api/users/search?q=${encodeURIComponent(query)}`
      ).then((data) => {
        if (!cancelled) setResults(data.users);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) setResults([]);
  }

  async function handleAdd(userId: string) {
    setBusyId(userId);
    try {
      await apiFetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setResults((r) => r.filter((u) => u.id !== userId));
      setQuery("");
      onAdded();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível adicionar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/10">
      <input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Buscar pessoa por nome ou email…"
        className="rounded bg-neutral-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-accent/50"
      />
      {results.length > 0 && (
        <ul className="flex flex-col gap-1">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 px-1">
              <span className="truncate text-sm text-neutral-200">{u.name || "Sem nome"}</span>
              <button
                type="button"
                disabled={busyId === u.id}
                onClick={() => void handleAdd(u.id)}
                className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-neutral-950 hover:bg-neutral-300 disabled:opacity-50"
              >
                Adicionar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionRow({
  session,
  onOpenAlbum,
  onRate,
}: {
  session: GroupSessionDTO;
  onOpenAlbum: (album: AlbumLike) => void;
  onRate: (sessionId: string, rating: number | null) => void;
}) {
  const date = new Date(session.scheduledFor);
  const isPast = isPastDate(session.scheduledFor);

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => onOpenAlbum(session.album)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <AlbumCover album={session.album} />
        <div className="min-w-0">
          <p className="truncate text-sm text-neutral-100">{session.album.title}</p>
          <p className="truncate text-xs text-neutral-500">{session.album.artist}</p>
          <p className="text-xs text-neutral-600">
            {date.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}
            {!isPast && <span className="ml-1 text-accent-soft">· agendada</span>}
          </p>
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <StarRating value={session.myRating} onChange={(v) => onRate(session.id, v)} size={16} />
        <p className="text-xs text-neutral-500">
          média do grupo: {session.avgRating != null ? ratingToText(session.avgRating) : "—"} (
          {session.ratings.length})
        </p>
      </div>
    </li>
  );
}

function AlbumRatingRow({
  entry,
  onOpenAlbum,
}: {
  entry: GroupAlbumRatingDTO;
  onOpenAlbum: (album: AlbumLike) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenAlbum(entry.album)}
      className="flex items-center gap-3 rounded-lg bg-neutral-900 p-3 text-left ring-1 ring-white/5 hover:ring-accent/40"
    >
      <AlbumCover album={entry.album} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-neutral-100">{entry.album.title}</p>
        <p className="truncate text-xs text-neutral-500">{entry.album.artist}</p>
      </div>
      <div className="shrink-0 text-right text-xs text-neutral-400">
        <p className="text-sm font-medium text-neutral-100">
          {entry.avgRating != null ? ratingToText(entry.avgRating) : "—"}
        </p>
        <p>
          {entry.ratingCount} nota{entry.ratingCount === 1 ? "" : "s"}
        </p>
      </div>
    </button>
  );
}

function GroupDetail({
  groupId,
  onBack,
  onOpenAlbum,
  onDeleted,
}: {
  groupId: string;
  onBack: () => void;
  onOpenAlbum: (album: AlbumLike) => void;
  onDeleted: () => void;
}) {
  const { notify } = useLibrary();
  const [group, setGroup] = useState<GroupDetailDTO | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [schedulingSession, setSchedulingSession] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<{ group: GroupDetailDTO }>(`/api/groups/${groupId}`);
    setGroup(data.group);
  }

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ group: GroupDetailDTO }>(`/api/groups/${groupId}`).then((data) => {
      if (!cancelled) setGroup(data.group);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  async function handleCreateSession() {
    if (!scheduledFor) return;
    setCreatingSession(true);
    setSessionError(null);
    try {
      await apiFetch(`/api/groups/${groupId}/sessions`, {
        method: "POST",
        body: JSON.stringify({ scheduledFor: new Date(scheduledFor).toISOString() }),
      });
      setScheduledFor("");
      setSchedulingSession(false);
      await load();
      notify("Sessão marcada e álbum sorteado!");
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Não foi possível criar a sessão.");
    } finally {
      setCreatingSession(false);
    }
  }

  async function handleRate(sessionId: string, rating: number | null) {
    if (rating == null || !group) return;
    setGroup({
      ...group,
      sessions: group.sessions.map((s) =>
        s.id === sessionId ? { ...s, myRating: rating } : s
      ),
    });
    try {
      await apiFetch(`/api/groups/${groupId}/sessions/${sessionId}/ratings`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      });
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível salvar a nota.");
      await load();
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!group) return;
    setGroup({ ...group, members: group.members.filter((m) => m.id !== userId) });
    try {
      await apiFetch(`/api/groups/${groupId}/members?userId=${userId}`, { method: "DELETE" });
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível remover.");
      await load();
    }
  }

  async function handleDeleteGroup() {
    if (!group || !confirm(`Excluir o grupo "${group.name}"?`)) return;
    try {
      await apiFetch(`/api/groups/${groupId}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível excluir o grupo.");
    }
  }

  if (!group) return <p className="text-sm text-neutral-500">Carregando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
      >
        <ArrowLeft size={16} /> Voltar aos grupos
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-50">{group.name}</h2>
          {group.description && <p className="text-sm text-neutral-500">{group.description}</p>}
        </div>
        {group.isOwner && (
          <button
            type="button"
            onClick={() => void handleDeleteGroup()}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 hover:bg-red-900/60 hover:text-red-300"
          >
            <Trash2 size={14} /> Excluir grupo
          </button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-300">
            Membros ({group.members.length})
          </h3>
          {group.isOwner && (
            <button
              type="button"
              onClick={() => setAddingMember((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
            >
              <UserPlus size={14} /> Adicionar
            </button>
          )}
        </div>
        {addingMember && (
          <AddMemberBox groupId={groupId} onAdded={() => void load()} />
        )}
        <ul className="flex flex-wrap gap-2">
          {group.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-full bg-neutral-900 py-1 pl-1 pr-2.5 ring-1 ring-white/10"
            >
              <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-neutral-800">
                {m.avatarUrl && <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <span className="text-xs text-neutral-200">{m.name || "Sem nome"}</span>
              {group.isOwner && m.id !== group.createdById && (
                <button
                  type="button"
                  onClick={() => void handleRemoveMember(m.id)}
                  className="text-neutral-500 hover:text-red-400"
                  aria-label="Remover do grupo"
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-300">Sessões</h3>
          <button
            type="button"
            onClick={() => setSchedulingSession((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-300"
          >
            <CalendarPlus size={14} /> Marcar sessão
          </button>
        </div>

        {schedulingSession && (
          <div className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/10">
            <p className="text-xs text-neutral-500">
              O álbum é sorteado na hora, entre os álbuns curtidos, marcados pra ouvir ou já
              registrados pelos membros do grupo.
            </p>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
            />
            {sessionError && <p className="text-xs text-red-400">{sessionError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={creatingSession || !scheduledFor}
                onClick={() => void handleCreateSession()}
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300 disabled:opacity-50"
              >
                {creatingSession ? "Sorteando…" : "Sortear e marcar"}
              </button>
              <button
                type="button"
                onClick={() => setSchedulingSession(false)}
                className="rounded-full bg-neutral-700 px-4 py-1.5 text-sm text-neutral-200 hover:bg-neutral-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {group.sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma sessão marcada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {group.sessions.map((s) => (
              <SessionRow key={s.id} session={s} onOpenAlbum={onOpenAlbum} onRate={handleRate} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-300">Nota média por álbum</h3>
        {group.albumRatings.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Ainda não há notas — avalie um álbum depois de uma sessão.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.albumRatings.map((entry) => (
              <AlbumRatingRow key={entry.album.id} entry={entry} onOpenAlbum={onOpenAlbum} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function GroupsView({ onOpenAlbum }: { onOpenAlbum: (album: AlbumLike) => void }) {
  const { notify } = useLibrary();
  const [groups, setGroups] = useState<GroupSummaryDTO[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    const data = await apiFetch<{ groups: GroupSummaryDTO[] }>("/api/groups");
    setGroups(data.groups);
  }

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ groups: GroupSummaryDTO[] }>("/api/groups").then((data) => {
      if (!cancelled) setGroups(data.groups);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const data = await apiFetch<{ group: GroupSummaryDTO }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      setName("");
      setDescription("");
      setCreating(false);
      await load();
      setSelectedId(data.group.id);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Não foi possível criar o grupo.");
    }
  }

  if (selectedId) {
    return (
      <GroupDetail
        groupId={selectedId}
        onBack={() => {
          setSelectedId(null);
          void load();
        }}
        onOpenAlbum={onOpenAlbum}
        onDeleted={() => {
          setSelectedId(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Grupos de escuta</h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300"
        >
          <Plus size={15} /> Novo grupo
        </button>
      </div>

      {creating && (
        <div className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-4 ring-1 ring-white/10">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do grupo"
            className="rounded bg-neutral-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-accent/50"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="rounded bg-neutral-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-accent/50"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300"
            >
              Criar
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-full bg-neutral-700 px-4 py-1.5 text-sm text-neutral-200 hover:bg-neutral-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {groups == null && <p className="text-sm text-neutral-500">Carregando…</p>}

      {groups?.length === 0 && !creating && (
        <div className="rounded-lg bg-neutral-900 p-8 text-center text-neutral-500">
          Nenhum grupo ainda. Crie um pra marcar escutas conjuntas com seus amigos.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups?.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelectedId(g.id)}
            className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-4 text-left ring-1 ring-white/5 hover:ring-accent/40"
          >
            <div className="flex -space-x-2">
              {g.avatarUrls.length > 0 ? (
                g.avatarUrls.map((url, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 overflow-hidden rounded-full bg-neutral-800 ring-2 ring-neutral-900"
                  >
                    {url && <img src={url} alt="" className="h-full w-full object-cover" />}
                  </div>
                ))
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-sm ring-2 ring-neutral-900">
                  🎧
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-neutral-100">{g.name}</p>
              {g.description && <p className="truncate text-xs text-neutral-500">{g.description}</p>}
              <p className="text-xs text-neutral-600">
                {g.memberCount} membro{g.memberCount === 1 ? "" : "s"} · {g.sessionCount}{" "}
                {g.sessionCount === 1 ? "sessão" : "sessões"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
