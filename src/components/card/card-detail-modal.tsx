"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  CheckSquare,
  Trash2,
  Archive,
  Calendar,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ChecklistSection } from "./checklist";
import { CommentsSection } from "./comments";
import { LabelsSection } from "./labels";
import { MembersSection } from "./members";
import { LabelPicker } from "./label-picker";
import { MemberPicker } from "./member-picker";
import { DueDatePicker } from "./due-date-picker";
import { AgentRunTrigger } from "@/components/agents/agent-run-trigger";
import { AgentRunStatus } from "@/components/agents/agent-run-status";
import { Markdown } from "@/components/ui/markdown";
import { DependenciesSection } from "./dependencies";
import type { CardWithDetails } from "@/types";

export function CardDetailModal({
  card: initialCard,
  open,
  onOpenChange,
  boardId,
}: {
  card: CardWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}) {
  const [card, setCard] = useState(initialCard);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [showChecklistInput, setShowChecklistInput] = useState(false);

  const refreshCard = useCallback(async () => {
    const res = await fetch(`/api/cards/${card.id}`);
    const data = await res.json();
    setCard(data);
  }, [card.id]);

  useEffect(() => {
    setCard(initialCard);
    setTitle(initialCard.title);
    setDescription(initialCard.description || "");
  }, [initialCard]);

  async function updateCard(data: Record<string, unknown>) {
    await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    refreshCard();
  }

  async function handleTitleSave() {
    if (title.trim() && title !== card.title) {
      await updateCard({ title: title.trim() });
    }
    setIsEditingTitle(false);
  }

  async function handleDescriptionSave() {
    if (description !== (card.description || "")) {
      await updateCard({ description });
    }
    setIsEditingDesc(false);
  }

  async function addChecklist() {
    if (!newChecklistTitle.trim()) return;
    await fetch(`/api/cards/${card.id}/checklists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newChecklistTitle.trim() }),
    });
    setNewChecklistTitle("");
    setShowChecklistInput(false);
    refreshCard();
  }

  async function deleteCard() {
    await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          {isEditingTitle ? (
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") {
                  setTitle(card.title);
                  setIsEditingTitle(false);
                }
              }}
              className="text-lg font-semibold"
            />
          ) : (
            <DialogTitle
              onClick={() => setIsEditingTitle(true)}
              className="cursor-pointer text-lg hover:text-primary"
            >
              {card.title}
            </DialogTitle>
          )}
        </DialogHeader>

        <div className="flex gap-6 p-6">
          {/* Left side - Main content */}
          <div className="flex-1 space-y-6 min-w-0">
            {/* Labels */}
            {card.labels.length > 0 && (
              <LabelsSection labels={card.labels} />
            )}

            {/* Members */}
            {card.members.length > 0 && (
              <MembersSection members={card.members} />
            )}

            {/* Due Date */}
            {card.dueDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-secondary" />
                <span className="text-sm text-secondary">
                  Due {formatDate(card.dueDate)}
                </span>
              </div>
            )}

            {/* Description */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-neutral-900">
                Description
              </h4>
              {isEditingDesc ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleDescriptionSave}
                      className="bg-primary hover:bg-primary-600"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDescription(card.description || "");
                        setIsEditingDesc(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingDesc(true)}
                  className="min-h-[60px] cursor-pointer rounded-lg bg-surface p-3 text-sm text-secondary hover:bg-gray-200"
                >
                  {card.description ? (
                    <Markdown content={card.description} />
                  ) : (
                    "Add a more detailed description..."
                  )}
                </div>
              )}
            </div>

            {/* Dependencies */}
            <Separator />
            <DependenciesSection cardId={card.id} boardId={boardId} />

            {/* Checklists */}
            {card.checklists.length > 0 && (
              <>
                <Separator />
                <ChecklistSection
                  checklists={card.checklists}
                  onUpdate={refreshCard}
                />
              </>
            )}

            {/* Comments */}
            <Separator />
            <CommentsSection
              comments={card.comments}
              cardId={card.id}
              onUpdate={refreshCard}
            />
          </div>

          {/* Right side - Actions */}
          <div className="w-[180px] flex-shrink-0 space-y-2">
            <p className="text-xs font-medium uppercase text-secondary mb-2">
              Add to card
            </p>
            <MemberPicker
              cardId={card.id}
              currentMembers={card.members}
              onUpdate={refreshCard}
            />
            <LabelPicker
              cardId={card.id}
              currentLabels={card.labels}
              onUpdate={refreshCard}
            />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-secondary"
              onClick={() => setShowChecklistInput(true)}
            >
              <CheckSquare className="h-4 w-4" />
              Checklist
            </Button>
            <DueDatePicker
              cardId={card.id}
              currentDueDate={card.dueDate}
              onUpdate={refreshCard}
            />

            {showChecklistInput && (
              <div className="space-y-2 rounded-lg border p-2">
                <Input
                  autoFocus
                  placeholder="Checklist title..."
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addChecklist();
                    if (e.key === "Escape") setShowChecklistInput(false);
                  }}
                  className="text-sm h-8"
                />
                <Button
                  size="sm"
                  onClick={addChecklist}
                  className="w-full bg-primary hover:bg-primary-600"
                >
                  Add
                </Button>
              </div>
            )}

            <Separator className="my-3" />

            {/* AI Agent Section */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                AI Agent
              </p>
              <AgentRunTrigger
                cardId={card.id}
                members={card.members}
                onRunStarted={refreshCard}
              />
              <AgentRunStatus cardId={card.id} onRunCompleted={refreshCard} />
            </div>

            <Separator className="my-3" />

            <p className="text-xs font-medium uppercase text-secondary mb-2">
              Actions
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-secondary"
              onClick={deleteCard}
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-danger hover:text-danger"
              onClick={deleteCard}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
