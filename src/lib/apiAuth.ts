import "server-only";
import { getSessionPayload } from "@/lib/session";

// For Route Handlers: never redirects (that would break `fetch`-based JSON
// clients like `apiFetch`) — callers must check for `null` and return 401.
export async function requireUserId(): Promise<string | null> {
  const session = await getSessionPayload();
  return session?.userId ?? null;
}
