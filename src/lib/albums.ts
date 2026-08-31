import { prisma } from "@/lib/prisma";

export type EnsureAlbumInput = {
  mbid: string;
  title: string;
  artist: string;
  coverUrl?: string | null;
  releaseDate?: string | null;
};

// Album is the single shared/global row per real-world release — this is
// what lets ratings pool across users into one community score. Never
// user-scoped; every caller (manual add, Spotify import) upserts into it.
export async function ensureAlbum(input: EnsureAlbumInput) {
  return prisma.album.upsert({
    where: { mbid: input.mbid },
    update: {},
    create: {
      mbid: input.mbid,
      title: input.title,
      artist: input.artist,
      coverUrl: input.coverUrl ?? null,
      releaseDate: input.releaseDate ?? null,
    },
  });
}
