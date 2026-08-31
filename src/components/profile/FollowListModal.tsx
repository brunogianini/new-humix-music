"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { FollowButton } from "./FollowButton";
import type { UserSummaryDTO } from "@/lib/types";

export function FollowListModal({
  userId,
  kind,
  onClose,
}: {
  userId: string;
  kind: "followers" | "following";
  onClose: () => void;
}) {
  const [users, setUsers] = useState<UserSummaryDTO[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await apiFetch<{ users: UserSummaryDTO[] }>(`/api/users/${userId}/${kind}`);
      if (!cancelled) setUsers(data.users);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, kind]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-xl bg-neutral-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-sm font-semibold text-neutral-100">
            {kind === "followers" ? "Seguidores" : "Seguindo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {users == null && <p className="p-4 text-sm text-neutral-500">Carregando…</p>}
          {users != null && users.length === 0 && (
            <p className="p-4 text-sm text-neutral-500">
              {kind === "followers" ? "Nenhum seguidor ainda." : "Não segue ninguém ainda."}
            </p>
          )}
          {users?.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-800/60">
              <Link href={`/u/${u.id}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-neutral-800">
                  {u.avatarUrl && (
                    <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-100">{u.name || "Sem nome"}</p>
                  <p className="text-xs text-neutral-500">
                    {u.followerCount} {u.followerCount === 1 ? "seguidor" : "seguidores"}
                  </p>
                </div>
              </Link>
              <FollowButton userId={u.id} initialIsFollowing={u.isFollowing} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
