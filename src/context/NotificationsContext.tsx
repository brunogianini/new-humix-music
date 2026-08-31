"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import type { NotificationDTO } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

type NotificationsContextValue = {
  notifications: NotificationDTO[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ count: number }>("/api/notifications/unread-count");
      setUnreadCount(data.count);
    } catch {
      // Silent — polling errors shouldn't surface as toasts.
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshUnreadCount();
    })();
    const interval = window.setInterval(() => void refreshUnreadCount(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshUnreadCount]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ notifications: NotificationDTO[] }>("/api/notifications");
      setNotifications(data.notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    const prev = notifications;
    const wasUnread = prev.find((n) => n.id === id)?.read === false;
    setNotifications((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      setNotifications(prev);
      if (wasUnread) setUnreadCount((c) => c + 1);
    }
  }, [notifications]);

  const markAllRead = useCallback(async () => {
    const prev = notifications;
    const prevCount = unreadCount;
    setNotifications((cur) => cur.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await apiFetch("/api/notifications/mark-all-read", { method: "POST" });
    } catch {
      setNotifications(prev);
      setUnreadCount(prevCount);
    }
  }, [notifications, unreadCount]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead }),
    [notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
