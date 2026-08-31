"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AlbumCard, type AlbumLike, type ArtistRef } from "../AlbumCard";
import type { ForYouDTO } from "@/lib/types";

const TITLES: Record<ForYouDTO["mode"], string> = {
  personalized: "Recomendado pra você",
  trending: "Em alta na comunidade",
};

const SUBTITLES: Record<ForYouDTO["mode"], string> = {
  personalized: "Baseado nos artistas e álbuns que você mais curtiu.",
  trending: "Continue avaliando álbuns para receber recomendações personalizadas.",
};

export function ForYouView({
  onOpenAlbum,
  onOpenArtist,
}: {
  onOpenAlbum: (album: AlbumLike) => void;
  onOpenArtist: (artist: ArtistRef) => void;
}) {
  const [data, setData] = useState<ForYouDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<ForYouDTO>("/api/for-you")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Carregando…</p>;

  if (!data || data.albums.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-neutral-900 p-10 text-center">
        <Sparkles size={32} className="text-accent" />
        <h2 className="text-lg font-semibold text-neutral-100">Nada por aqui ainda</h2>
        <p className="max-w-sm text-sm text-neutral-500">
          Avalie alguns álbuns no seu diário para começar a receber recomendações — ou volte mais
          tarde, quando mais gente tiver avaliado álbuns em comum com você.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={18} className="text-accent" />
        <h1 className="text-base font-semibold text-neutral-100">{TITLES[data.mode]}</h1>
      </div>
      <p className="mb-5 text-sm text-neutral-500">{SUBTITLES[data.mode]}</p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {data.albums.map((a) => (
          <AlbumCard
            key={a.id}
            album={a}
            onOpen={onOpenAlbum}
            onOpenArtist={onOpenArtist}
            showQuickActions={false}
          />
        ))}
      </div>
    </div>
  );
}
