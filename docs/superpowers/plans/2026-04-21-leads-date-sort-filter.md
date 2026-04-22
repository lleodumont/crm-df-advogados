# Leads Date Sort & Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar atalhos de período rápido (Hoje / 7 dias / 30 dias / Este mês) sempre visíveis acima da tabela e ordenação clicável na coluna "Data" da `LeadsList`.

**Architecture:** Toda a mudança é confinada a `src/pages/LeadsList.tsx`. Três estados novos controlam período ativo e ordenação; a query do Supabase usa esses estados para ordenar; a barra de atalhos fica entre o bloco de filtros e a tabela.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Supabase JS client, lucide-react (ícone `ArrowUpDown`, `ArrowUp`, `ArrowDown` para sort).

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/LeadsList.tsx` | +3 estados, handler de sort, barra de atalhos, cabeçalho "Data" clicável, query de ordenação condicional |

---

## Task 1: Adicionar ícones de sort e os três estados novos

**Files:**
- Modify: `src/pages/LeadsList.tsx:3` (import lucide)
- Modify: `src/pages/LeadsList.tsx:55-71` (bloco de estados do componente)

- [ ] **Step 1: Adicionar ícones ao import do lucide-react**

Na linha 3, substituir:
```ts
import { Search, Filter, Plus, Phone, Mail, TrendingUp, ChevronDown, Tag as TagIcon, X } from 'lucide-react';
```
por:
```ts
import { Search, Filter, Plus, Phone, Mail, TrendingUp, ChevronDown, Tag as TagIcon, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
```

- [ ] **Step 2: Adicionar os três estados após a declaração de `multiStatuses` (~linha 71)**

Após o bloco:
```ts
  const [multiStatuses, setMultiStatuses] = useState<string[] | null>(() => {
    const val = new URLSearchParams(window.location.search).get('statuses');
    return val ? val.split(',') : null;
  });
```

Inserir:
```ts
  const [activePeriod, setActivePeriod] = useState<'today' | '7days' | '30days' | 'month' | null>(null);
  const [sortField, setSortField] = useState<'default' | 'created_at'>('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
```

- [ ] **Step 3: Verificar que o TypeScript compila sem erros**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Rafael Haddad/crm-rafael-haddad"
npx tsc --noEmit
```
Esperado: sem erros relacionados aos novos estados.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LeadsList.tsx
git commit -m "feat: add sort and period state to LeadsList"
```

---

## Task 2: Atualizar a query de `loadLeads` para respeitar sort

**Files:**
- Modify: `src/pages/LeadsList.tsx:120-122` (useEffect de loadLeads)
- Modify: `src/pages/LeadsList.tsx:239` (linha do `.order()` fixo)

- [ ] **Step 1: Substituir o `.order()` fixo na query (linha 239)**

Localizar:
```ts
      const { data: leadsData, error } = await query.order('score_total', { ascending: false }).order('created_at', { ascending: false });
```

Substituir por:
```ts
      if (sortField === 'created_at') {
        query = query.order('created_at', { ascending: sortDirection === 'asc' });
      } else {
        query = query.order('score_total', { ascending: false }).order('created_at', { ascending: false });
      }
      const { data: leadsData, error } = await query;
```

- [ ] **Step 2: Adicionar `sortField` e `sortDirection` às dependências do useEffect**

Localizar (linha 120-122):
```ts
  useEffect(() => {
    loadLeads();
  }, [filters, staleLeadIds, multiStatuses]);
```

Substituir por:
```ts
  useEffect(() => {
    loadLeads();
  }, [filters, staleLeadIds, multiStatuses, sortField, sortDirection]);
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LeadsList.tsx
git commit -m "feat: conditional sort order in loadLeads query"
```

---

## Task 3: Adicionar o handler de clique para ordenação da coluna Data

**Files:**
- Modify: `src/pages/LeadsList.tsx` — adicionar função `handleDateSortClick` após `loadUsers`

- [ ] **Step 1: Adicionar a função `handleDateSortClick` antes de `getClassificationColor`**

Localizar a função `getClassificationColor` (~linha 337) e inserir antes dela:
```ts
  const handleDateSortClick = () => {
    if (sortField !== 'created_at') {
      setSortField('created_at');
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection('asc');
    } else {
      setSortField('default');
      setSortDirection('desc');
    }
  };
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LeadsList.tsx
git commit -m "feat: add handleDateSortClick handler"
```

---

## Task 4: Tornar o cabeçalho "Data" clicável com ícone de sort

**Files:**
- Modify: `src/pages/LeadsList.tsx:667-669` (th da coluna Data)

- [ ] **Step 1: Substituir o `<th>` estático da coluna "Data"**

Localizar:
```tsx
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
```

Substituir por:
```tsx
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors"
                onClick={handleDateSortClick}
              >
                <span className="flex items-center gap-1">
                  Data
                  {sortField !== 'created_at' && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  {sortField === 'created_at' && sortDirection === 'desc' && <ArrowDown className="w-3 h-3 text-blue-600" />}
                  {sortField === 'created_at' && sortDirection === 'asc' && <ArrowUp className="w-3 h-3 text-blue-600" />}
                </span>
              </th>
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Testar manualmente no browser**

```bash
npm run dev
```

Abrir `http://localhost:5173/leads`. Clicar no cabeçalho "Data":
- 1º clique: seta ↓ aparece, tabela reordena (mais recente primeiro)
- 2º clique: seta ↑ aparece, tabela reordena (mais antigo primeiro)
- 3º clique: ícone cinza `⇅` volta, tabela volta à ordem por score

- [ ] **Step 4: Commit**

```bash
git add src/pages/LeadsList.tsx
git commit -m "feat: clickable Data column header with sort indicator"
```

---

## Task 5: Adicionar helper de datas para os atalhos de período

**Files:**
- Modify: `src/pages/LeadsList.tsx` — adicionar função `applyPeriod` perto dos outros handlers

- [ ] **Step 1: Adicionar `applyPeriod` após `handleDateSortClick`**

```ts
  const applyPeriod = (period: 'today' | '7days' | '30days' | 'month' | null) => {
    setActivePeriod(period);
    if (!period) {
      setFilters(f => ({ ...f, entryDateStart: '', entryDateEnd: '' }));
      return;
    }
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const end = fmt(today);
    let start: string;
    if (period === 'today') {
      start = end;
    } else if (period === '7days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      start = fmt(d);
    } else if (period === '30days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      start = fmt(d);
    } else {
      start = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
    }
    setFilters(f => ({ ...f, entryDateStart: start, entryDateEnd: end }));
  };
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LeadsList.tsx
git commit -m "feat: add applyPeriod helper for date shortcuts"
```

---

## Task 6: Sincronizar `activePeriod` ao editar De/Até manualmente

**Files:**
- Modify: `src/pages/LeadsList.tsx:549-563` (inputs De/Até no painel de filtros)

- [ ] **Step 1: Atualizar os dois `onChange` dos inputs de data de entrada no painel Filtros**

Localizar o input "Data de Entrada (De)":
```tsx
                onChange={(e) => setFilters({ ...filters, entryDateStart: e.target.value })}
```
Substituir por:
```tsx
                onChange={(e) => { setFilters({ ...filters, entryDateStart: e.target.value }); setActivePeriod(null); }}
```

Localizar o input "Data de Entrada (Até)":
```tsx
                onChange={(e) => setFilters({ ...filters, entryDateEnd: e.target.value })}
```
Substituir por:
```tsx
                onChange={(e) => { setFilters({ ...filters, entryDateEnd: e.target.value }); setActivePeriod(null); }}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LeadsList.tsx
git commit -m "feat: clear activePeriod on manual date input change"
```

---

## Task 7: Adicionar a barra de atalhos de período acima da tabela

**Files:**
- Modify: `src/pages/LeadsList.tsx:642-644` (entre fim do bloco de filtros e a tabela)

- [ ] **Step 1: Inserir a barra de atalhos entre `</div>` do bloco de filtros e o `<div className="bg-white rounded-lg shadow">`**

Localizar (linha ~642-644):
```tsx
      </div>

      <div className="bg-white rounded-lg shadow">
```

Substituir por:
```tsx
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(['today', '7days', '30days', 'month'] as const).map((period) => {
          const labels: Record<string, string> = {
            today: 'Hoje',
            '7days': 'Últimos 7 dias',
            '30days': 'Últimos 30 dias',
            month: 'Este mês',
          };
          const isActive = activePeriod === period;
          return (
            <button
              key={period}
              onClick={() => applyPeriod(period)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {labels[period]}
            </button>
          );
        })}
        {activePeriod && (
          <button
            onClick={() => applyPeriod(null)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 3: Testar manualmente no browser**

```bash
npm run dev
```

Abrir `http://localhost:5173/leads` e verificar:
- Barra de atalhos aparece acima da tabela (fora do painel Filtros)
- Clicar "Hoje" → botão fica azul, tabela filtra apenas leads de hoje
- Clicar "Últimos 7 dias" → muda para 7 dias, botão anterior desativa
- Clicar "Limpar" → ambas as datas são limpas, botão X some
- Abrir painel "Filtros" → campos De/Até mostram as datas definidas pelo atalho
- Editar manualmente um campo De/Até → atalho ativo é desmarcado

- [ ] **Step 4: Commit**

```bash
git add src/pages/LeadsList.tsx
git commit -m "feat: add quick period shortcut bar above leads table"
```

---

## Self-Review

**Spec coverage:**
- [x] Atalhos de período acima da tabela → Task 7
- [x] Atalhos sincronizam com campos De/Até → Tasks 5 e 6
- [x] Limpar desmarca atalho e limpa datas → Task 5 (`applyPeriod(null)`)
- [x] Editar De/Até manualmente desmarca atalho → Task 6
- [x] Coluna "Data" clicável com ciclo de 3 estados → Tasks 3 e 4
- [x] Query usa sort condicional → Task 2
- [x] `useEffect` inclui sort nas dependências → Task 2

**Placeholder scan:** Nenhum TBD ou TODO encontrado. Todos os passos têm código concreto.

**Type consistency:**
- `activePeriod`: tipo `'today' | '7days' | '30days' | 'month' | null` — consistente em todos os tasks
- `sortField`: tipo `'default' | 'created_at'` — consistente
- `sortDirection`: tipo `'asc' | 'desc'` — consistente
- `applyPeriod` chamada com `null` em Task 6 e Task 7 — tipo aceita `null` ✓
