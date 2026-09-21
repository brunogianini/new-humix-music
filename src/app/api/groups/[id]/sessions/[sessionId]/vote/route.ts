import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { canManageSession, getSessionDTO } from "@/lib/groups";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId, sessionId } = await params;

  const [group, session] = await Promise.all([
    prisma.listeningGroup.findUnique({ where: { id: groupId }, select: { createdById: true } }),
    prisma.listeningSession.findFirst({
      where: { id: sessionId, groupId },
      include: { votes: { where: { closedAt: null }, select: { id: true } } },
    }),
  ]);
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  if (!session) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  if (!canManageSession(session, group.createdById, userId)) {
    return NextResponse.json(
      { error: "Só quem marcou a sessão ou o dono do grupo pode iniciar uma votação." },
      { status: 403 }
    );
  }
  if (session.votes.length > 0) {
    return NextResponse.json({ error: "Já existe uma votação em andamento." }, { status: 409 });
  }

  await prisma.listeningSessionVote.create({ data: { sessionId, openedById: userId } });

  const dto = await getSessionDTO(sessionId, userId);
  return NextResponse.json({ session: dto });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId, sessionId } = await params;

  const [group, session] = await Promise.all([
    prisma.listeningGroup.findUnique({ where: { id: groupId }, select: { createdById: true } }),
    prisma.listeningSession.findFirst({
      where: { id: sessionId, groupId },
      include: { votes: { where: { closedAt: null }, select: { id: true } } },
    }),
  ]);
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  if (!session) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  if (!canManageSession(session, group.createdById, userId)) {
    return NextResponse.json(
      { error: "Só quem marcou a sessão ou o dono do grupo pode cancelar a votação." },
      { status: 403 }
    );
  }
  const openVote = session.votes[0];
  if (!openVote) {
    return NextResponse.json({ error: "Não há votação em andamento." }, { status: 404 });
  }

  await prisma.listeningSessionVote.delete({ where: { id: openVote.id } });

  const dto = await getSessionDTO(sessionId, userId);
  return NextResponse.json({ session: dto });
}
