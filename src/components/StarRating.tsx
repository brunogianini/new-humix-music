"use client";

import { Star, X } from "lucide-react";
import { useState } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function StarGlyph({ percent, size }: { percent: number; size: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <Star className="absolute inset-0 text-neutral-700" style={{ width: size, height: size }} />
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${clamp(percent, 0, 100)}%` }}
      >
        <Star
          className="text-accent fill-accent"
          style={{ width: size, height: size }}
        />
      </span>
    </span>
  );
}

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
  allowClear = true,
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: number;
  readOnly?: boolean;
  allowClear?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;

  function handleClick(starIndex: number, e: React.MouseEvent<HTMLSpanElement>) {
    if (readOnly || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    const half = starIndex * 2 + (isLeftHalf ? 1 : 2);
    onChange(half === value ? half : half);
  }

  function handleMove(starIndex: number, e: React.MouseEvent<HTMLSpanElement>) {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;
    setHover(starIndex * 2 + (isLeftHalf ? 1 : 2));
  }

  return (
    <div className="inline-flex items-center gap-1">
      <div
        className={readOnly ? "inline-flex" : "inline-flex cursor-pointer"}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const percent = clamp((display - i * 2) * 50, 0, 100);
          return (
            <span
              key={i}
              onClick={(e) => handleClick(i, e)}
              onMouseMove={(e) => handleMove(i, e)}
            >
              <StarGlyph percent={percent} size={size} />
            </span>
          );
        })}
      </div>
      {!readOnly && allowClear && value != null && (
        <button
          type="button"
          onClick={() => onChange?.(null)}
          className="text-neutral-500 hover:text-neutral-300"
          aria-label="Limpar avaliação"
        >
          <X size={size * 0.7} />
        </button>
      )}
    </div>
  );
}

export function ratingToText(value: number | null): string {
  if (value == null) return "—";
  return (value / 2).toFixed(1).replace(/\.0$/, "");
}
