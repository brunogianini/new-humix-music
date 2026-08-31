import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { profileUpdateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.favoriteAlbumId) {
    const album = await prisma.album.findUnique({ where: { id: parsed.data.favoriteAlbumId } });
    if (!album) {
      return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      favoriteAlbumId: true,
      featuredTab: true,
    },
  });

  return NextResponse.json({ user });
}
