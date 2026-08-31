import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import type { UserSummaryDTO } from "@/lib/types";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [{ name: { contains: q } }, { email: { contains: q } }],
    },
    take: 20,
    select: { id: true, name: true, avatarUrl: true },
  });

  const [following, followerCounts] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId, followingId: { in: users.map((u) => u.id) } },
      select: { followingId: true },
    }),
    prisma.follow.groupBy({
      by: ["followingId"],
      where: { followingId: { in: users.map((u) => u.id) } },
      _count: { followingId: true },
    }),
  ]);
  const followingSet = new Set(following.map((f) => f.followingId));
  const countByUser = new Map(followerCounts.map((f) => [f.followingId, f._count.followingId]));

  const result: UserSummaryDTO[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl,
    isFollowing: followingSet.has(u.id),
    followerCount: countByUser.get(u.id) ?? 0,
  }));

  return NextResponse.json({ users: result });
}
