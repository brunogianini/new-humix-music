"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useNotifications } from "@/context/NotificationsContext";
import type { NotificationDTO } from "@/lib/types";

function messageFor(n: NotificationDTO): string {
  const actor = n.actor.name || "Alguém";
  switch (n.type) {
    case "FOLLOW":
      return `${actor} começou a seguir você.`;
    case "LISTEN_LOG":
      return `${actor} registrou uma escuta de ${n.album?.title ?? "um álbum"}.`;
    case "LIST_CREATED":
      return `${actor} criou a lista "${n.list?.name ?? ""}".`;
    case "RECOMMENDATION":
      return `${actor} recomendou ${n.album?.title ?? "um álbum"} pra você. Você tem 7 dias pra ouvir e resenhar!`;
    case "RECOMMENDATION_COMPLETED":
      return `${actor} ouviu e resenhou ${n.album?.title ?? "o álbum"} que você recomendou! +1 ponto de amizade 🎉`;
    case "SHAME_NOTE":
      return `${actor} deixou uma nota de vergonha no seu perfil por não ouvir ${n.album?.title ?? "o álbum"} a tempo 😳`;
    default:
      return "Nova notificação.";
  }
}

function hrefFor(n: NotificationDTO): string {
  if (n.type === "FOLLOW") return `/u/${n.actor.id}`;
  return `/u/${n.actor.id}`;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { notifications, loading, fetchNotifications, markRead, markAllRead } =
    useNotifications();

  useEffect(() => {
    void fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl bg-neutral-900 shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-100">Notificações</h3>
        <button
          type="button"
          onClick={() => void markAllRead()}
          className="text-xs text-accent-soft hover:underline"
        >
          Marcar todas como lidas
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading && <p className="p-4 text-sm text-neutral-500">Carregando…</p>}
        {!loading && notifications.length === 0 && (
          <p className="p-4 text-sm text-neutral-500">Nenhuma notificação ainda.</p>
        )}
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={hrefFor(n)}
            onClick={() => {
              if (!n.read) void markRead(n.id);
              onClose();
            }}
            className={`flex items-start gap-2.5 border-b border-white/5 px-4 py-3 text-sm hover:bg-neutral-800/60 ${
              n.read ? "text-neutral-400" : "text-neutral-100"
            }`}
          >
            {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
            <div className={n.read ? "ml-4" : ""}>
              <p>{messageFor(n)}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{formatRelative(n.createdAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
