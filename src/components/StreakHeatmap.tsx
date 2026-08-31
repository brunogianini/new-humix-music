"use client";

import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { eachWeekOfInterval, endOfWeek, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { StreakDTO } from "@/lib/types";

function intensityClass(count: number, max: number): string {
  if (count === 0) return "bg-neutral-800";
  const ratio = count / Math.max(max, 1);
  if (ratio > 0.75) return "bg-accent";
  if (ratio > 0.5) return "bg-accent/70";
  if (ratio > 0.25) return "bg-accent/45";
  return "bg-accent/25";
}

export function StreakHeatmap({ streak }: { streak: StreakDTO }) {
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const { weeks, max } = useMemo(() => {
    const byDate = new Map(streak.days.map((d) => [d.date, d.count]));
    const first = parseISO(streak.days[0]?.date ?? format(new Date(), "yyyy-MM-dd"));
    const last = parseISO(streak.days[streak.days.length - 1]?.date ?? format(new Date(), "yyyy-MM-dd"));
    const weekStarts = eachWeekOfInterval({ start: first, end: last }, { weekStartsOn: 0 });
    const weeks = weekStarts.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
      const days: { date: string; count: number }[] = [];
      for (let d = weekStart; d <= weekEnd; d = new Date(d.getTime() + 86_400_000)) {
        const key = format(d, "yyyy-MM-dd");
        days.push({ date: key, count: byDate.get(key) ?? 0 });
      }
      return days;
    });
    const max = Math.max(1, ...streak.days.map((d) => d.count));
    return { weeks, max };
  }, [streak.days]);

  return (
    <div className="rounded-lg bg-neutral-900 p-4 ring-1 ring-white/5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Streak de escutas
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-accent-soft">
          <Flame size={14} />
          <span>
            {streak.currentStreak} {streak.currentStreak === 1 ? "dia" : "dias"} seguidos
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoverDay(day.date)}
                  onMouseLeave={() => setHoverDay((cur) => (cur === day.date ? null : cur))}
                  className={`relative h-2.5 w-2.5 rounded-sm ${intensityClass(day.count, max)}`}
                >
                  {hoverDay === day.date && (
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-200 ring-1 ring-white/10">
                      {format(parseISO(day.date), "d 'de' MMM", { locale: ptBR })} ·{" "}
                      {day.count} {day.count === 1 ? "escuta" : "escutas"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
        <span>
          Streak atual: <span className="text-neutral-300">{streak.currentStreak}</span>
        </span>
        <span>
          Streak mais longo: <span className="text-neutral-300">{streak.longestStreak}</span>
        </span>
        <span>
          Dias ativos: <span className="text-neutral-300">{streak.totalActiveDays}</span>
        </span>
      </div>
    </div>
  );
}
