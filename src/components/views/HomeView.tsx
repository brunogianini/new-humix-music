"use client";

import { StarRating } from "../StarRating";
import { AlbumCard, type AlbumLike, type ArtistRef } from "../AlbumCard";
import { useLibrary } from "@/context/LibraryContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function HomeView({
  onOpenAlbum,
  onOpenArtist,
  onNavigateSearch,
}: {
  onOpenAlbum: (album: AlbumLike) => void;
  onOpenArtist: (artist: ArtistRef) => void;
  onNavigateSearch: () => void;
}) {
  const { albums, diaryLogs, loading } = useLibrary();

  if (loading) return <p className="text-sm text-neutral-500">Carregando…</p>;

  const wantToListen = albums.filter((a) => a.wantToListen);
  const liked = albums.filter((a) => a.liked);
  const recent = diaryLogs.slice(0, 6);

  if (albums.length === 0 && diaryLogs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-neutral-900 p-10 text-center">
        <span className="text-4xl">💿</span>
        <h2 className="text-lg font-semibold text-neutral-100">
          Bem-vindo(a) ao seu diário de álbuns
        </h2>
        <p className="max-w-sm text-sm text-neutral-500">
          Busque um álbum, avalie, escreva uma resenha e comece a construir sua biblioteca.
        </p>
        <button
          type="button"
          onClick={onNavigateSearch}
          className="mt-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-300"
        >
          Buscar álbuns
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Atividade recente
          </h2>
          <ul className="flex flex-col gap-2">
            {recent.map((log) => (
              <li key={log.id} className="flex items-center gap-3 rounded-lg bg-neutral-900 p-2.5">
                <button
                  type="button"
                  onClick={() => onOpenAlbum(log.album)}
                  className="h-11 w-11 shrink-0 overflow-hidden rounded bg-neutral-800"
                >
                  {log.album.coverUrl ? (
                    <img
                      src={log.album.coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">💿</div>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-200">
                    {log.album.title}{" "}
                    <button
                      type="button"
                      onClick={() => onOpenArtist({ name: log.album.artist, mbid: null })}
                      className="text-neutral-500 hover:text-accent"
                    >
                      — {log.album.artist}
                    </button>
                  </p>
                  <StarRating value={log.rating} readOnly size={12} />
                </div>
                <span className="shrink-0 text-xs text-neutral-500">
                  {formatDate(log.listenedOn)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {wantToListen.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Quero ouvir
          </h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {wantToListen.map((a) => (
              <AlbumCard key={a.id} album={a} onOpen={onOpenAlbum} onOpenArtist={onOpenArtist} />
            ))}
          </div>
        </section>
      )}

      {liked.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Curtidos
          </h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {liked.map((a) => (
              <AlbumCard key={a.id} album={a} onOpen={onOpenAlbum} onOpenArtist={onOpenArtist} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
