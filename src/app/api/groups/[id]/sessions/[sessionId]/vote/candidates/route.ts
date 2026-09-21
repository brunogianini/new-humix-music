import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { voteCandidateAddSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { getSessionDTO, isGroupMember } from "@/lib/groups";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId, sessionId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = voteCandidateAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { albumId } = parsed.data;

  if (!(await isGroupMember(groupId, userId))) {
    return NextResponse.json({ error: "Você não é membro desse grupo." }, { status: 403 });
  }

  const [session, album] = await Promise.all([
    prisma.listeningSession.findFirst({
      where: { id: sessionId, groupId },
      include: { votes: { where: { closedAt: null }, select: { id: true } } },
    }),
    prisma.album.findUnique({ where: { id: albumId } }),
  ]);
  if (!session) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  if (!album) return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });

  const openVote = session.votes[0];
  if (!openVote) {
    return NextResponse.json({ error: "Não há votação em andamento pra essa sessão." }, { status: 409 });
  }

  const existing = await prisma.sessionVoteCandidate.findUnique({
    where: { voteId_albumId: { voteId: openVote.id, albumId } },
  });
  if (!existing) {
    await prisma.sessionVoteCandidate.create({
      data: { voteId: openVote.id, albumId, proposedById: userId },
    });
  }

  const dto = await getSessionDTO(sessionId, userId);
  return NextResponse.json({ session: dto });
}
