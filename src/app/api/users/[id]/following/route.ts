import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import type { UserSummaryDTO } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const rows = await prisma.follow.findMany({
    where: { followerId: id },
    include: { following: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });

  const ids = rows.map((r) => r.following.id);
  const [myFollowing, followerCounts] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId, followingId: { in: ids } },
      select: { followingId: true },
    }),
    prisma.follow.groupBy({
      by: ["followingId"],
      where: { followingId: { in: ids } },
      _count: { followingId: true },
    }),
  ]);
  const followingSet = new Set(myFollowing.map((f) => f.followingId));
  const countByUser = new Map(followerCounts.map((f) => [f.followingId, f._count.followingId]));

  const users: UserSummaryDTO[] = rows.map((r) => ({
    id: r.following.id,
    name: r.following.name,
    avatarUrl: r.following.avatarUrl,
    isFollowing: followingSet.has(r.following.id),
    followerCount: countByUser.get(r.following.id) ?? 0,
  }));

  return NextResponse.json({ users });
}
