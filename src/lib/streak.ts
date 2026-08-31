import { prisma } from "@/lib/prisma";
import type { StreakDTO } from "@/lib/types";

const HEATMAP_DAYS = 371; // 53 weeks, matches a GitHub-style contribution grid
const DAY_MS = 86_400_000;

// Listened-on dates are UTC-midnight-anchored (an <input type="date"> value like
// "2026-08-25" is parsed as UTC via `new Date(...)`), so day-bucketing must use UTC
// calendar days too — the server's local timezone would shift any date with a
// non-UTC offset onto the wrong day.
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayKeyToMs(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function computeStreak(dates: Date[]): StreakDTO {
  const countByDay = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey(date);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const todayStart = dayKeyToMs(dayKey(new Date()));
  const days: StreakDTO["days"] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(todayStart - i * DAY_MS));
    days.push({ date: key, count: countByDay.get(key) ?? 0 });
  }

  const activeDayKeys = [...countByDay.keys()].sort();
  const totalActiveDays = activeDayKeys.length;

  let longestStreak = 0;
  let running = 0;
  let prevDayMs: number | null = null;
  for (const key of activeDayKeys) {
    const ms = dayKeyToMs(key);
    running = prevDayMs != null && ms - prevDayMs === DAY_MS ? running + 1 : 1;
    longestStreak = Math.max(longestStreak, running);
    prevDayMs = ms;
  }

  let currentStreak = 0;
  let cursor = todayStart;
  // Today doesn't break the streak if it just hasn't happened yet — start
  // counting from today if active, otherwise allow yesterday to anchor it.
  if (!countByDay.has(dayKey(new Date(cursor)))) {
    cursor -= DAY_MS;
  }
  while (countByDay.has(dayKey(new Date(cursor)))) {
    currentStreak += 1;
    cursor -= DAY_MS;
  }

  return { days, currentStreak, longestStreak, totalActiveDays };
}

export async function getStreak(userId: string): Promise<StreakDTO> {
  const logs = await prisma.listenLog.findMany({
    where: { userId },
    select: { listenedOn: true },
  });
  return computeStreak(logs.map((l) => l.listenedOn));
}
