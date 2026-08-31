"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useLibrary } from "@/context/LibraryContext";

const MAX_PINNED = 6;

export function PinnedListsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (listIds: string[]) => void;
}) {
  const { lists } = useLibrary();

  function toggle(listId: string) {
    if (value.includes(listId)) {
      onChange(value.filter((id) => id !== listId));
    } else if (value.length < MAX_PINNED) {
      onChange([...value, listId]);
    }
  }

  function move(listId: string, dir: -1 | 1) {
    const idx = value.indexOf(listId);
    const next = value.slice();
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    onChange(next);
  }

  if (lists.length === 0) {
    return <p className="text-sm text-neutral-500">Você ainda não tem listas para destacar.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Ordem de destaque</p>
          {value.map((id, idx) => {
            const list = lists.find((l) => l.id === id);
            if (!list) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-1.5 ring-1 ring-white/10"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">{list.name}</span>
                <button
                  type="button"
                  onClick={() => move(id, -1)}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-neutral-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(id, 1)}
                  disabled={idx === value.length - 1}
                  className="rounded p-0.5 text-neutral-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="text-xs text-neutral-500 hover:text-red-400"
                >
                  Remover
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-xs text-neutral-500">
          Suas listas ({value.length}/{MAX_PINNED} destacadas)
        </p>
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {lists
            .filter((l) => !value.includes(l.id))
            .map((l) => (
              <label
                key={l.id}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                <input
                  type="checkbox"
                  checked={false}
                  disabled={value.length >= MAX_PINNED}
                  onChange={() => toggle(l.id)}
                  className="accent-accent"
                />
                {l.name}
              </label>
            ))}
        </div>
      </div>
    </div>
  );
}
