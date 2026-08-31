"use client";

import { NotificationBell } from "@/components/notifications/NotificationBell";

export function TopBar() {
  return (
    <div className="sticky top-0 z-40 -mx-5 mb-4 flex h-14 items-center justify-end border-b border-white/10 bg-neutral-950/90 px-5 backdrop-blur md:-mx-8 md:px-8">
      <NotificationBell />
    </div>
  );
}
