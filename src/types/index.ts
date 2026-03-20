import type {
  Board,
  Card,
  Checklist,
  ChecklistItem,
  Column,
  Comment,
  Label,
  User,
  WorkspaceMember,
} from "@prisma/client";

export type BoardWithColumns = Board & {
  columns: ColumnWithCards[];
};

export type ColumnWithCards = Column & {
  cards: CardWithDetails[];
};

export type CardWithDetails = Card & {
  labels: { label: Label }[];
  members: { user: Pick<User, "id" | "name" | "avatar"> }[];
  checklists: ChecklistWithItems[];
  comments: CommentWithUser[];
};

export type ChecklistWithItems = Checklist & {
  items: ChecklistItem[];
};

export type CommentWithUser = Comment & {
  user: Pick<User, "id" | "name" | "avatar">;
};

export type WorkspaceMemberWithUser = WorkspaceMember & {
  user: Pick<User, "id" | "name" | "email" | "avatar">;
};

export type BoardSummary = Board & {
  columns: {
    cards: {
      members: { user: Pick<User, "id" | "name" | "avatar"> }[];
    }[];
  }[];
};
