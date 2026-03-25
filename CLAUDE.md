# CLAUDE.md — Instruções para desenvolvimento assistido por IA

## Sobre o projeto

CRM para escritório de advocacia especializado em divórcio (DF Advogados). Foco em gestão de leads captados via Meta Ads, scoring automático e pipeline comercial.

**Stack:** React 18 + TypeScript + Vite + TailwindCSS + Supabase (PostgreSQL + Auth + RLS + Edge Functions)

---

## Regras críticas de negócio

Antes de alterar qualquer lógica de score ou pipeline, leia `BUSINESS_RULES.md`.

### Tokens de scoring
Os selects do formulário "Validar Lead" DEVEM ter `value` com tokens exatos (ex: `decidi_estruturar`, não `"Sim, já estou decidido"`). A função `has_token()` do banco só reconhece os tokens — salvar rótulos quebra o score silenciosamente.

### Tokens válidos por pilar
- **Decisão** (`decisao_real`): `decidi_estruturar`, `quase_decidido`, `avaliando`
- **Urgência** (`urgencia_real`): `alta`, `media`, `baixa`
- **Prazo** (`prazo_real`): `ate_7_dias`, `ate_30_dias`, `sem_prazo`
- **Autonomia** (`autonomia_real`): `decido_sozinho`, `preciso_alinhar`, `nao_sei`
- **Patrimônio** (`valor_bens_real`): `acima_1m`, `500k_1m`, `200k_500k`, `ate_200k`
- **Fit** (`offer_fit`): `conducao_completa`, `nao_sei`

### Tipo de bens NÃO impacta score
O campo `tipo_bens_real` é registrado para contexto da negociação apenas. Não adicione lógica de pontuação baseada nele.

---

## Arquitetura de filtros (URL params)

A `LeadsList` lê filtros via URL params para integração com o dashboard:

| Param | Tipo | Descrição |
|-------|------|-----------|
| `status` | string | Status único |
| `statuses` | string | Múltiplos status separados por vírgula |
| `classification` | string | `morno`, `qualificado`, `estrategico` |
| `scoreMin` | number | Score mínimo (0 = sem filtro) |
| `scoreMax` | number | Score máximo (100 = sem filtro) |
| `today` | boolean | Apenas leads de hoje |
| `stale` | boolean | Leads sem atividade recente |

**Importante:** `classification=qualificado` deve filtrar `qualificado` E `estrategico` — porque o dashboard agrupa os dois como "qualificados".

---

## CSS — overflow e dropdowns

Nunca adicione `overflow-hidden` em containers que contêm dropdowns/selects absolutamente posicionados. Isso corta os menus. Use `overflow-visible` (padrão) nesses casos.

---

## Supabase

- **Projeto:** `gknevfldmvtnjluotdmf`
- **Migrations:** `supabase/migrations/` — sempre crie nova migration em vez de editar existentes
- **Nunca altere** a função `calculate_lead_score` diretamente no painel — crie uma migration SQL

---

## Convenções de código

- Componentes em `src/components/` — reutilizáveis
- Páginas em `src/pages/` — uma por rota
- Tipos globais em `src/lib/database.types.ts` — gerado pelo Supabase, não edite manualmente além dos tipos customizados
- Estado de loading: use `useState(true)` e `setLoading(false)` no finally
- Erros: `console.error` + `alert` para erros de usuário (padrão atual do projeto)

---

## O que NÃO fazer

- Não adicione "Defesa do Homem" como opção em nenhum lugar — foi removido por decisão de negócio
- Não use a tabela `meetings` para calcular métricas de dashboard — use o campo `status` do lead
- Não commite o arquivo `.env` (contém credenciais reais)
- Não edite `supabase/migrations/` já aplicadas — crie nova migration
