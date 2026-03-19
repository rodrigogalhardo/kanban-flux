# Kanban Flux — Design Specification

## Overview

**Kanban Flux** is a full-stack project management application inspired by Trello, built with Next.js 14. It provides workspace dashboards, Kanban boards with drag-and-drop, card detail modals with checklists/labels/comments, and team management.

Design source: Google Stitch project (Kanban Flux)

## Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | Next.js 14 + React + TypeScript | SSR, App Router, performance |
| UI | Tailwind CSS + shadcn/ui | Rapid implementation, design fidelity |
| Drag & Drop | @hello-pangea/dnd | Maintained fork of react-beautiful-dnd |
| Backend | Next.js API Routes (Route Handlers) | Unified project, no CORS issues |
| Database | PostgreSQL + Prisma ORM | Relational, ideal for boards/cards/users |
| Auth | NextAuth.js (Auth.js v5) | Google/email login, session management |
| Deploy | Vercel or local | Zero config for Next.js |

## Design System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | #0052CC | Main buttons, links, primary actions |
| Secondary | #42526E | Secondary text, icons, subtle elements |
| Tertiary | #00B8D9 | Badges, status indicators, highlights |
| Neutral | #091E42 | Primary text, dark backgrounds |
| Background | #FFFFFF | Page backgrounds |
| Surface | #F4F5F7 | Cards, sidebar, table rows |
| Success | #36B37E | Completed status, success states |
| Warning | #FFAB00 | Warning states, pending items |
| Danger | #FF5630 | Delete actions, error states |

### Typography

- **Headline**: Inter/Google Sans, 24-32px, weight 600-700
- **Body**: Inter, 14-16px, weight 400
- **Label**: Inter, 12-13px, weight 500, uppercase tracking

### Components

- Buttons: Primary (filled blue), Secondary (outlined), Inverted (white), Outlined (border)
- Icons: Material Design Icons (home, search, person, edit, delete, etc.)
- Search: Input with search icon, rounded
- Cards: Rounded corners (xl), shadow, hover elevation
- Modal: Overlay with backdrop blur, centered, max-width 720px
- Sidebar: Fixed left, 240px width, collapsible
- Avatar: Circular, 40px, with status indicator

## Architecture

### Project Structure

```
kanban-flux/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (providers, sidebar)
│   │   ├── page.tsx                # Dashboard (/)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx      # Login page
│   │   │   └── register/page.tsx   # Register page
│   │   ├── board/
│   │   │   └── [id]/page.tsx       # Kanban board view
│   │   ├── team/
│   │   │   └── page.tsx            # Team management
│   │   └── api/
│   │       ├── auth/[...nextauth]/ # Auth endpoints
│   │       ├── boards/             # Board CRUD
│   │       ├── columns/            # Column CRUD + reorder
│   │       ├── cards/              # Card CRUD + reorder
│   │       ├── comments/           # Comment CRUD
│   │       ├── checklists/         # Checklist CRUD
│   │       └── team/               # Team management
│   ├── components/
│   │   ├── ui/                     # shadcn/ui (button, input, dialog, etc.)
│   │   ├── layout/
│   │   │   ├── sidebar.tsx         # Left sidebar navigation
│   │   │   ├── topbar.tsx          # Top navigation bar
│   │   │   └── footer.tsx          # Footer with links
│   │   ├── dashboard/
│   │   │   ├── recent-boards.tsx   # Recent boards carousel/grid
│   │   │   ├── all-boards-table.tsx # Boards table with status/team
│   │   │   └── create-board-dialog.tsx
│   │   ├── board/
│   │   │   ├── board-view.tsx      # Main board container
│   │   │   ├── column.tsx          # Kanban column
│   │   │   ├── card.tsx            # Kanban card
│   │   │   └── card-detail-modal.tsx # Card detail modal
│   │   ├── card/
│   │   │   ├── checklist.tsx       # Checklist component
│   │   │   ├── labels.tsx          # Label badges
│   │   │   ├── members.tsx         # Member avatars
│   │   │   ├── comments.tsx        # Comment feed
│   │   │   └── activity.tsx        # Activity timeline
│   │   └── team/
│   │       ├── member-card.tsx     # Team member card
│   │       ├── member-grid.tsx     # Grid of member cards
│   │       └── invite-modal.tsx    # Invite member dialog
│   ├── lib/
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── auth.ts                # NextAuth configuration
│   │   └── utils.ts               # Utility functions
│   └── types/
│       └── index.ts               # Shared TypeScript types
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── seed.ts                    # Seed data for development
├── public/
│   └── images/                    # Static assets
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

### Data Model (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String?
  avatar    String?
  createdAt DateTime @default(now())

  workspaces  WorkspaceMember[]
  cards       CardMember[]
  comments    Comment[]
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())

  boards  Board[]
  members WorkspaceMember[]
}

model WorkspaceMember {
  id          String @id @default(cuid())
  role        Role   @default(MEMBER)
  userId      String
  workspaceId String

  user      User      @relation(fields: [userId], references: [id])
  workspace Workspace @relation(fields: [workspaceId], references: [id])

  @@unique([userId, workspaceId])
}

enum Role {
  ADMIN
  MEMBER
  VIEWER
}

model Board {
  id          String      @id @default(cuid())
  name        String
  description String?
  coverImage  String?
  status      BoardStatus @default(ACTIVE)
  workspaceId String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id])
  columns   Column[]
}

enum BoardStatus {
  ACTIVE
  ARCHIVED
  PAUSED
}

model Column {
  id       String @id @default(cuid())
  title    String
  position Int
  boardId  String

  board Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)
  cards Card[]
}

model Card {
  id          String    @id @default(cuid())
  title       String
  description String?
  position    Int
  dueDate     DateTime?
  columnId    String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  column     Column        @relation(fields: [columnId], references: [id], onDelete: Cascade)
  labels     CardLabel[]
  members    CardMember[]
  checklists Checklist[]
  comments   Comment[]
}

model Label {
  id    String @id @default(cuid())
  name  String
  color String

  cards CardLabel[]
}

model CardLabel {
  cardId  String
  labelId String

  card  Card  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  label Label @relation(fields: [labelId], references: [id])

  @@id([cardId, labelId])
}

model CardMember {
  cardId String
  userId String

  card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@id([cardId, userId])
}

model Checklist {
  id     String @id @default(cuid())
  title  String
  cardId String

  card  Card            @relation(fields: [cardId], references: [id], onDelete: Cascade)
  items ChecklistItem[]
}

model ChecklistItem {
  id          String  @id @default(cuid())
  text        String
  completed   Boolean @default(false)
  checklistId String

  checklist Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
}

model Comment {
  id        String   @id @default(cuid())
  text      String
  userId    String
  cardId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)
}
```

## Screens

### 1. Dashboard (`/`)

**Layout**: Sidebar (left, 240px) + Main content area

**Sidebar Navigation**:
- Logo "Kanban Flux" at top
- Project Space (workspace selector)
- Workspace
- Boards
- Calendar (link, future feature)
- Members
- Settings

**Top Bar**: KanbanFlux logo | Dashboard | My Tasks | Team | Reports | Notifications | User avatar

**Main Content**:
- **Recent Boards** section:
  - "View activity" link (top right)
  - Horizontal scroll/grid of board cards (max 3-4 visible)
  - Each card: cover image, board name, member count, member avatars
  - "+ Create Board" button card (blue, with plus icon)
- **All Boards** table:
  - Columns: PROJECT NAME, STATUS, TEAM, LAST EDITED
  - Status badges: Active (green), Paused (yellow), Archived (gray)
  - Team shown as avatar group
  - Rows: clickable, navigate to board

**Footer**: Help Center | Copyright | Privacy Policy | Terms of Service | Status

### 2. Kanban Board (`/board/[id]`)

**Layout**: Same sidebar + topbar

**Board Header**: Board name ("Product Launch Q4") + "Create Board" button

**Kanban Columns**:
- Default columns: "To Do", "In Progress", "Done"
- Each column has a header with title and card count
- "+ Add Card" button at bottom of each column
- Drag-and-drop between columns and within columns

**Cards**:
- Card title
- Label badges (colored chips)
- Member avatars (bottom right)
- Due date indicator
- Checklist progress bar (if checklist exists)
- Click opens Card Detail Modal

### 3. Card Detail Modal (overlay on board)

**Modal Structure** (max-width 720px, centered overlay with backdrop):

**Header**:
- Card title (editable)
- Close button (X) top right

**Left Side** (main content, ~65%):
- **Description**: Rich text area, editable
- **Checklist**: Title, progress bar, checkbox items, "+ Add item"
- **Activity**: Comment feed with user avatar, name, timestamp, text. Input: "Write a comment..." + Send button

**Right Side** (actions panel, ~35%):
- Members (avatar list + add)
- Labels (color chips + add)
- Checklist (add new)
- Due Date (date picker)
- Attachments (future)
- Actions: Archive, Delete

### 4. Team Management (`/team`)

**Layout**: Same sidebar + topbar (Team tab active)

**Header**:
- Title: "Team Management"
- Subtitle: "Manage your organization's workspace access, roles, and collaboration permissions."
- "Invite Member" button (blue, top right)

**Search & Filters**:
- Search bar: "Search members by name or email..."
- Tab filters: All Members (count), Admins, Viewers

**Member Grid** (2-3 columns):
- Member card: Avatar (large), Name, Role badge (colored), Job title
- Status indicators (online/offline dots)
- Three-dot menu (edit role, remove)
- "Add New Member" card (dashed border, plus icon, descriptive text)

**Footer**: "+ Create Board" button at bottom

## API Endpoints

### Auth
- `POST /api/auth/[...nextauth]` — NextAuth handlers

### Boards
- `GET /api/boards` — List all boards in workspace
- `POST /api/boards` — Create board
- `GET /api/boards/[id]` — Get board with columns and cards
- `PATCH /api/boards/[id]` — Update board
- `DELETE /api/boards/[id]` — Delete/archive board

### Columns
- `POST /api/columns` — Create column
- `PATCH /api/columns/[id]` — Update column (title, position)
- `DELETE /api/columns/[id]` — Delete column
- `PATCH /api/columns/reorder` — Reorder columns (drag-and-drop)

### Cards
- `POST /api/cards` — Create card
- `GET /api/cards/[id]` — Get card details
- `PATCH /api/cards/[id]` — Update card
- `DELETE /api/cards/[id]` — Delete card
- `PATCH /api/cards/reorder` — Move/reorder cards (drag-and-drop)

### Card Sub-resources
- `POST /api/cards/[id]/comments` — Add comment
- `POST /api/cards/[id]/checklists` — Add checklist
- `PATCH /api/checklists/[id]/items/[itemId]` — Toggle checklist item
- `POST /api/cards/[id]/labels` — Assign label
- `POST /api/cards/[id]/members` — Assign member

### Team
- `GET /api/team` — List workspace members
- `POST /api/team/invite` — Invite member
- `PATCH /api/team/[id]` — Update member role
- `DELETE /api/team/[id]` — Remove member

## Key Interactions

1. **Drag and Drop**: Cards can be dragged between columns and reordered within columns. Columns maintain position order. Uses optimistic updates for instant feedback.
2. **Card Modal**: Opens as overlay on current page (URL doesn't change). Supports inline editing of title, description, and checklist items.
3. **Create Board**: Dialog/modal from dashboard with name, description, and optional cover image.
4. **Invite Member**: Modal with email input and role selector (Admin/Member/Viewer).
5. **Board Status**: Toggle between Active/Paused/Archived from board settings or dashboard table.

## Success Criteria

- [ ] All 4 screens match the Stitch design visually
- [ ] Drag-and-drop works smoothly on the Kanban board
- [ ] Full CRUD for boards, columns, cards, comments, checklists
- [ ] Card detail modal with all sub-features working
- [ ] Team management with role-based access
- [ ] Authentication with NextAuth
- [ ] Responsive sidebar navigation
- [ ] Seed data for demo purposes
- [ ] TypeScript strict mode, no `any` types
