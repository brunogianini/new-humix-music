import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { listPatchSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import type { ListDetailDTO } from "@/lib/types";
import { attachAlbumRatings, toAlbumWithStats } from "@/lib/albumAggregate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;

  const list = await prisma.list.findFirst({
    where: { id, userId },
    include: {
      entries: {
        orderBy: { position: "asc" },
        include: {
          album: {
            include: {
              logs: { where: { userId } },
              status: { where: { userId } },
            },
          },
        },
      },
    },
  });

  if (!list) {
    return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
  }

  const albums = await attachAlbumRatings(list.entries.map((e) => toAlbumWithStats(e.album)), userId);

  const result: ListDetailDTO = {
    id: list.id,
    name: list.name,
    description: list.description,
    createdAt: list.createdAt.toISOString(),
    entries: list.entries.map((e, idx) => ({
      id: e.id,
      addedAt: e.addedAt.toISOString(),
      album: albums[idx],
    })),
  };

  return NextResponse.json({ list: result });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = listPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.list.updateMany({ where: { id, userId }, data: parsed.data });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
  }

  const list = await prisma.list.findUnique({ where: { id } });
  return NextResponse.json({ list });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  await prisma.list.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
