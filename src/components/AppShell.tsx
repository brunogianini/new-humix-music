"use client";

import { useState } from "react";
import {
  Disc3,
  Home,
  ListMusic,
  LogOut,
  NotebookText,
  Search,
  Settings,
  Sparkles,
  Users,
  UserRound,
} from "lucide-react";
import { useLibrary } from "@/context/LibraryContext";
import { useAuth } from "@/context/AuthContext";
import { logout } from "@/app/(auth)/actions";
import { HomeView } from "./views/HomeView";
import { SearchView } from "./views/SearchView";
import { DiaryView } from "./views/DiaryView";
import { ListsView } from "./views/ListsView";
import { ForYouView } from "./views/ForYouView";
import { ProfileView } from "./views/ProfileView";
import { ArtistView } from "./views/ArtistView";
import { FriendsView } from "./views/FriendsView";
import { SettingsView } from "./SettingsView";
import { TopBar } from "./TopBar";
import { AlbumModal } from "./AlbumModal";
import type { AlbumLike, ArtistRef } from "./AlbumCard";

type Tab = "home" | "search" | "forYou" | "diary" | "lists" | "friends" | "profile" | "settings";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "search", label: "Buscar", icon: Search },
  { id: "forYou", label: "Para você", icon: Sparkles },
  { id: "diary", label: "Diário", icon: NotebookText },
  { id: "lists", label: "Listas", icon: ListMusic },
  { id: "friends", label: "Amigos", icon: Users },
  { id: "profile", label: "Perfil", icon: UserRound },
  { id: "settings", label: "Configurações", icon: Settings },
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>("home");
  const [activeAlbum, setActiveAlbum] = useState<AlbumLike | null>(null);
  const [activeArtist, setActiveArtist] = useState<ArtistRef | null>(null);
  const { toast } = useLibrary();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col gap-1 border-r border-white/10 bg-neutral-950 py-4 md:w-60 md:px-3">
        <div className="mb-6 flex items-center justify-center gap-2 px-1 text-accent md:justify-start md:px-2">
          <Disc3 size={26} />
          <span className="hidden text-base font-semibold tracking-tight text-neutral-50 md:inline">
            Humix Music
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setActiveArtist(null);
              }}
              className={`flex items-center justify-center gap-2.5 rounded-lg px-2 py-2.5 text-sm transition md:justify-start md:px-3 ${
                tab === id && !activeArtist
                  ? "bg-accent text-neutral-950"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
              }`}
            >
              <Icon size={18} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-3">
          <div className="hidden truncate px-3 text-xs text-neutral-500 md:block">
            {user.name || user.email}
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-lg px-2 py-2.5 text-sm text-neutral-400 transition hover:bg-red-900/60 hover:text-red-300 md:justify-start md:px-3"
            >
              <LogOut size={18} />
              <span className="hidden md:inline">Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
        <TopBar />
        <div className="mx-auto max-w-6xl">
          {/* Kept mounted (just hidden) behind the artist page so search text,
              scroll position, etc. survive a round trip through an artist. */}
          <div className={activeArtist ? "hidden" : "contents"}>
            {tab === "home" && (
              <HomeView
                onOpenAlbum={setActiveAlbum}
                onOpenArtist={setActiveArtist}
                onNavigateSearch={() => setTab("search")}
              />
            )}
            {tab === "search" && (
              <SearchView onOpenAlbum={setActiveAlbum} onOpenArtist={setActiveArtist} />
            )}
            {tab === "forYou" && (
              <ForYouView onOpenAlbum={setActiveAlbum} onOpenArtist={setActiveArtist} />
            )}
            {tab === "diary" && (
              <DiaryView onOpenAlbum={setActiveAlbum} onOpenArtist={setActiveArtist} />
            )}
            {tab === "lists" && (
              <ListsView onOpenAlbum={setActiveAlbum} onOpenArtist={setActiveArtist} />
            )}
            {tab === "friends" && <FriendsView onOpenAlbum={setActiveAlbum} />}
            {tab === "profile" && <ProfileView />}
            {tab === "settings" && <SettingsView />}
          </div>

          {activeArtist && (
            <ArtistView
              artist={activeArtist}
              onOpenAlbum={setActiveAlbum}
              onBack={() => setActiveArtist(null)}
            />
          )}
        </div>
      </main>

      {activeAlbum && (
        <AlbumModal
          album={activeAlbum}
          onClose={() => setActiveAlbum(null)}
          onOpenAlbum={setActiveAlbum}
          onOpenArtist={(artist) => {
            setActiveAlbum(null);
            setActiveArtist(artist);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-neutral-800 px-4 py-2 text-sm text-neutral-100 shadow-xl ring-1 ring-white/10">
          {toast}
        </div>
      )}
    </div>
  );
}
