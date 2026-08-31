import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { getPublicProfile } from "@/lib/profile";
import { AuthProvider } from "@/context/AuthContext";
import { LibraryProvider } from "@/context/LibraryContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { PublicProfileClient } from "@/components/profile/PublicProfileClient";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: viewerId } = await verifySession();
  const { userId: targetId } = await params;

  const [currentUser, profile] = await Promise.all([
    getCurrentUser(),
    getPublicProfile(viewerId, targetId),
  ]);

  if (!currentUser) notFound();
  if (!profile) notFound();

  return (
    <AuthProvider user={{ ...currentUser, createdAt: currentUser.createdAt.toISOString() }}>
      <LibraryProvider>
        <NotificationsProvider>
          <PublicProfileClient profile={profile} />
        </NotificationsProvider>
      </LibraryProvider>
    </AuthProvider>
  );
}
