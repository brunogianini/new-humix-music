import { z } from "zod";

export const albumInputSchema = z.object({
  mbid: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  coverUrl: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
});

export const statusPatchSchema = z.object({
  liked: z.boolean().optional(),
  wantToListen: z.boolean().optional(),
});

export const listCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

export const listPatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export const listEntryAddSchema = z.object({ albumId: z.string().min(1) });

export const logCreateSchema = z.object({
  albumId: z.string().min(1),
  rating: z.number().int().min(0).max(10).nullable().optional(),
  review: z.string().nullable().optional(),
  listenedOn: z.string().optional(),
  relisten: z.boolean().optional(),
});

export const logPatchSchema = z.object({
  rating: z.number().int().min(0).max(10).nullable().optional(),
  review: z.string().nullable().optional(),
  listenedOn: z.string().optional(),
  relisten: z.boolean().optional(),
});

export const signupSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.email({ error: "Informe um email válido." }).trim(),
  password: z
    .string()
    .min(8, { error: "A senha precisa ter pelo menos 8 caracteres." }),
});

export const loginSchema = z.object({
  email: z.email({ error: "Informe um email válido." }).trim(),
  password: z.string().min(1, { error: "Informe sua senha." }),
});

export const profileUpdateSchema = z.object({
  bio: z.string().max(500).nullable().optional(),
  favoriteAlbumId: z.string().nullable().optional(),
  featuredTab: z.enum(["diary", "lists", "stats"]).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
});

export const pinnedListsUpdateSchema = z.object({
  listIds: z.array(z.string().min(1)).max(6),
});

export const recommendationCreateSchema = z.object({
  toUserId: z.string().min(1),
  albumId: z.string().min(1),
  message: z.string().max(280).nullable().optional(),
});

export const shameNoteCreateSchema = z.object({
  text: z.string().trim().min(1).max(280),
});
