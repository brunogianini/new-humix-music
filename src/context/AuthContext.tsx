"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  favoriteAlbumId: string | null;
  featuredTab: string;
};

type AuthContextValue = {
  user: CurrentUser;
  updateUser: (patch: Partial<CurrentUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  user: initialUser,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  const [user, setUser] = useState<CurrentUser>(initialUser);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      updateUser: (patch) => setUser((cur) => ({ ...cur, ...patch })),
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
