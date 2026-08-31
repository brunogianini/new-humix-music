import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { statusPatchSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = statusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const album = await prisma.album.findUnique({ where: { id } });
  if (!album) {
    return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
  }

  const status = await prisma.albumStatus.upsert({
    where: { albumId_userId: { albumId: id, userId } },
    update: parsed.data,
    create: { albumId: id, userId, ...parsed.data },
  });

  return NextResponse.json({ status });
}
