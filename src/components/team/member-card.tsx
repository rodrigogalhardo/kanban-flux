"use client";

import { MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";
import type { WorkspaceMemberWithUser } from "@/types";

const roleConfig = {
  ADMIN: { label: "Admin", className: "bg-primary/10 text-primary border-primary/20" },
  MEMBER: { label: "Member", className: "bg-success/10 text-success border-success/20" },
  VIEWER: { label: "Viewer", className: "bg-secondary/10 text-secondary border-secondary/20" },
};

export function MemberCard({
  member,
  onUpdateRole,
  onRemove,
}: {
  member: WorkspaceMemberWithUser;
  onUpdateRole: (id: string, role: string) => void;
  onRemove: (id: string) => void;
}) {
  const role = roleConfig[member.role];

  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 text-center">
      <div className="relative">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/10 text-lg text-primary">
            {getInitials(member.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-success" />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-neutral-900">
        {member.user.name}
      </h3>
      <Badge variant="outline" className={`mt-1 ${role.className}`}>
        {role.label}
      </Badge>
      <p className="mt-1 text-xs text-secondary">{member.user.email}</p>

      <div className="mt-3 flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-lg p-1.5 text-secondary hover:bg-surface">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onUpdateRole(member.id, "ADMIN")}>
              Set as Admin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdateRole(member.id, "MEMBER")}>
              Set as Member
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdateRole(member.id, "VIEWER")}>
              Set as Viewer
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onRemove(member.id)}
              className="text-danger focus:text-danger"
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
