"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useLibrary } from "@/context/LibraryContext";
import { useAuth } from "@/context/AuthContext";
import { ratingToText } from "@/components/StarRating";
import { StreakHeatmap } from "@/components/StreakHeatmap";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import type { AlbumDTO } from "@/lib/types";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
      <p className="text-2xl font-semibold text-neutral-50">{value}</p>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

function AlbumCover({ album, size = 56 }: { album: AlbumDTO; size?: number }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      className="shrink-0 overflow-hidden rounded bg-neutral-800"
      style={{ width: size, height: size }}
    >
      {album.coverUrl && !imgError ? (
        <img
          src={album.coverUrl}
          alt={album.title}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg">💿</div>
      )}
    </div>
  );
}

function CommunityAlbumTile({
  label,
  album,
  detail,
}: {
  label: string;
  album: AlbumDTO;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5">
      <AlbumCover album={album} />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
        <p className="truncate text-sm font-medium text-neutral-100">{album.title}</p>
        <p className="truncate text-xs text-neutral-400">{album.artist}</p>
        <p className="mt-0.5 text-xs text-accent-soft">{detail}</p>
      </div>
    </div>
  );
}

export function ProfileView() {
  const { stats, platformStats, streak, loading } = useLibrary();
  const { user } = useAuth();
  const [hoverBucket, setHoverBucket] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  if (loading || !stats) return <p className="text-sm text-neutral-500">Carregando…</p>;

  const maxBucket = Math.max(1, ...stats.ratingDistribution);
  const maxArtist = Math.max(1, ...stats.topArtists.map((a) => a.count));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-neutral-100">
            {user.name || "Seu perfil"}
          </h2>
          <Link href={`/u/${user.id}`} className="text-xs text-accent-soft hover:underline">
            Ver perfil público
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 ring-1 ring-white/10 hover:bg-neutral-700"
        >
          <Pencil size={14} /> Editar perfil
        </button>
      </div>

      {streak && <StreakHeatmap streak={streak} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Escutas registradas" value={stats.totalLogs} />
        <StatTile label="Álbuns distintos" value={stats.distinctAlbums} />
        <StatTile label="Artistas distintos" value={stats.distinctArtists} />
        <StatTile
          label="Nota média"
          value={stats.avgRating != null ? (stats.avgRating / 2).toFixed(1) : "—"}
        />
        <StatTile label="Curtidos" value={stats.likedCount} />
        <StatTile label="Quero ouvir" value={stats.wantToListenCount} />
        <StatTile label="Escutas em 2026" value={stats.logsThisYear} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Distribuição de notas
        </h3>
        {stats.totalLogs === 0 ? (
          <p className="text-sm text-neutral-500">Sem avaliações ainda.</p>
        ) : (
          <div className="flex items-end gap-2 rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
            {stats.ratingDistribution.slice(1).map((count, idx) => {
              const bucket = idx + 1;
              const heightPct = (count / maxBucket) * 100;
              return (
                <div key={bucket} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative flex h-28 w-full items-end justify-center">
                    {hoverBucket === bucket && (
                      <div className="absolute -top-6 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-200 ring-1 ring-white/10">
                        {count}
                      </div>
                    )}
                    <div
                      onMouseEnter={() => setHoverBucket(bucket)}
                      onMouseLeave={() => setHoverBucket(null)}
                      className="w-full max-w-6 rounded-t bg-accent-soft/80 transition hover:bg-accent-soft"
                      style={{ height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-neutral-500">{bucket / 2}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Artistas mais ouvidos
        </h3>
        {stats.topArtists.length === 0 ? (
          <p className="text-sm text-neutral-500">Sem dados ainda.</p>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
            {stats.topArtists.map((a) => (
              <div key={a.artist} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm text-neutral-300">
                  {a.artist}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-accent-soft"
                    style={{ width: `${(a.count / maxArtist) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-neutral-500">
                  {a.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {platformStats && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Estatísticas da comunidade
          </h3>

          {!platformStats.myTopAlbum &&
          !platformStats.topArtist &&
          !platformStats.mostLoggedAlbum &&
          !platformStats.highestRatedAlbum &&
          platformStats.topAlbumsByYear.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Ainda não há avaliações suficientes na plataforma.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {platformStats.myTopAlbum && (
                  <CommunityAlbumTile
                    label="Seu álbum favorito"
                    album={platformStats.myTopAlbum.album}
                    detail={`sua nota: ${ratingToText(platformStats.myTopAlbum.rating)}`}
                  />
                )}
                {platformStats.highestRatedAlbum && (
                  <CommunityAlbumTile
                    label="Mais bem avaliado na comunidade"
                    album={platformStats.highestRatedAlbum.album}
                    detail={`${ratingToText(platformStats.highestRatedAlbum.communityAvgRating)} · ${platformStats.highestRatedAlbum.communityLogCount} avaliações`}
                  />
                )}
                {platformStats.mostLoggedAlbum && (
                  <CommunityAlbumTile
                    label="Mais ouvido na comunidade"
                    album={platformStats.mostLoggedAlbum.album}
                    detail={`${platformStats.mostLoggedAlbum.logCount} escutas`}
                  />
                )}
                {platformStats.topArtist && (
                  <div className="flex items-center gap-3 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-neutral-800 text-lg">
                      🎸
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-neutral-500">
                        Banda mais bem avaliada
                      </p>
                      <p className="truncate text-sm font-medium text-neutral-100">
                        {platformStats.topArtist.artist}
                      </p>
                      <p className="mt-0.5 text-xs text-accent-soft">
                        {ratingToText(platformStats.topArtist.communityAvgRating)} ·{" "}
                        {platformStats.topArtist.totalLogs} avaliações
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {platformStats.topAlbumsByYear.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
                    Melhor álbum por ano
                  </h4>
                  <div className="flex gap-3 overflow-x-auto rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
                    {platformStats.topAlbumsByYear.map((entry) => (
                      <div key={entry.year} className="flex w-24 shrink-0 flex-col items-center gap-1.5 text-center">
                        <AlbumCover album={entry.album} size={72} />
                        <p className="text-xs font-medium text-neutral-300">{entry.year}</p>
                        <p className="truncate text-[10px] text-neutral-500" title={entry.album.title}>
                          {entry.album.title}
                        </p>
                        <p className="text-[10px] text-accent-soft">
                          {ratingToText(entry.communityAvgRating)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </div>
  );
}
