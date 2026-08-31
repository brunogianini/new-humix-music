import { Flame, Trophy } from "lucide-react";
import type { FriendshipDTO } from "@/lib/types";

export function FriendshipBadge({ friendship }: { friendship: FriendshipDTO }) {
  return (
    <div className="flex items-center gap-3 text-xs text-neutral-500">
      <span className="inline-flex items-center gap-1" title="Streak de amizade">
        <Flame size={13} className="text-amber-400" />
        <span className="text-neutral-300">{friendship.streak}</span>
      </span>
      <span className="inline-flex items-center gap-1" title="Pontos de amizade">
        <Trophy size={13} className="text-accent-soft" />
        <span className="text-neutral-300">{friendship.points}</span>
      </span>
    </div>
  );
}
