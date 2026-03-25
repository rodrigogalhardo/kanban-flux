"use client";

import { useState, useEffect } from "react";
import { Users, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { getInitials } from "@/lib/utils";

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    isAgent?: boolean;
  };
}

interface MemberPickerProps {
  cardId: string;
  currentMembers: {
    user: { id: string; name: string; avatar: string | null };
  }[];
  onUpdate: () => void;
}

export function MemberPicker({
  cardId,
  currentMembers,
  onUpdate,
}: MemberPickerProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function fetchTeamMembers() {
      setLoading(true);
      try {
        const res = await fetch("/api/team");
        const data = await res.json();
        setTeamMembers(data);
      } finally {
        setLoading(false);
      }
    }

    fetchTeamMembers();
  }, [open]);

  function isAssigned(userId: string) {
    return currentMembers.some((m) => m.user.id === userId);
  }

  async function toggleMember(userId: string) {
    if (isAssigned(userId)) {
      await fetch(`/api/cards/${cardId}/members?userId=${userId}`, {
        method: "DELETE",
      });
    } else {
      await fetch(`/api/cards/${cardId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    }
    onUpdate();
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-secondary"
        onClick={() => setOpen(!open)}
      >
        <Users className="h-4 w-4" />
        Members
      </Button>
      {open && (
        <div className="mt-1 rounded-lg border bg-white p-2.5 shadow-sm space-y-2">
          <h4 className="text-xs font-semibold uppercase text-secondary">Members</h4>
          {loading ? (
            <p className="text-sm text-secondary py-2">Loading...</p>
          ) : (
            <div className="space-y-0.5">
              {teamMembers.map((member) => (
                <button
                  key={member.user.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-surface"
                  onClick={() => toggleMember(member.user.id)}
                >
                  <Checkbox
                    checked={isAssigned(member.user.id)}
                    tabIndex={-1}
                  />
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                      {getInitials(member.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{member.user.name}</span>
                  {member.user.isAgent && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                      <Bot className="h-3 w-3" />
                      (AI)
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
