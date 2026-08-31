import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { notifyFollowed } from "@/lib/notify";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  if (id === userId) {
    return NextResponse.json({ error: "Você não pode seguir a si mesmo." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: userId, followingId: id } },
  });

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: userId, followingId: id } },
    update: {},
    create: { followerId: userId, followingId: id },
  });

  if (!existing) {
    await notifyFollowed(userId, id);
  }

  return NextResponse.json({ isFollowing: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  await prisma.follow.deleteMany({ where: { followerId: userId, followingId: id } });

  return NextResponse.json({ isFollowing: false });
}
