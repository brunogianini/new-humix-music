import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_SIZE_BYTES = 5_000_000;

export class UploadError extends Error {}

export async function saveUploadedImage(file: File, subdir: "avatars" | "covers", userId: string) {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new UploadError("Formato de imagem não suportado. Use PNG, JPEG, WEBP ou GIF.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new UploadError("A imagem deve ter no máximo 5MB.");
  }

  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });

  const filename = `${userId}-${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return `/uploads/${subdir}/${filename}`;
}
