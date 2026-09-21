import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { groupMemberAddSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import type { GroupMemberDTO } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = groupMemberAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { userId: newMemberId } = parsed.data;

  const group = await prisma.listeningGroup.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  if (group.createdById !== userId) {
    return NextResponse.json(
      { error: "Só quem criou o grupo pode adicionar membros." },
      { status: 403 }
    );
  }

  const newMember = await prisma.user.findUnique({
    where: { id: newMemberId },
    select: { id: true, name: true, avatarUrl: true },
  });
  if (!newMember) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  const existing = await prisma.listeningGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId: newMemberId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Essa pessoa já está no grupo." }, { status: 409 });
  }

  const membership = await prisma.listeningGroupMember.create({
    data: { groupId, userId: newMemberId },
  });

  const member: GroupMemberDTO = {
    id: newMember.id,
    name: newMember.name,
    avatarUrl: newMember.avatarUrl,
    joinedAt: membership.joinedAt.toISOString(),
  };

  return NextResponse.json({ member });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId } = await params;
  const memberId = req.nextUrl.searchParams.get("userId");
  if (!memberId) {
    return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
  }

  const group = await prisma.listeningGroup.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  if (group.createdById !== userId) {
    return NextResponse.json(
      { error: "Só quem criou o grupo pode remover membros." },
      { status: 403 }
    );
  }
  if (memberId === group.createdById) {
    return NextResponse.json(
      { error: "Quem criou o grupo não pode ser removido." },
      { status: 400 }
    );
  }

  const result = await prisma.listeningGroupMember.deleteMany({
    where: { groupId, userId: memberId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
