import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { getPublicProfile } from "@/lib/profile";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const profile = await getPublicProfile(userId, id);
  if (!profile) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
