# Mobile Responsive Design — CRM DF Advogados

**Date:** 2026-04-05  
**Approach:** Mobile-first incremental via Tailwind responsive prefixes (`md:`, `lg:`). Desktop layout untouched. No new files for component variants.

---

## 1. Layout & Navigation (Layout.tsx)

### Desktop (≥ md)
No changes. Sidebar behavior stays as-is.

### Mobile (< md)
- Sidebar hidden (`hidden md:flex` or `md:block`)
- Fixed **top bar** (h-16, bg-slate-900, text-white):
  - Left: Scale icon + "DF Advogados" text
  - Right: hamburger Menu icon button
- Hamburger opens a **slide-in drawer** from the left:
  - Overlay: `fixed inset-0 bg-black/50 z-40` (click to close)
  - Drawer: `fixed top-0 left-0 h-full w-72 bg-slate-900 z-50 transform transition-transform`
  - Same nav items as desktop sidebar
  - Clicking any nav item closes the drawer
  - User info + sign out at bottom, identical to desktop sidebar
- `<main>` loses `ml-64`/`ml-20`, gains `pt-16` (top bar height) on mobile
- Internal padding: `p-4 md:p-8`
- Stale leads banner visible on mobile, below top bar

**State:** `sidebarOpen` reused as `drawerOpen` for mobile. No new state needed.

---

## 2. Dashboard

- Metric cards grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Featured cards (total leads, reuniões agendadas): `col-span-2` on all breakpoints
- Charts (`ResponsiveContainer`): full width, height reduced to `200px` on mobile (`h-48 md:h-64`)
- UTM breakdown tables: scroll horizontal wrapper (`overflow-x-auto`) on mobile
- Funnel section: single column on mobile

---

## 3. Leads List (LeadsList.tsx)

- Filter bar: already collapsible — keep. Ensure `overflow-visible` on filter containers (per CLAUDE.md rule)
- **Table → Cards on mobile:**
  - `hidden md:table` on `<table>` element
  - `md:hidden` card list below — each card shows: name (bold), score badge, status badge (colored), phone (tel: link), created date
  - Bulk action bar stays visible on mobile with smaller buttons

---

## 4. Pipeline Kanban (Pipeline.tsx)

- Kanban board container: `flex overflow-x-auto snap-x snap-mandatory`
- Each column: `snap-center flex-shrink-0 w-[85vw] md:w-72`
  - 85vw leaves ~15vw of next column peeking in
- **Replace drag-and-drop with tap action on mobile:**
  - Existing action menu (⋮) on each card gains a "Mover para etapa" option on mobile
  - Opens a simple `<select>` or inline list of stage names to pick target
  - On `md:` and above, drag-and-drop behavior unchanged
- Column headers stay sticky within scroll: `sticky top-0`

---

## 5. WhatsApp Conversations (WhatsAppConversations.tsx)

Current: two-panel layout (`flex`), left = conversation list, right = chat.

### Mobile behavior
- List panel: full width, visible by default
- Tapping a conversation sets `selectedConversation` and hides the list (`hidden` when chat open)
- Chat panel: full width, visible when conversation selected
- Top of chat panel: back button (`←`) that clears `selectedConversation`, returning to list
- CSS: `md:flex md:flex-row` on wrapper; panels use `w-full md:w-[320px]` / `flex-1`

---

## 6. Lead Detail (LeadDetail.tsx)

- Header info block: stack vertically on mobile (`flex-col md:flex-row`)
- Tab bar: horizontal scroll (`overflow-x-auto whitespace-nowrap`) — no wrapping
- Tab content padding: `p-3 md:p-6`
- WhatsAppChat height: `h-[60vh] md:h-[70vh]`
- Edit form fields: full width on mobile

---

## 7. Modals (ActivityModal.tsx, LeadDetailModal.tsx)

- Modal container: `w-full md:max-w-2xl` (or existing max-w)
- On mobile: `min-h-screen md:min-h-0 rounded-none md:rounded-xl`
- Effectively becomes a full-screen sheet on mobile
- Internal padding: `p-4 md:p-6`

---

## 8. Agenda (Agenda.tsx)

- Calendar grid: horizontal scroll wrapper or simplify to list view on mobile
- Day cells: reduce padding, smaller font
- Event cards: full width on mobile

---

## 9. Reports & Config Pages (AttendanceReport, WeeklyReport, WhatsAppSettings, etc.)

- Stat grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Tables: `overflow-x-auto` wrappers
- Form layouts: `flex-col md:flex-row`

---

## 10. Login Page

- Form card: `w-full max-w-md mx-auto` with `p-6 md:p-8`
- Already likely responsive — verify and adjust padding only

---

## Implementation Order (priority)

1. **Layout.tsx** — unblocks everything else (navigation)
2. **LeadsList.tsx** — most-used page
3. **Pipeline.tsx** — most complex
4. **WhatsAppConversations.tsx** — high daily usage
5. **LeadDetail.tsx** — per-lead workflow
6. **ActivityModal + LeadDetailModal** — used everywhere
7. **Dashboard.tsx** — informational
8. **Agenda.tsx** + Reports + Config pages — lower priority

---

## Non-goals

- No new files (no `PipelineMobile.tsx` etc.)
- No changes to business logic, scoring, or Supabase queries
- No changes to desktop layout
- No PWA / service worker (out of scope)
- Deploy after all responsive changes are complete
