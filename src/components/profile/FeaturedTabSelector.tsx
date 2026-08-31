"use client";

const OPTIONS: { id: "diary" | "lists" | "stats"; label: string }[] = [
  { id: "diary", label: "Diário" },
  { id: "lists", label: "Listas" },
  { id: "stats", label: "Estatísticas" },
];

export function FeaturedTabSelector({
  value,
  onChange,
}: {
  value: "diary" | "lists" | "stats";
  onChange: (tab: "diary" | "lists" | "stats") => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-neutral-800 p-1 ring-1 ring-white/10">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-full px-3 py-1.5 text-sm transition ${
            value === opt.id
              ? "bg-accent text-neutral-950"
              : "text-neutral-400 hover:text-neutral-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
