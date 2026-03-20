"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Settings, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Dashboard", href: "/" },
  { label: "My Tasks", href: "/tasks" },
  { label: "Team", href: "/team" },
  { label: "Reports", href: "/reports" },
];

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-1">
        <span className="mr-4 text-lg font-semibold text-primary">
          KanbanFlux
        </span>
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-secondary hover:text-neutral-900 hover:bg-surface"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          <Input
            placeholder="Search..."
            className="h-8 w-48 pl-8 text-sm bg-surface border-0"
          />
        </div>
        <button className="relative rounded-lg p-2 text-secondary hover:bg-surface">
          <Bell className="h-5 w-5" />
        </button>
        <button className="rounded-lg p-2 text-secondary hover:bg-surface">
          <Settings className="h-5 w-5" />
        </button>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-white text-xs">
            DU
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
