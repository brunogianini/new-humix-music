"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { ApiError } from "@/lib/api";

export function AvatarCoverUpload({
  label,
  shape,
  currentUrl,
  uploadEndpoint,
  onChange,
}: {
  label: string;
  shape: "avatar" | "cover";
  currentUrl: string | null;
  uploadEndpoint: string;
  onChange: (url: string | null) => void;
}) {
  const [mode, setMode] = useState<"link" | "file">("link");
  const [urlInput, setUrlInput] = useState(currentUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data?.error ?? "Falha ao enviar imagem.");
      onChange(data.avatarUrl ?? data.coverUrl ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-neutral-400">{label}</p>

      <div
        className={`overflow-hidden bg-neutral-800 ring-1 ring-white/10 ${
          shape === "avatar" ? "h-20 w-20 rounded-full" : "h-24 w-full rounded-lg"
        }`}
      >
        {currentUrl && <img src={currentUrl} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="inline-flex w-fit rounded-full bg-neutral-800 p-0.5 text-xs ring-1 ring-white/10">
        <button
          type="button"
          onClick={() => setMode("link")}
          className={`rounded-full px-2.5 py-1 ${mode === "link" ? "bg-accent text-neutral-950" : "text-neutral-400"}`}
        >
          Colar link
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`rounded-full px-2.5 py-1 ${mode === "file" ? "bg-accent text-neutral-950" : "text-neutral-400"}`}
        >
          Enviar arquivo
        </button>
      </div>

      {mode === "link" ? (
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://…"
            className="flex-1 rounded bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 outline-none ring-1 ring-white/10 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={() => onChange(urlInput.trim() || null)}
            className="shrink-0 rounded bg-accent px-3 text-sm font-medium text-neutral-950 hover:bg-neutral-300"
          >
            Usar
          </button>
          {currentUrl && (
            <button
              type="button"
              onClick={() => {
                setUrlInput("");
                onChange(null);
              }}
              className="shrink-0 rounded p-1.5 text-neutral-400 hover:text-white"
              aria-label="Remover"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 ring-1 ring-white/10 hover:bg-neutral-700 disabled:opacity-60"
          >
            <Upload size={14} /> {uploading ? "Enviando…" : "Escolher imagem"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
