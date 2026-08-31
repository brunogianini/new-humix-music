"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { FollowButton } from "./FollowButton";
import type { UserSummaryDTO } from "@/lib/types";

export function UserSearchResults({ query }: { query: string }) {
  const [users, setUsers] = useState<UserSummaryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ users: UserSummaryDTO[] }>(
          `/api/users/search?q=${encodeURIComponent(query)}`
        );
        setUsers(data.users);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (!query.trim()) return null;

  return (
    <div className="flex flex-col gap-2">
      {loading && <p className="text-sm text-neutral-500">Buscando…</p>}
      {!loading && searched && users.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhuma pessoa encontrada para &quot;{query}&quot;.</p>
      )}
      {users.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-3 rounded-lg bg-neutral-900 p-3 ring-1 ring-white/5"
        >
          <Link href={`/u/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-neutral-800">
              {u.avatarUrl && (
                <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-100">
                {u.name || "Sem nome"}
              </p>
              <p className="text-xs text-neutral-500">
                {u.followerCount} {u.followerCount === 1 ? "seguidor" : "seguidores"}
              </p>
            </div>
          </Link>
          <FollowButton userId={u.id} initialIsFollowing={u.isFollowing} />
        </div>
      ))}
    </div>
  );
}
