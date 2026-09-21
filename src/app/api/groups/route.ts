import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { groupCreateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { listGroupsForUser } from "@/lib/groups";
import type { GroupSummaryDTO } from "@/lib/types";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const groups = await listGroupsForUser(userId);
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = groupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await prisma.listeningGroup.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      createdById: userId,
      members: { create: { userId } },
    },
  });

  const summary: GroupSummaryDTO = {
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt.toISOString(),
    createdById: group.createdById,
    memberCount: 1,
    sessionCount: 0,
    avatarUrls: [],
  };

  return NextResponse.json({ group: summary });
}
