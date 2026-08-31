"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { AlbumCard, type AlbumLike, type ArtistRef } from "../AlbumCard";
import { useLibrary } from "@/context/LibraryContext";
import type { ListDetailDTO } from "@/lib/types";

export function ListsView({
  onOpenAlbum,
  onOpenArtist,
}: {
  onOpenAlbum: (album: AlbumLike) => void;
  onOpenArtist: (artist: ArtistRef) => void;
}) {
  const { lists, createList, deleteList, removeFromList, fetchListDetail } = useLibrary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListDetailDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchListDetail(selectedId).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, fetchListDetail]);

  function openList(id: string) {
    setDetail(null);
    setSelectedId(id);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    const list = await createList(name.trim(), description.trim() || undefined);
    setName("");
    setDescription("");
    setCreating(false);
    openList(list.id);
  }

  if (selectedId) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
        >
          <ArrowLeft size={16} /> Voltar às listas
        </button>

        {detail && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-neutral-50">{detail.name}</h2>
                {detail.description && (
                  <p className="text-sm text-neutral-500">{detail.description}</p>
                )}
                <p className="mt-1 text-xs text-neutral-600">
                  {detail.entries.length} álbum{detail.entries.length === 1 ? "" : "ns"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Excluir a lista "${detail.name}"?`)) {
                    void deleteList(detail.id).then(() => setSelectedId(null));
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm text-neutral-400 hover:bg-red-900/60 hover:text-red-300"
              >
                <Trash2 size={14} /> Excluir lista
              </button>
            </div>

            {detail.entries.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Lista vazia. Adicione álbuns pela busca ou pela biblioteca.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {detail.entries.map((entry) => (
                  <div key={entry.id} className="group relative">
                    <AlbumCard
                      album={entry.album}
                      onOpen={onOpenAlbum}
                      onOpenArtist={onOpenArtist}
                      showQuickActions={false}
                    />
                    <button
                      type="button"
                      title="Remover da lista"
                      onClick={() => {
                        setDetail((d) =>
                          d ? { ...d, entries: d.entries.filter((e) => e.id !== entry.id) } : d
                        );
                        void removeFromList(detail.id, entry.album.id);
                      }}
                      className="absolute left-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 backdrop-blur transition hover:bg-red-600 group-hover:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Suas listas</h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300"
        >
          <Plus size={15} /> Nova lista
        </button>
      </div>

      {creating && (
        <div className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-4 ring-1 ring-white/10">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da lista"
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

      {lists.length === 0 && !creating && (
        <div className="rounded-lg bg-neutral-900 p-8 text-center text-neutral-500">
          Nenhuma lista ainda. Crie uma para organizar seus álbuns favoritos.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => openList(l.id)}
            className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-4 text-left ring-1 ring-white/5 hover:ring-accent/40"
          >
            <div className="flex gap-1">
              {l.covers.length > 0 ? (
                l.covers.map((c, i) =>
                  c ? (
                    <img
                      key={i}
                      src={c}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div
                      key={i}
                      className="flex h-12 w-12 items-center justify-center rounded bg-neutral-800 text-sm"
                    >
                      💿
                    </div>
                  )
                )
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded bg-neutral-800 text-sm">
                  📀
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-neutral-100">{l.name}</p>
              {l.description && (
                <p className="truncate text-xs text-neutral-500">{l.description}</p>
              )}
              <p className="text-xs text-neutral-600">
                {l.entryCount} álbum{l.entryCount === 1 ? "" : "ns"}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
