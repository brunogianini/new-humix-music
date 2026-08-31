import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const verifySession = cache(async () => {
  const session = await getSessionPayload();
  if (!session?.userId) {
    redirect("/login");
  }
  return { userId: session.userId };
});

export const getCurrentUser = cache(async () => {
  const session = await getSessionPayload();
  if (!session?.userId) return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      favoriteAlbumId: true,
      featuredTab: true,
    },
  });
});
