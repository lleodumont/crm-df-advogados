# Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CRM DF Advogados fully usable on mobile phones using Tailwind responsive prefixes only — no new files, no logic changes.

**Architecture:** Mobile-first incremental approach. Each file gets `md:` prefixes added to existing desktop classes so desktop layout is untouched. Layout gets a top bar + slide-in drawer on mobile. Tables become card lists. Kanban gets horizontal snap-scroll. WhatsApp becomes single-pane.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Vite, Supabase

---

## Task 1: Layout — Top Bar + Drawer (Layout.tsx)

**Files:**
- Modify: `src/components/Layout.tsx`

The current sidebar is always visible. On mobile it must hide and be replaced by a fixed top bar (h-16) with hamburger that opens a slide-over drawer.

- [ ] **Step 1: Replace Layout.tsx return JSX**

Replace the entire `return (...)` block (lines 95–194) with:

```tsx
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── MOBILE TOP BAR ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <Scale className="w-6 h-6" />
          <span className="font-bold text-base">DF Advogados</span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR (desktop always visible, mobile slide-in drawer) ── */}
      <aside
        className={`fixed top-0 left-0 h-full bg-slate-900 text-white z-50 transition-all duration-300
          md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-64 md:w-auto
          ${!sidebarOpen ? 'md:w-20' : 'md:w-64'}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <Scale className="w-8 h-8" />
                <div>
                  <h1 className="font-bold text-lg">DF Advogados</h1>
                  <p className="text-xs text-slate-400">Funil de vendas</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-slate-800 rounded transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 hover:bg-slate-800 rounded transition-colors mx-auto"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = window.location.pathname === item.href;
            const isLeads = item.href === '/leads';

            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                {isLeads && staleLeadsCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {staleLeadsCount > 9 ? '9+' : staleLeadsCount}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          {sidebarOpen ? (
            <div className="mb-3">
              <div className="text-sm font-medium text-white">{profile?.full_name || profile?.email}</div>
              <div className="text-xs text-slate-400 capitalize">{profile?.role}</div>
            </div>
          ) : null}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors w-full"
            title={!sidebarOpen ? 'Sair' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main
        className={`transition-all duration-300 pt-16 md:pt-0
          md:${sidebarOpen ? 'ml-64' : 'ml-20'}
        `}
      >
        {staleLeadsCount > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2 flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span><strong>{staleLeadsCount} lead{staleLeadsCount > 1 ? 's' : ''} estratégico{staleLeadsCount > 1 ? 's' : ''}</strong> sem atividade há mais de 24h</span>
            <a href="/leads?stale=true" className="ml-auto text-amber-700 underline font-medium whitespace-nowrap">Ver agora</a>
          </div>
        )}
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
```

- [ ] **Step 2: Fix the `md:${...}` dynamic class issue**

Tailwind doesn't support dynamic class strings with template literals inside `md:`. Replace the `<main>` className with a proper conditional:

```tsx
      <main
        className={`transition-all duration-300 pt-16 md:pt-0 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-20'
        }`}
      >
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat(mobile): top bar + slide-in drawer navigation"
```

---

## Task 2: LeadsList — Cards on Mobile

**Files:**
- Modify: `src/pages/LeadsList.tsx`

The table is desktop-only. On mobile show a card list instead.

- [ ] **Step 1: Wrap the table with a `hidden md:block` div**

Find the line:
```tsx
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
```

Wrap from that outer `<div className="bg-white rounded-lg shadow">` to its closing `</div>` (end of the component) with:
```tsx
<div className="hidden md:block">
  {/* existing table block */}
</div>
```

- [ ] **Step 2: Add mobile card list before the table wrapper**

After the filter panel closing `</div>` (line ~687) and before the table wrapper `<div className="bg-white rounded-lg shadow">`, add:

```tsx
      {/* ── MOBILE: card list ── */}
      <div className="md:hidden space-y-3">
        {leads.map((lead) => {
          const classMap: Record<string, string> = {
            estrategico: 'bg-purple-100 text-purple-800',
            qualificado: 'bg-blue-100 text-blue-800',
            morno: 'bg-yellow-100 text-yellow-800',
          };
          const classBadge = classMap[lead.classification || ''] || 'bg-gray-100 text-gray-600';
          return (
            <a
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="block bg-white rounded-xl shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{lead.full_name || '—'}</p>
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={e => e.stopPropagation()}
                      className="text-sm text-blue-600 mt-0.5 block"
                    >
                      {lead.phone}
                    </a>
                  )}
                </div>
                <span className="text-lg font-bold text-gray-700 flex-shrink-0">{lead.score_total ?? 0}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {lead.classification && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classBadge}`}>
                    {lead.classification === 'estrategico' ? 'Super qualificado' : lead.classification === 'qualificado' ? 'Qualificado' : 'Morno'}
                  </span>
                )}
                {lead.status && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                    {lead.status}
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </a>
          );
        })}
        {leads.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-10">Nenhum lead encontrado</p>
        )}
      </div>
```

- [ ] **Step 3: Make the header responsive**

Find:
```tsx
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
```

Replace with:
```tsx
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-3xl font-bold text-gray-900">Leads</h1>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/LeadsList.tsx
git commit -m "feat(mobile): leads list card view on mobile"
```

---

## Task 3: Pipeline Kanban — Horizontal Snap Scroll + Tap-to-Move

**Files:**
- Modify: `src/pages/Pipeline.tsx`

- [ ] **Step 1: Find the kanban board container**

Search for the div that wraps all stage columns. It will look like:
```tsx
<div className="flex gap-4 ...">
```
or similar. Find the line that renders the stage columns in a flex row.

- [ ] **Step 2: Make board snap-scrollable on mobile**

Change the kanban board container className to add mobile snap scroll. Find the outer board div (search for `overflow-x` or the flex container of columns) and add:

```
flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4
```

- [ ] **Step 3: Make each column snap-center on mobile**

Each column div should become `snap-center flex-shrink-0 w-[85vw] md:w-72`. Find the column wrapper (likely `w-72` or similar) and update it.

- [ ] **Step 4: Add "Mover para etapa" in the action menu on mobile**

In the card action menu (the `showActionMenu` dropdown), add a mobile-only "Mover para etapa" option. Find where `showActionMenu === lead.id` renders the action menu, and add inside it:

```tsx
<div className="md:hidden border-t border-gray-100 mt-1 pt-1">
  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">Mover para</p>
  {stages.map(s => (
    s.stage_key !== lead.stage_key && (
      <button
        key={s.id}
        onClick={() => { handleMoveToStage(lead.id, s.stage_key); setShowActionMenu(null); }}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
        {s.name}
      </button>
    )
  ))}
</div>
```

Note: `handleMoveToStage` must accept `(leadId: string, stageKey: string)` — check the existing drag-drop handler and extract or reuse it. In Pipeline.tsx the drop handler updates `lead.stage_key`. Create a helper:

```tsx
const handleMoveToStage = async (leadId: string, stageKey: string) => {
  const { error } = await supabase
    .from('leads')
    .update({ stage_key: stageKey })
    .eq('id', leadId);
  if (!error) loadLeads();
};
```

Add this function alongside the other handlers in Pipeline.tsx.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Pipeline.tsx
git commit -m "feat(mobile): kanban snap-scroll + tap-to-move on mobile"
```

---

## Task 4: WhatsApp Conversations — Single-Pane Navigation

**Files:**
- Modify: `src/pages/WhatsAppConversations.tsx`

Current layout: `<div className="flex bg-white ..." style={{ height: 'calc(100vh - 112px)' }}>` with left column `w-80` and right column `flex-1`.

- [ ] **Step 1: Make the two-panel wrapper responsive**

Find line 542:
```tsx
    <div className="flex bg-white rounded-xl shadow-sm border border-gray-100" style={{ height: 'calc(100vh - 112px)' }}>
```

Replace with:
```tsx
    <div className="flex bg-white rounded-xl shadow-sm border border-gray-100" style={{ height: 'calc(100vh - 112px)' }}>
```
(no change to this line — the child columns handle visibility)

- [ ] **Step 2: Make the left column hide on mobile when a conversation is open**

Find line 545:
```tsx
      <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col">
```

Replace with:
```tsx
      <div className={`flex-shrink-0 border-r border-gray-100 flex flex-col w-full md:w-80 ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
```

- [ ] **Step 3: Add a back button at the top of the chat panel on mobile**

Find the right-side chat panel. It will be something like:
```tsx
      <div className="flex-1 flex flex-col min-w-0">
```

Replace with:
```tsx
      <div className={`flex-1 flex flex-col min-w-0 ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
```

Then add a back button as the first child of this div, visible only on mobile:
```tsx
        {/* Mobile back button */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <button
            onClick={() => setSelectedConversation(null)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Conversas
          </button>
          {selectedConversation && (
            <span className="font-semibold text-gray-900 ml-1 truncate">{selectedConversation.lead_name}</span>
          )}
        </div>
```

- [ ] **Step 4: Fix height on mobile**

The `style={{ height: 'calc(100vh - 112px)' }}` assumes desktop top offset. On mobile the top bar is 64px (h-16) plus any stale banner. Wrap the height calculation:

Find the outer container and update to use a CSS class approach:
```tsx
    <div
      className="flex bg-white rounded-xl shadow-sm border border-gray-100"
      style={{ height: 'calc(100vh - 112px)' }}
    >
```
Leave the height as-is — it works reasonably on mobile too since `pt-16` is applied at the `main` level.

- [ ] **Step 5: Commit**

```bash
git add src/pages/WhatsAppConversations.tsx
git commit -m "feat(mobile): whatsapp single-pane navigation on mobile"
```

---

## Task 5: LeadDetail — Responsive Layout

**Files:**
- Modify: `src/pages/LeadDetail.tsx`

- [ ] **Step 1: Make the header info block stack on mobile**

Find the lead header area. It typically has a flex row with name, score, tags, and action buttons. Search for `<h1` or the lead name display and add `flex-col md:flex-row` to the containing flex div.

Find the pattern like:
```tsx
<div className="flex items-start justify-between gap-4">
```

Add `flex-col md:flex-row` to it:
```tsx
<div className="flex flex-col md:flex-row items-start md:justify-between gap-4">
```

- [ ] **Step 2: Make tab bar scroll horizontally**

Find the tabs container. It will look like:
```tsx
<div className="flex border-b border-gray-200 ...">
```

Replace with:
```tsx
<div className="flex border-b border-gray-200 overflow-x-auto whitespace-nowrap scrollbar-none">
```

- [ ] **Step 3: Reduce padding on mobile**

Find the outer wrapper `<div className="space-y-6">` or similar and ensure it has `p-0` (padding is handled by Layout). Find any inner containers with large padding like `p-6` and add `p-4 md:p-6`.

- [ ] **Step 4: Make page title smaller on mobile**

Find `<h1 className="text-3xl` (or similar large heading) and add `text-xl md:text-3xl`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LeadDetail.tsx
git commit -m "feat(mobile): lead detail responsive layout"
```

---

## Task 6: Modals — Full-Screen on Mobile

**Files:**
- Modify: `src/components/ActivityModal.tsx`
- Modify: `src/components/LeadDetailModal.tsx`

- [ ] **Step 1: ActivityModal — make full-screen on mobile**

Find line 146 in ActivityModal.tsx:
```tsx
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
```

Replace with:
```tsx
      <div className="bg-white md:rounded-2xl shadow-xl w-full md:max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-full md:h-auto md:max-h-[90vh]" onClick={e => e.stopPropagation()}>
```

Also update the outer backdrop div on line 145:
```tsx
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] md:p-4 animate-in fade-in duration-200" onClick={onClose}>
```

- [ ] **Step 2: LeadDetailModal — find and update the modal container**

In LeadDetailModal.tsx, find the outer modal container div (similar pattern — `fixed inset-0` backdrop + inner white div). Apply same treatment:
- Outer: `items-end md:items-center`
- Inner white div: `md:rounded-2xl w-full md:max-w-4xl h-[90vh] md:h-auto md:max-h-[90vh]`

- [ ] **Step 3: Commit**

```bash
git add src/components/ActivityModal.tsx src/components/LeadDetailModal.tsx
git commit -m "feat(mobile): modals full-screen on mobile"
```

---

## Task 7: Dashboard — Responsive Grid

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Make metric cards grid responsive**

In Dashboard.tsx, find the grid of metric cards. It will have classes like `grid grid-cols-3` or `grid grid-cols-4`. Change all top-level metric grids to `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.

Search for `grid-cols-` in Dashboard.tsx and update each one:
- `grid-cols-3` → `grid-cols-2 md:grid-cols-3`
- `grid-cols-4` → `grid-cols-2 md:grid-cols-4`
- `grid-cols-5` → `grid-cols-2 md:grid-cols-5`

- [ ] **Step 2: Wrap any data tables in overflow-x-auto**

Find any `<table` elements in Dashboard.tsx. Wrap each in `<div className="overflow-x-auto">`.

- [ ] **Step 3: Make the page title smaller on mobile**

Find `<h1 className="text-3xl` and replace with `<h1 className="text-xl md:text-3xl`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(mobile): dashboard responsive grid"
```

---

## Task 8: Agenda, Reports, Config Pages

**Files:**
- Modify: `src/pages/Agenda.tsx`
- Modify: `src/pages/AttendanceReport.tsx`
- Modify: `src/pages/WeeklyReport.tsx`
- Modify: `src/pages/WhatsAppSettings.tsx`
- Modify: `src/pages/Users.tsx`
- Modify: `src/pages/CustomFields.tsx`
- Modify: `src/pages/Stages.tsx`

- [ ] **Step 1: Agenda.tsx — wrap calendar in overflow-x-auto**

Find the calendar grid (likely a table or CSS grid). Wrap in `<div className="overflow-x-auto">`. Add `whitespace-nowrap` to the table if needed.

- [ ] **Step 2: AttendanceReport.tsx + WeeklyReport.tsx — responsive grids and tables**

For each file:
- Find stat grids: `grid-cols-3` or `grid-cols-4` → prefix with `grid-cols-1 md:grid-cols-3`
- Find `<table` → wrap in `<div className="overflow-x-auto">`
- Find `<h1 className="text-3xl` → `text-xl md:text-3xl`

- [ ] **Step 3: WhatsAppSettings.tsx + Users.tsx + CustomFields.tsx + Stages.tsx — tables and grids**

For each file:
- Find any `<table` → wrap in `<div className="overflow-x-auto">`
- Find `grid-cols-2` or more → prefix with `grid-cols-1 md:grid-cols-2`
- Find `flex-row` form layouts → add `flex-col md:flex-row`

- [ ] **Step 4: Commit all config pages**

```bash
git add src/pages/Agenda.tsx src/pages/AttendanceReport.tsx src/pages/WeeklyReport.tsx src/pages/WhatsAppSettings.tsx src/pages/Users.tsx src/pages/CustomFields.tsx src/pages/Stages.tsx
git commit -m "feat(mobile): responsive tables and grids for reports and config pages"
```

---

## Task 9: Build & Deploy

**Files:** none (build + deploy commands)

- [ ] **Step 1: Run the build**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Df advogados/crm-df-advogados" && npm run build
```

Expected: `dist/` folder created with no errors. If TypeScript errors appear, fix them before continuing.

- [ ] **Step 2: Check deploy command**

```bash
cat package.json | grep -E '"deploy|"preview'
```

Check if there's a deploy script. Also check for `netlify.toml`, `vercel.json`, or similar.

- [ ] **Step 3: Deploy**

If Netlify CLI:
```bash
npx netlify deploy --prod --dir=dist
```

If Vercel CLI:
```bash
npx vercel --prod
```

If no deploy script exists, confirm with user how they deploy (manual upload, CI/CD, etc).

- [ ] **Step 4: Commit plan completion note**

```bash
git add -A
git commit -m "feat(mobile): complete mobile responsiveness + deploy"
```
