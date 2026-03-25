"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CreateBoardDialog } from "@/components/dashboard/create-board-dialog";
import {
  Users,
  Layers,
  Plus,
  MoreHorizontal,
  Archive,
  Trash2,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { BoardSummary } from "@/types";

const DEFAULT_WORKSPACE_ID = "default-workspace";

const boardCovers = [
  "from-primary to-primary-400",
  "from-tertiary to-blue-400",
  "from-purple-500 to-pink-500",
  "from-success to-emerald-400",
  "from-warning to-orange-400",
];

export default function BoardsPage() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch("/api/boards");
      const data = await res.json();
      setBoards(data);
    } catch {
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const getMembers = (board: BoardSummary) => {
    const memberMap = new Map<
      string,
      { id: string; name: string; avatar: string | null }
    >();
    board.columns.forEach((col) =>
      col.cards.forEach((card) =>
        card.members.forEach((m) => memberMap.set(m.user.id, m.user))
      )
    );
    return Array.from(memberMap.values());
  };

  const getCardCount = (board: BoardSummary) =>
    board.columns.reduce((sum, col) => sum + col.cards.length, 0);

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

  async function handleArchiveBoard(id: string) {
    await fetch(`/api/boards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    fetchBoards();
  }

  async function handleDeleteBoard(id: string) {
    await fetch(`/api/boards/${id}`, { method: "DELETE" });
    fetchBoards();
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Boards</h1>
            <p className="text-secondary">All your project boards</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-primary hover:bg-primary-600"
          >
            <Plus className="mr-1 h-4 w-4" />
            Create Board
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board, index) => {
              const members = getMembers(board);
              const cardCount = getCardCount(board);

              return (
                <Card key={board.id} className="group relative overflow-hidden">
                  {/* Cover gradient */}
                  <div
                    className={cn(
                      "h-3 bg-gradient-to-r",
                      boardCovers[index % boardCovers.length]
                    )}
                  />

                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/board/${board.id}`}
                          className="hover:underline"
                        >
                          <CardTitle className="truncate">
                            {board.name}
                          </CardTitle>
                        </Link>
                        {board.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {board.description}
                          </CardDescription>
                        )}
                      </div>

                      {/* Actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-md p-1 opacity-0 transition-opacity hover:bg-surface group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4 text-secondary" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleArchiveBoard(board.id)}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDeleteBoard(board.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant(board.status)}>
                          {board.status.charAt(0) +
                            board.status.slice(1).toLowerCase()}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-secondary">
                          <Layers className="h-3.5 w-3.5" />
                          {cardCount} card{cardCount !== 1 ? "s" : ""}
                        </div>
                        {members.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-secondary">
                            <Users className="h-3.5 w-3.5" />
                            {members.length} member
                            {members.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>

                      {/* Member avatars */}
                      {members.length > 0 && (
                        <div className="flex -space-x-2">
                          {members.slice(0, 3).map((member) => (
                            <Avatar
                              key={member.id}
                              size="sm"
                              className="border-2 border-white"
                            >
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {members.length > 3 && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] text-secondary">
                              +{members.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Create Board card */}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary transition-colors hover:border-primary hover:bg-primary/10"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">Create Board</span>
            </button>
          </div>
        )}

        <CreateBoardDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          workspaceId={DEFAULT_WORKSPACE_ID}
          onBoardCreated={fetchBoards}
        />
      </div>
    </AppLayout>
  );
}
