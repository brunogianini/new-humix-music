import { getCurrentUser } from "@/lib/dal";
import { AuthProvider } from "@/context/AuthContext";
import { LibraryProvider } from "@/context/LibraryContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { AppShell } from "@/components/AppShell";
import { LandingPage } from "@/components/LandingPage";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    return <LandingPage />;
  }

  return (
    <AuthProvider user={{ ...user, createdAt: user.createdAt.toISOString() }}>
      <LibraryProvider>
        <NotificationsProvider>
          <AppShell />
        </NotificationsProvider>
      </LibraryProvider>
    </AuthProvider>
  );
}
