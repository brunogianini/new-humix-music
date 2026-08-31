"use client";

import { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useLibrary } from "@/context/LibraryContext";

export function FollowButton({
  userId,
  initialIsFollowing,
  onChange,
}: {
  userId: string;
  initialIsFollowing: boolean;
  onChange?: (isFollowing: boolean) => void;
}) {
  const { notify } = useLibrary();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !isFollowing;
    setPending(true);
    setIsFollowing(next);
    onChange?.(next);
    try {
      await apiFetch(`/api/users/${userId}/follow`, { method: next ? "POST" : "DELETE" });
    } catch (err) {
      setIsFollowing(!next);
      onChange?.(!next);
      notify(err instanceof ApiError ? err.message : "Ocorreu um erro inesperado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
        isFollowing
          ? "bg-neutral-800 text-neutral-200 ring-1 ring-white/10 hover:bg-neutral-700"
          : "bg-accent text-neutral-950 hover:bg-neutral-300"
      }`}
    >
      {isFollowing ? <UserCheck size={15} /> : <UserPlus size={15} />}
      {isFollowing ? "Seguindo" : "Seguir"}
    </button>
  );
}
