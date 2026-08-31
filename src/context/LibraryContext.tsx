"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type {
  AlbumDTO,
  AlbumWithStats,
  DiaryEntryDTO,
  ListDetailDTO,
  ListSummaryDTO,
  PlatformStatsDTO,
  StatsDTO,
  StreakDTO,
} from "@/lib/types";
import type { SearchResult } from "@/lib/spotify";

type LogInput = {
  rating?: number | null;
  review?: string | null;
  listenedOn?: string;
  relisten?: boolean;
};

type LibraryContextValue = {
  albums: AlbumWithStats[];
  diaryLogs: DiaryEntryDTO[];
  lists: ListSummaryDTO[];
  stats: StatsDTO | null;
  platformStats: PlatformStatsDTO | null;
  streak: StreakDTO | null;
  loading: boolean;
  toast: string | null;
  notify: (msg: string) => void;

  refreshAll: () => Promise<void>;

  ensureAlbum: (result: SearchResult | AlbumDTO) => Promise<AlbumDTO>;
  logListen: (result: SearchResult | AlbumDTO, input: LogInput) => Promise<AlbumDTO>;
  updateLog: (logId: string, input: LogInput) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;

  setLiked: (result: SearchResult | AlbumDTO, liked: boolean) => Promise<void>;
  setWantToListen: (result: SearchResult | AlbumDTO, want: boolean) => Promise<void>;
  deleteAlbum: (albumId: string) => Promise<void>;

  createList: (name: string, description?: string) => Promise<ListSummaryDTO>;
  renameList: (listId: string, name: string, description?: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  fetchListDetail: (listId: string) => Promise<ListDetailDTO>;
  addToList: (listId: string, result: SearchResult | AlbumDTO) => Promise<void>;
  removeFromList: (listId: string, albumId: string) => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function tempId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toAlbumWithStats(a: AlbumDTO): AlbumWithStats {
  return {
    ...a,
    liked: false,
    wantToListen: false,
    avgRating: null,
    logCount: 0,
    lastListenedOn: null,
    communityAvgRating: null,
    communityLogCount: 0,
  };
}

// Optimistic diary-log aggregate so the UI updates in the same tick as the
// click, instead of waiting on a server round-trip.
function aggregateFromLogs(logs: DiaryEntryDTO[]) {
  const ratings = logs.map((l) => l.rating).filter((r): r is number => r != null);
  const avgRating = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
  const lastListenedOn = logs.length
    ? logs.map((l) => l.listenedOn).sort().at(-1)!
    : null;
  return { avgRating, logCount: logs.length, lastListenedOn };
}

// Recomputes an album's aggregate stats from the local diary state so the UI
// updates in the same tick as the click, instead of waiting on a server round-trip.
function upsertAlbumAggregate(
  albums: AlbumWithStats[],
  album: AlbumDTO,
  logsForAlbum: DiaryEntryDTO[]
): AlbumWithStats[] {
  const idx = albums.findIndex((a) => a.id === album.id);
  const agg = aggregateFromLogs(logsForAlbum);
  if (idx === -1) {
    return [{ ...toAlbumWithStats(album), ...agg }, ...albums];
  }
  const next = albums.slice();
  next[idx] = { ...next[idx], ...agg };
  return next;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [albums, setAlbums] = useState<AlbumWithStats[]>([]);
  const [diaryLogs, setDiaryLogs] = useState<DiaryEntryDTO[]>([]);
  const [lists, setLists] = useState<ListSummaryDTO[]>([]);
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStatsDTO | null>(null);
  const [streak, setStreak] = useState<StreakDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  const refreshAlbums = useCallback(async () => {
    const data = await apiFetch<{ albums: AlbumWithStats[] }>("/api/albums");
    setAlbums(data.albums);
  }, []);
  const refreshDiary = useCallback(async () => {
    const data = await apiFetch<{ logs: DiaryEntryDTO[] }>("/api/logs");
    setDiaryLogs(data.logs);
  }, []);
  const refreshLists = useCallback(async () => {
    const data = await apiFetch<{ lists: ListSummaryDTO[] }>("/api/lists");
    setLists(data.lists);
  }, []);
  const refreshStats = useCallback(async () => {
    const data = await apiFetch<{
      personal: StatsDTO;
      platform: PlatformStatsDTO;
      streak: StreakDTO;
    }>("/api/stats");
    setStats(data.personal);
    setPlatformStats(data.platform);
    setStreak(data.streak);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshAlbums(), refreshDiary(), refreshLists(), refreshStats()]);
  }, [refreshAlbums, refreshDiary, refreshLists, refreshStats]);

  useEffect(() => {
    (async () => {
      try {
        await refreshAll();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAll]);

  const withErrorToast = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        notify(err instanceof ApiError ? err.message : "Ocorreu um erro inesperado.");
        throw err;
      }
    },
    [notify]
  );

  // Only hits the network when the album isn't already known locally — every
  // other action can skip straight to its own optimistic update.
  const ensureAlbum = useCallback(
    (result: SearchResult | AlbumDTO) =>
      withErrorToast(async () => {
        if ("id" in result && result.id) {
          return result;
        }
        const payload = {
          mbid: result.mbid,
          title: result.title,
          artist: result.artist,
          coverUrl: result.coverUrl ?? null,
          releaseDate: result.releaseDate ?? null,
        };
        const data = await apiFetch<{ album: AlbumDTO }>("/api/albums", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        return data.album;
      }),
    [withErrorToast]
  );

  const logListen = useCallback(
    (result: SearchResult | AlbumDTO, input: LogInput) =>
      withErrorToast(async () => {
        const album = await ensureAlbum(result);
        const optimisticId = tempId("log");
        const listenedOn = input.listenedOn ?? new Date().toISOString();
        const optimisticLog: DiaryEntryDTO = {
          id: optimisticId,
          albumId: album.id,
          rating: input.rating ?? null,
          review: input.review ?? null,
          listenedOn,
          relisten: input.relisten ?? false,
          createdAt: new Date().toISOString(),
          album,
        };

        const prevDiary = diaryLogs;
        const prevAlbums = albums;
        const nextDiary = [optimisticLog, ...diaryLogs];
        setDiaryLogs(nextDiary);
        setAlbums(
          upsertAlbumAggregate(
            albums,
            album,
            nextDiary.filter((l) => l.albumId === album.id)
          )
        );
        notify(`Escuta registrada: ${album.title}`);

        try {
          const data = await apiFetch<{ log: { id: string } }>("/api/logs", {
            method: "POST",
            body: JSON.stringify({ albumId: album.id, ...input }),
          });
          setDiaryLogs((cur) =>
            cur.map((l) => (l.id === optimisticId ? { ...l, id: data.log.id } : l))
          );
          void Promise.all([refreshAlbums(), refreshStats()]).catch(() => {});
        } catch (err) {
          setDiaryLogs(prevDiary);
          setAlbums(prevAlbums);
          throw err;
        }
        return album;
      }),
    [albums, diaryLogs, ensureAlbum, notify, refreshAlbums, refreshStats, withErrorToast]
  );

  const updateLog = useCallback(
    (logId: string, input: LogInput) =>
      withErrorToast(async () => {
        const idx = diaryLogs.findIndex((l) => l.id === logId);
        if (idx === -1) {
          await apiFetch(`/api/logs/${logId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          });
          notify("Registro atualizado.");
          await Promise.all([refreshAlbums(), refreshDiary(), refreshStats()]);
          return;
        }

        const prevDiary = diaryLogs;
        const prevAlbums = albums;
        const updatedLog: DiaryEntryDTO = {
          ...diaryLogs[idx],
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
          ...(input.review !== undefined ? { review: input.review } : {}),
          ...(input.listenedOn !== undefined ? { listenedOn: input.listenedOn } : {}),
          ...(input.relisten !== undefined ? { relisten: input.relisten } : {}),
        };
        const nextDiary = diaryLogs.slice();
        nextDiary[idx] = updatedLog;
        setDiaryLogs(nextDiary);
        setAlbums(
          upsertAlbumAggregate(
            albums,
            updatedLog.album,
            nextDiary.filter((l) => l.albumId === updatedLog.albumId)
          )
        );
        notify("Registro atualizado.");

        try {
          await apiFetch(`/api/logs/${logId}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          });
          void refreshStats().catch(() => {});
        } catch (err) {
          setDiaryLogs(prevDiary);
          setAlbums(prevAlbums);
          throw err;
        }
      }),
    [albums, diaryLogs, notify, refreshAlbums, refreshDiary, refreshStats, withErrorToast]
  );

  const deleteLog = useCallback(
    (logId: string) =>
      withErrorToast(async () => {
        const prevDiary = diaryLogs;
        const prevAlbums = albums;
        const log = diaryLogs.find((l) => l.id === logId);
        const nextDiary = diaryLogs.filter((l) => l.id !== logId);
        setDiaryLogs(nextDiary);
        if (log) {
          setAlbums(
            upsertAlbumAggregate(
              albums,
              log.album,
              nextDiary.filter((l) => l.albumId === log.albumId)
            )
          );
        }
        notify("Registro removido.");

        try {
          await apiFetch(`/api/logs/${logId}`, { method: "DELETE" });
          void refreshStats().catch(() => {});
        } catch (err) {
          setDiaryLogs(prevDiary);
          setAlbums(prevAlbums);
          throw err;
        }
      }),
    [albums, diaryLogs, notify, refreshStats, withErrorToast]
  );

  const setLiked = useCallback(
    (result: SearchResult | AlbumDTO, liked: boolean) =>
      withErrorToast(async () => {
        const album = await ensureAlbum(result);
        const prevAlbums = albums;
        const idx = albums.findIndex((a) => a.id === album.id);
        setAlbums(
          idx === -1
            ? [{ ...toAlbumWithStats(album), liked }, ...albums]
            : albums.map((a) => (a.id === album.id ? { ...a, liked } : a))
        );
        try {
          await apiFetch(`/api/albums/${album.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ liked }),
          });
          void refreshStats().catch(() => {});
        } catch (err) {
          setAlbums(prevAlbums);
          throw err;
        }
      }),
    [albums, ensureAlbum, refreshStats, withErrorToast]
  );

  const setWantToListen = useCallback(
    (result: SearchResult | AlbumDTO, want: boolean) =>
      withErrorToast(async () => {
        const album = await ensureAlbum(result);
        const prevAlbums = albums;
        const idx = albums.findIndex((a) => a.id === album.id);
        setAlbums(
          idx === -1
            ? [{ ...toAlbumWithStats(album), wantToListen: want }, ...albums]
            : albums.map((a) => (a.id === album.id ? { ...a, wantToListen: want } : a))
        );
        try {
          await apiFetch(`/api/albums/${album.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ wantToListen: want }),
          });
          void refreshStats().catch(() => {});
        } catch (err) {
          setAlbums(prevAlbums);
          throw err;
        }
      }),
    [albums, ensureAlbum, refreshStats, withErrorToast]
  );

  const deleteAlbum = useCallback(
    (albumId: string) =>
      withErrorToast(async () => {
        const prevAlbums = albums;
        const prevDiary = diaryLogs;
        setAlbums(albums.filter((a) => a.id !== albumId));
        setDiaryLogs(diaryLogs.filter((l) => l.albumId !== albumId));
        notify("Álbum removido da biblioteca.");
        try {
          await apiFetch(`/api/albums/${albumId}`, { method: "DELETE" });
          void refreshAll().catch(() => {});
        } catch (err) {
          setAlbums(prevAlbums);
          setDiaryLogs(prevDiary);
          throw err;
        }
      }),
    [albums, diaryLogs, notify, refreshAll, withErrorToast]
  );

  const createList = useCallback(
    (name: string, description?: string) =>
      withErrorToast(async () => {
        const prevLists = lists;
        const optimistic: ListSummaryDTO = {
          id: tempId("list"),
          name,
          description: description ?? null,
          createdAt: new Date().toISOString(),
          entryCount: 0,
          covers: [],
        };
        setLists([optimistic, ...lists]);
        notify(`Lista "${name}" criada.`);
        try {
          const data = await apiFetch<{ list: ListSummaryDTO }>("/api/lists", {
            method: "POST",
            body: JSON.stringify({ name, description: description ?? null }),
          });
          const real: ListSummaryDTO = { ...data.list, entryCount: 0, covers: [] };
          setLists((cur) => cur.map((l) => (l.id === optimistic.id ? real : l)));
          return real;
        } catch (err) {
          setLists(prevLists);
          throw err;
        }
      }),
    [lists, notify, withErrorToast]
  );

  const renameList = useCallback(
    (listId: string, name: string, description?: string) =>
      withErrorToast(async () => {
        const prevLists = lists;
        setLists(
          lists.map((l) =>
            l.id === listId ? { ...l, name, description: description ?? null } : l
          )
        );
        try {
          await apiFetch(`/api/lists/${listId}`, {
            method: "PATCH",
            body: JSON.stringify({ name, description: description ?? null }),
          });
        } catch (err) {
          setLists(prevLists);
          throw err;
        }
      }),
    [lists, withErrorToast]
  );

  const deleteList = useCallback(
    (listId: string) =>
      withErrorToast(async () => {
        const prevLists = lists;
        setLists(lists.filter((l) => l.id !== listId));
        notify("Lista removida.");
        try {
          await apiFetch(`/api/lists/${listId}`, { method: "DELETE" });
        } catch (err) {
          setLists(prevLists);
          throw err;
        }
      }),
    [lists, notify, withErrorToast]
  );

  const fetchListDetail = useCallback(
    (listId: string) =>
      withErrorToast(async () => {
        const data = await apiFetch<{ list: ListDetailDTO }>(`/api/lists/${listId}`);
        return data.list;
      }),
    [withErrorToast]
  );

  const addToList = useCallback(
    (listId: string, result: SearchResult | AlbumDTO) =>
      withErrorToast(async () => {
        const album = await ensureAlbum(result);
        const prevLists = lists;
        setLists(
          lists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  entryCount: l.entryCount + 1,
                  covers: l.covers.length < 4 ? [...l.covers, album.coverUrl ?? ""] : l.covers,
                }
              : l
          )
        );
        notify(`Adicionado a lista: ${album.title}`);
        try {
          await apiFetch(`/api/lists/${listId}/entries`, {
            method: "POST",
            body: JSON.stringify({ albumId: album.id }),
          });
        } catch (err) {
          setLists(prevLists);
          throw err;
        }
      }),
    [ensureAlbum, lists, notify, withErrorToast]
  );

  const removeFromList = useCallback(
    (listId: string, albumId: string) =>
      withErrorToast(async () => {
        const prevLists = lists;
        setLists(
          lists.map((l) =>
            l.id === listId ? { ...l, entryCount: Math.max(0, l.entryCount - 1) } : l
          )
        );
        try {
          await apiFetch(`/api/lists/${listId}/entries?albumId=${albumId}`, {
            method: "DELETE",
          });
          void refreshLists().catch(() => {});
        } catch (err) {
          setLists(prevLists);
          throw err;
        }
      }),
    [lists, refreshLists, withErrorToast]
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      albums,
      diaryLogs,
      lists,
      stats,
      platformStats,
      streak,
      loading,
      toast,
      notify,
      refreshAll,
      ensureAlbum,
      logListen,
      updateLog,
      deleteLog,
      setLiked,
      setWantToListen,
      deleteAlbum,
      createList,
      renameList,
      deleteList,
      fetchListDetail,
      addToList,
      removeFromList,
    }),
    [
      albums,
      diaryLogs,
      lists,
      stats,
      platformStats,
      streak,
      loading,
      toast,
      notify,
      refreshAll,
      ensureAlbum,
      logListen,
      updateLog,
      deleteLog,
      setLiked,
      setWantToListen,
      deleteAlbum,
      createList,
      renameList,
      deleteList,
      fetchListDetail,
      addToList,
      removeFromList,
    ]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
