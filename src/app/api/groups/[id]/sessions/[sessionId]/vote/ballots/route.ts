import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { voteBallotCastSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { getSessionDTO, isGroupMember, resolveVoteIfComplete } from "@/lib/groups";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId, sessionId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = voteBallotCastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { candidateId } = parsed.data;

  if (!(await isGroupMember(groupId, userId))) {
    return NextResponse.json({ error: "Você não é membro desse grupo." }, { status: 403 });
  }

  const session = await prisma.listeningSession.findFirst({
    where: { id: sessionId, groupId },
    include: { votes: { where: { closedAt: null }, select: { id: true } } },
  });
  if (!session) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });

  const openVote = session.votes[0];
  if (!openVote) {
    return NextResponse.json({ error: "Não há votação em andamento pra essa sessão." }, { status: 409 });
  }

  const candidate = await prisma.sessionVoteCandidate.findFirst({
    where: { id: candidateId, voteId: openVote.id },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Opção de votação não encontrada." }, { status: 404 });
  }

  await prisma.sessionVoteBallot.upsert({
    where: { voteId_userId: { voteId: openVote.id, userId } },
    create: { voteId: openVote.id, candidateId, userId },
    update: { candidateId },
  });

  await resolveVoteIfComplete(openVote.id);

  const dto = await getSessionDTO(sessionId, userId);
  return NextResponse.json({ session: dto });
}
