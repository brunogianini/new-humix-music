"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";

type SpotifyStatus = { connected: boolean; connectedAt: string | null };

export function SettingsView() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<SpotifyStatus>("/api/spotify/status");
        setStatus(data);
      } catch {
        setStatus({ connected: false, connectedAt: null });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleDisconnect() {
    setError(null);
    try {
      await apiFetch("/api/spotify/disconnect", { method: "POST" });
      setStatus({ connected: false, connectedAt: null });
      setImportResult(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao desconectar.");
    }
  }

  async function handleImport() {
    setError(null);
    setImporting(true);
    setImportResult(null);
    try {
      const data = await apiFetch<{ importedAlbums: number; importedFromArtists: number }>(
        "/api/spotify/import",
        { method: "POST" }
      );
      setImportResult(
        `${data.importedAlbums} álbuns salvos e ${data.importedFromArtists} álbuns de artistas seguidos adicionados à sua biblioteca.`
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao importar.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Conta
        </h3>
        <div className="rounded-lg bg-neutral-900 p-4 ring-1 ring-white/10">
          <p className="text-sm text-neutral-200">{user.name || "Sem nome"}</p>
          <p className="text-sm text-neutral-500">{user.email}</p>
          <p className="mt-1 text-xs text-neutral-600">
            Membro desde {new Date(user.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Integrações
        </h3>
        <div className="flex flex-col gap-3 rounded-lg bg-neutral-900 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-100">Spotify</p>
              <p className="text-xs text-neutral-500">
                {loading
                  ? "Carregando…"
                  : status?.connected
                    ? "Conectado — importe álbuns salvos e artistas que você segue"
                    : "Conecte para importar álbuns salvos e artistas que você segue"}
              </p>
            </div>
            {!loading &&
              (status?.connected ? (
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  className="shrink-0 rounded-full bg-neutral-700 px-4 py-1.5 text-sm text-neutral-200 hover:bg-neutral-600"
                >
                  Desconectar
                </button>
              ) : (
                <a
                  href="/api/spotify/connect"
                  className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300"
                >
                  Conectar com Spotify
                </a>
              ))}
          </div>

          {status?.connected && (
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing}
              className="self-start rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-300 disabled:opacity-50"
            >
              {importing ? "Importando…" : "Importar biblioteca agora"}
            </button>
          )}

          {importResult && <p className="text-sm text-accent-soft">{importResult}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <p className="mt-3 text-xs text-neutral-600">
          Tidal ainda não está disponível — a API deles não permite acesso a bibliotecas
          pessoais sem um acordo comercial.
        </p>
      </div>
    </div>
  );
}
