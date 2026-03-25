"use client";

import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import type { CommentWithUser } from "@/types";

interface CurrentUser {
  id: string;
  name: string;
}

export function CommentsSection({
  comments,
  cardId,
  onUpdate,
}: {
  comments: CommentWithUser[];
  cardId: string;
  onUpdate: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch("/api/team");
        if (res.ok) {
          const members = await res.json();
          if (members.length > 0) {
            const firstHuman = members.find(
              (m: { user: { isAgent?: boolean } }) => !m.user.isAgent
            );
            const member = firstHuman || members[0];
            setCurrentUser({ id: member.user.id, name: member.user.name });
          }
        }
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    }
    fetchCurrentUser();
  }, []);

  async function handleSubmit() {
    if (!text.trim() || !currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${cardId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          userId: currentUser.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to post comment");
      }
      setText("");
      setError(null);
      onUpdate();
    } catch (err) {
      console.error("Failed to post comment:", err);
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setLoading(false);
    }
  }

  function timeAgo(date: string | Date) {
    const seconds = Math.floor(
      (Date.now() - new Date(date).getTime()) / 1000
    );
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-neutral-900">Activity</h4>

      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-xs text-primary">
            {currentUser ? getInitials(currentUser.name) : "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Textarea
            placeholder="Write a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
          {error && (
            <p className="mt-1 text-xs text-red-500">{error}</p>
          )}
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading || !text.trim() || !currentUser}
              className="bg-primary hover:bg-primary-600"
            >
              <Send className="mr-1.5 h-3 w-3" />
              Send
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-tertiary/10 text-xs text-tertiary">
                {getInitials(comment.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-900">
                  {comment.user.name}
                </span>
                <span className="text-xs text-secondary">
                  {timeAgo(comment.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-secondary">{comment.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
