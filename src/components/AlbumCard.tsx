"use client";

import { Bookmark, ChevronDown, Heart } from "lucide-react";
import { useState } from "react";
import { StarRating, ratingToText } from "./StarRating";
import { TrackList } from "./TrackList";
import { useLibrary } from "@/context/LibraryContext";
import type { AlbumDTO, AlbumWithStats } from "@/lib/types";
import type { SearchResult } from "@/lib/spotify";

export type AlbumLike = AlbumWithStats | SearchResult | AlbumDTO;
export type ArtistRef = { name: string; mbid: string | null };

function coverOf(a: AlbumLike): string | null {
  return "coverUrl" in a ? a.coverUrl : null;
}
function ratingOf(a: AlbumLike): number | null {
  return "avgRating" in a ? a.avgRating : null;
}
function likedOf(a: AlbumLike): boolean {
  return ("liked" in a ? a.liked : false) ?? false;
}
function wantOf(a: AlbumLike): boolean {
  return ("wantToListen" in a ? a.wantToListen : false) ?? false;
}
function artistMbidOf(a: AlbumLike): string | null {
  return "artistMbid" in a ? a.artistMbid : null;
}
function communityRatingOf(a: AlbumLike): { avg: number; count: number } | null {
  if (!("communityAvgRating" in a) || a.communityAvgRating == null || a.communityLogCount === 0) {
    return null;
  }
  return { avg: a.communityAvgRating, count: a.communityLogCount };
}

export function AlbumCard({
  album,
  onOpen,
  onOpenArtist,
  showQuickActions = true,
  showTracks = true,
}: {
  album: AlbumLike;
  onOpen: (album: AlbumLike) => void;
  onOpenArtist?: (artist: ArtistRef) => void;
  showQuickActions?: boolean;
  showTracks?: boolean;
}) {
  const { setLiked, setWantToListen } = useLibrary();
  const [imgError, setImgError] = useState(false);
  const [tracksOpen, setTracksOpen] = useState(false);
  // Local overrides make the button flip the instant it's clicked, even for
  // brand-new albums that still need one lookup request before context updates.
  const [likedOverride, setLikedOverride] = useState<boolean | null>(null);
  const [wantOverride, setWantOverride] = useState<boolean | null>(null);
  const cover = coverOf(album);
  const liked = likedOverride ?? likedOf(album);
  const want = wantOverride ?? wantOf(album);

  // Once the real data catches up to the optimistic guess, drop the override
  // (adjusted during render, not an effect, so there's no extra flash).
  if (likedOverride !== null && likedOf(album) === likedOverride) setLikedOverride(null);
  if (wantOverride !== null && wantOf(album) === wantOverride) setWantOverride(null);

  return (
    <div className="group relative flex flex-col gap-2.5 hover:z-10">
      <div
        className="relative aspect-square w-full cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(album)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(album);
          }
        }}
      >
        {/* vinyl record, tucked behind the sleeve until hover pulls it out */}
        <div
          aria-hidden
          className="absolute inset-[3%] z-0 rounded-full bg-[repeating-radial-gradient(circle_at_50%_50%,#161616_0px,#161616_2px,#0a0a0a_3px,#0a0a0a_5px)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-transform duration-300 ease-out group-hover:translate-x-[38%] group-hover:rotate-12"
        >
          <div className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-800 ring-2 ring-black/70" />
          <div className="absolute left-1/2 top-1/2 h-[6%] w-[6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-950" />
        </div>

        {/* sleeve */}
        <div className="absolute inset-0 z-10 overflow-hidden rounded-md bg-neutral-800 shadow-lg ring-1 ring-white/10 transition-transform duration-300 ease-out group-hover:-translate-x-[8%] group-hover:shadow-2xl">
          {cover && !imgError ? (
            <img
              src={cover}
              alt={`${album.title} — ${album.artist}`}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-neutral-500">
              <span className="text-3xl">💿</span>
              <span className="line-clamp-2 text-xs leading-tight">{album.title}</span>
            </div>
          )}
        </div>

        {showQuickActions && (
          <div className="pointer-events-none absolute right-2 top-2 z-20 flex flex-col gap-1.5 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              title="Curtir"
              onClick={(e) => {
                e.stopPropagation();
                const next = !liked;
                setLikedOverride(next);
                void setLiked(album, next).catch(() => setLikedOverride(null));
              }}
              className={`pointer-events-auto rounded-full p-1.5 backdrop-blur ${
                liked ? "bg-rose-500 text-white" : "bg-black/60 text-white hover:bg-black/80"
              }`}
            >
              <Heart size={14} fill={liked ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              title="Quero ouvir"
              onClick={(e) => {
                e.stopPropagation();
                const next = !want;
                setWantOverride(next);
                void setWantToListen(album, next).catch(() => setWantOverride(null));
              }}
              className={`pointer-events-auto rounded-full p-1.5 backdrop-blur ${
                want ? "bg-accent text-neutral-950" : "bg-black/60 text-white hover:bg-black/80"
              }`}
            >
              <Bookmark size={14} fill={want ? "currentColor" : "none"} />
            </button>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => onOpen(album)}
          className="block w-full truncate text-left text-sm font-medium text-neutral-100 hover:text-accent"
        >
          {album.title}
        </button>
        {onOpenArtist ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenArtist({ name: album.artist, mbid: artistMbidOf(album) });
            }}
            className="block w-full truncate text-left text-xs text-neutral-400 hover:text-accent"
          >
            {album.artist}
          </button>
        ) : (
          <p className="truncate text-xs text-neutral-400">{album.artist}</p>
        )}
        {ratingOf(album) != null && (
          <div className="mt-1">
            <StarRating value={ratingOf(album)} readOnly size={12} />
          </div>
        )}
        {communityRatingOf(album) && (
          <p className="mt-0.5 text-[10px] text-neutral-500">
            comunidade: {ratingToText(communityRatingOf(album)!.avg)} (
            {communityRatingOf(album)!.count})
          </p>
        )}

        {showTracks && (
          <div className="mt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTracksOpen((v) => !v);
              }}
              className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-accent"
            >
              <ChevronDown
                size={11}
                className={tracksOpen ? "rotate-180 transition-transform" : "transition-transform"}
              />
              Músicas
            </button>
            {tracksOpen && (
              <div
                className="mt-1 max-h-40 overflow-y-auto rounded bg-neutral-900/60 px-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <TrackList album={album} compact />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
