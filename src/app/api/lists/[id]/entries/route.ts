import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { listEntryAddSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: listId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = listEntryAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { albumId } = parsed.data;

  const [list, album] = await Promise.all([
    prisma.list.findFirst({ where: { id: listId, userId } }),
    prisma.album.findUnique({ where: { id: albumId } }),
  ]);
  if (!list) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
  if (!album) return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });

  const existing = await prisma.listEntry.findUnique({
    where: { listId_albumId: { listId, albumId } },
  });
  if (existing) {
    return NextResponse.json({ entry: existing });
  }

  const last = await prisma.listEntry.findFirst({
    where: { listId },
    orderBy: { position: "desc" },
  });

  const entry = await prisma.listEntry.create({
    data: { listId, albumId, position: (last?.position ?? -1) + 1 },
  });

  return NextResponse.json({ entry });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: listId } = await params;
  const albumId = req.nextUrl.searchParams.get("albumId");
  if (!albumId) {
    return NextResponse.json({ error: "albumId é obrigatório." }, { status: 400 });
  }

  const result = await prisma.listEntry.deleteMany({
    where: { listId, albumId, list: { userId } },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
