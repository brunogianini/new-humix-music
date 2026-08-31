import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { getPersonalStats, getPlatformStats } from "@/lib/stats";
import { getStreak } from "@/lib/streak";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [personal, platform, streak] = await Promise.all([
    getPersonalStats(userId),
    getPlatformStats(userId),
    getStreak(userId),
  ]);

  return NextResponse.json({ personal, platform, streak });
}
