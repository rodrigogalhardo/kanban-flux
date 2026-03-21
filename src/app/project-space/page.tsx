"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Activity, MessageSquare, Edit3, Clock } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

interface ActivityCard {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  column: {
    title: string;
    board: { id: string; name: string };
  };
  members: {
    user: { id: string; name: string; avatar: string | null };
  }[];
}

interface ActivityComment {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  card: { id: string; title: string };
}

interface BoardStat {
  id: string;
  name: string;
  status: string;
  _count: { columns: number };
  columns: { _count: { cards: number } }[];
}

interface WorkspaceData {
  id: string;
  name: string;
  createdAt: string;
  _count: { boards: number; members: number };
}

interface ActivityItem {
  id: string;
  type: "card_update" | "comment";
  userName: string;
  userAvatar: string | null;
  action: string;
  cardTitle: string;
  cardId: string;
  boardName?: string;
  boardId?: string;
  timestamp: string;
  preview?: string;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function ProjectSpacePage() {
  const [cards, setCards] = useState<ActivityCard[]>([]);
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [boards, setBoards] = useState<BoardStat[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [activityRes, settingsRes] = await Promise.all([
        fetch("/api/activity"),
        fetch("/api/settings"),
      ]);
      const activityData = await activityRes.json();
      const settingsData = await settingsRes.json();

      setCards(activityData.recentCards || []);
      setComments(activityData.recentComments || []);
      setBoards(activityData.boards || []);
      setWorkspace(settingsData);
    } catch {
      setCards([]);
      setComments([]);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activityFeed: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    cards.forEach((card) => {
      const user = card.members[0]?.user;
      const isNew =
        new Date(card.createdAt).getTime() ===
        new Date(card.updatedAt).getTime();
      items.push({
        id: `card-${card.id}`,
        type: "card_update",
        userName: user?.name || "Unknown",
        userAvatar: user?.avatar || null,
        action: isNew ? "created card" : "updated card",
        cardTitle: card.title,
        cardId: card.id,
        boardName: card.column.board.name,
        boardId: card.column.board.id,
        timestamp: card.updatedAt,
      });
    });

    comments.forEach((comment) => {
      items.push({
        id: `comment-${comment.id}`,
        type: "comment",
        userName: comment.user.name,
        userAvatar: comment.user.avatar,
        action: "commented on",
        cardTitle: comment.card.title,
        cardId: comment.card.id,
        timestamp: comment.createdAt,
        preview:
          comment.text.length > 80
            ? comment.text.slice(0, 80) + "..."
            : comment.text,
      });
    });

    items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return items;
  }, [cards, comments]);

  const getBoardCardCount = (board: BoardStat) =>
    board.columns.reduce((sum, col) => sum + col._count.cards, 0);

  const statusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default";
      case "ARCHIVED":
        return "secondary";
      case "PAUSED":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Project Space
          </h1>
          <p className="text-secondary">
            Overview of your workspace activity.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left column - Activity Feed */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityFeed.length === 0 ? (
                    <p className="py-8 text-center text-sm text-secondary">
                      No recent activity to display.
                    </p>
                  ) : (
                    <div className="relative">
                      {/* Timeline vertical line */}
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

                      <div className="space-y-1">
                        {activityFeed.map((item, index) => (
                          <div
                            key={item.id}
                            className={cn(
                              "relative flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-surface",
                              index === 0 && "bg-surface"
                            )}
                          >
                            {/* Avatar */}
                            <div className="relative z-10 flex-shrink-0">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getInitials(item.userName)}
                                </AvatarFallback>
                              </Avatar>
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">
                                <span className="font-medium text-neutral-900">
                                  {item.userName}
                                </span>{" "}
                                <span className="text-secondary">
                                  {item.action}
                                </span>{" "}
                                <span className="font-medium text-primary hover:underline">
                                  {item.cardTitle}
                                </span>
                                {item.boardName && (
                                  <span className="text-secondary">
                                    {" "}
                                    in{" "}
                                    <Link
                                      href={`/board/${item.boardId}`}
                                      className="text-secondary hover:text-primary hover:underline"
                                    >
                                      {item.boardName}
                                    </Link>
                                  </span>
                                )}
                              </p>
                              {item.preview && (
                                <p className="mt-1 text-xs text-secondary italic line-clamp-2">
                                  &ldquo;{item.preview}&rdquo;
                                </p>
                              )}
                            </div>

                            {/* Timestamp and icon */}
                            <div className="flex flex-shrink-0 items-center gap-2 text-xs text-secondary">
                              {item.type === "comment" ? (
                                <MessageSquare className="h-3.5 w-3.5" />
                              ) : (
                                <Edit3 className="h-3.5 w-3.5" />
                              )}
                              <span>{timeAgo(item.timestamp)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column - Quick Stats */}
            <div className="space-y-6">
              {/* Workspace info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Workspace
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-lg font-semibold text-neutral-900">
                      {workspace?.name || "My Workspace"}
                    </p>
                    <p className="text-xs text-secondary">
                      {workspace?._count.members || 0} member
                      {workspace?._count.members !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-surface p-3 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {boards.length}
                      </p>
                      <p className="text-xs text-secondary">Boards</p>
                    </div>
                    <div className="rounded-lg bg-surface p-3 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {boards.reduce(
                          (sum, b) => sum + getBoardCardCount(b),
                          0
                        )}
                      </p>
                      <p className="text-xs text-secondary">Total Cards</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Board summaries */}
              <Card>
                <CardHeader>
                  <CardTitle>Board Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {boards.length === 0 ? (
                    <p className="py-4 text-center text-sm text-secondary">
                      No boards yet.
                    </p>
                  ) : (
                    boards.map((board) => (
                      <Link
                        key={board.id}
                        href={`/board/${board.id}`}
                        className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-surface"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-900">
                            {board.name}
                          </p>
                          <p className="text-xs text-secondary">
                            {getBoardCardCount(board)} cards
                          </p>
                        </div>
                        <Badge variant={statusVariant(board.status)}>
                          {board.status.charAt(0) +
                            board.status.slice(1).toLowerCase()}
                        </Badge>
                      </Link>
                    ))
                  )}
                  <Separator />
                  <Link
                    href="/"
                    className="block text-center text-sm font-medium text-primary hover:underline"
                  >
                    View All Boards
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
