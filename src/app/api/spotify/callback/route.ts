import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUserId } from "@/lib/apiAuth";
import { exchangeCodeForTokens, fetchSpotifyProfile } from "@/lib/spotifyAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.redirect(new URL("/login", req.nextUrl));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("spotify_oauth_state")?.value;
  cookieStore.delete("spotify_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?spotify=error", req.nextUrl));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchSpotifyProfile(tokens.accessToken);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    await prisma.externalAccount.upsert({
      where: { userId_provider: { userId, provider: "SPOTIFY" } },
      update: {
        providerAccountId: profile.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        scope: "user-library-read user-follow-read",
      },
      create: {
        userId,
        provider: "SPOTIFY",
        providerAccountId: profile.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        scope: "user-library-read user-follow-read",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(new URL("/?spotify=error", req.nextUrl));
  }

  return NextResponse.redirect(new URL("/", req.nextUrl));
}
