import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { getForYouRecommendations } from "@/lib/recommendations";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const result = await getForYouRecommendations(userId);
  return NextResponse.json(result);
}
