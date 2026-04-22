# Design: Organizar e Filtrar Leads por Data de Entrada

**Data:** 2026-04-21  
**Status:** Aprovado

---

## Contexto

A página `LeadsList` já possui filtros de data de entrada (De/Até) escondidos no painel "Filtros", mas não oferece atalhos rápidos de período nem ordenação clicável por data. O usuário quer poder filtrar e ordenar por data de entrada de forma rápida e direta.

---

## Escopo

Apenas a página `src/pages/LeadsList.tsx`. Nenhuma migration SQL, nenhuma Edge Function, nenhum novo componente separado.

---

## Design

### 1. Atalhos de período rápido

Uma barra de botões aparece entre o bloco de filtros e a tabela, sempre visível (não depende de abrir o painel "Filtros"):

```
[ Hoje ]  [ Últimos 7 dias ]  [ Últimos 30 dias ]  [ Este mês ]  [ Limpar ]
```

**Comportamento:**
- Clicar num atalho define `filters.entryDateStart` e `filters.entryDateEnd` com as datas correspondentes ao período
- O botão ativo recebe estilo destacado (fundo azul, texto branco)
- Os campos "Data de Entrada (De)" e "Data de Entrada (Até)" no painel "Filtros" ficam em sincronia — se o usuário editar manualmente qualquer um deles, o atalho ativo é desmarcado (volta a `null`)
- "Limpar" apaga ambas as datas e desmarca qualquer atalho ativo

**Estado adicional:**
```ts
const [activePeriod, setActivePeriod] = useState<'today' | '7days' | '30days' | 'month' | null>(null);
```

**Lógica dos períodos (datas em formato `YYYY-MM-DD`):**
- `Hoje`: `start = end = hoje`
- `Últimos 7 dias`: `start = hoje - 6 dias`, `end = hoje`
- `Últimos 30 dias`: `start = hoje - 29 dias`, `end = hoje`
- `Este mês`: `start = primeiro dia do mês atual`, `end = hoje`

Quando o usuário edita manualmente `entryDateStart` ou `entryDateEnd`, `setActivePeriod(null)`.

---

### 2. Ordenação clicável da coluna "Data"

O cabeçalho "Data" na tabela vira interativo com ícone de seta indicando direção.

**Ciclo de cliques:**
1. Estado padrão: sem seta → ordenação original (score DESC, created_at DESC)
2. 1º clique: `created_at` DESC (↓ mais recente primeiro)
3. 2º clique: `created_at` ASC (↑ mais antigo primeiro)
4. 3º clique: volta ao padrão

**Estado adicional:**
```ts
const [sortField, setSortField] = useState<'default' | 'created_at'>('default');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
```

**Lógica na query (dentro de `loadLeads`):**
```ts
// substitui o .order fixo atual
if (sortField === 'default') {
  query = query.order('score_total', { ascending: false }).order('created_at', { ascending: false });
} else {
  query = query.order('created_at', { ascending: sortDirection === 'asc' });
}
```

**Handler de clique no cabeçalho:**
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

O `useEffect` que chama `loadLeads` já depende de `filters` — adicionar `sortField` e `sortDirection` às dependências garante que a query re-execute ao mudar a ordenação.

---

## O que não muda

- Os campos De/Até dentro do painel "Filtros" continuam existindo para intervalos personalizados
- O comportamento padrão de ordenação (score DESC) é preservado enquanto o usuário não clicar em "Data"
- Nenhuma outra coluna ganha ordenação — apenas "Data"
- Nenhuma migration SQL necessária

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/LeadsList.tsx` | Adiciona estados `activePeriod`, `sortField`, `sortDirection`; barra de atalhos; cabeçalho "Data" clicável; lógica de sort na query |
