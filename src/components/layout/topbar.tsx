"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Settings,
  Search,
  LogOut,
  User,
  MessageSquare,
  UserPlus,
  Bot,
  ArrowRight,
  AtSign,
  Check,
  Shield,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const tabs = [
  { label: "Dashboard", href: "/" },
  { label: "My Tasks", href: "/tasks" },
  { label: "Team", href: "/team" },
  { label: "Reports", href: "/reports" },
];

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  cardId: string | null;
  boardId: string | null;
  createdAt: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "comment":
    case "agent_comment":
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case "assignment":
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case "agent_run":
      return <Bot className="h-4 w-4 text-purple-500" />;
    case "card_move":
      return <ArrowRight className="h-4 w-4 text-orange-500" />;
    case "mention":
      return <AtSign className="h-4 w-4 text-pink-500" />;
    case "approval_required":
      return <Shield className="h-4 w-4 text-amber-500" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [userInfo, setUserInfo] = useState<UserInfo>({
    id: "",
    name: "User",
    email: "",
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/team");
        if (res.ok) {
          const members = await res.json();
          if (members.length > 0) {
            const firstHuman = members.find(
              (m: { user: { isAgent?: boolean } }) => !m.user.isAgent
            );
            const member = firstHuman || members[0];
            setUserInfo({
              id: member.user.id,
              name: member.user.name,
              email: member.user.email,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch user info:", err);
      }
    }
    fetchUser();
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userInfo.id) return;
    try {
      const res = await fetch(
        `/api/notifications?userId=${userInfo.id}&unreadOnly=true`
      );
      if (res.ok) {
        const data: Notification[] = await res.json();
        setNotifications(data);
        setUnreadCount(data.length);
      }
    } catch {
      // Silently fail
    }
  }, [userInfo.id]);

  // Fetch notifications once user is loaded, then poll every 30s
  useEffect(() => {
    if (!userInfo.id) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userInfo.id, fetchNotifications]);

  async function markAllRead() {
    if (!userInfo.id) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, userId: userInfo.id }),
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }

  async function markOneRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }

  function handleNotificationClick(notification: Notification) {
    markOneRead(notification.id);
    if (notification.boardId) {
      router.push(`/boards/${notification.boardId}`);
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-1">
        <span className="mr-4 text-lg font-semibold text-primary">
          Kanban Flux <span className="text-xs font-normal text-muted-foreground">by Lumys</span>
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
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchValue.trim()) {
                router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
              }
            }}
          />
        </div>

        <ThemeToggle />

        {/* Notifications bell with popover */}
        <Popover>
          <PopoverTrigger className="relative rounded-lg p-2 text-secondary hover:bg-surface">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-80">
            <PopoverHeader>
              <div className="flex items-center justify-between">
                <PopoverTitle>Notifications</PopoverTitle>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>
            </PopoverHeader>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No new notifications
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  You&apos;re all caught up!
                </p>
              </div>
            ) : (
              <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    className="flex items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent w-full"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight text-foreground truncate">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/60">
                        {timeAgo(notification.createdAt)}
                      </p>
                    </div>
                    <div className="mt-1 flex-shrink-0">
                      <span className="block h-2 w-2 rounded-full bg-primary" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Settings gear navigates to /settings */}
        <button
          className="rounded-lg p-2 text-secondary hover:bg-surface"
          onClick={() => router.push("/settings")}
        >
          <Settings className="h-5 w-5" />
        </button>

        {/* User avatar with dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-white text-xs">
                {getInitials(userInfo.name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1 px-0.5 py-1">
                <p className="text-sm font-medium leading-none">{userInfo.name}</p>
                <p className="text-xs text-muted-foreground leading-none">
                  {userInfo.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => router.push("/settings")}
            >
              <User className="h-4 w-4" />
              Profile &amp; Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onSelect={() => {
                document.cookie = "kanban-user-id=; path=/; max-age=0";
                localStorage.removeItem("kanban-user");
                window.location.href = "/login";
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
