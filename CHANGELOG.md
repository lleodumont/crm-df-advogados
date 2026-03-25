# Changelog

## [Unreleased]

### Changed
- Tipo de bens removido do cálculo de score — registrado apenas para contexto da negociação
- Faixas de valor dos bens recalibradas: acima_1m=25, 500k_1m=18, 200k_500k=10, ate_200k=4
- Campo `tipo_bens_real` convertido de texto livre para checkboxes no formulário "Validar Lead"

### Fixed
- Selects em "Validar Lead" agora salvam tokens corretos (ex: `decidi_estruturar`) em vez de rótulos legíveis, corrigindo scores que ficavam em 0
- Dropdowns de role não são mais cortados pelo `overflow-hidden` nas tabelas de Usuários e Lista de Leads
- Filtro "Qualificados" no dashboard agora inclui leads `estrategico` além de `qualificado`
- Leads com `score_total = null` não são mais excluídos pela lista ao limpar filtros
- Parâmetro `scoreMin` agora é resetado ao clicar em "Limpar filtro"

## 2026-03-22

### Added
- Status `no_show` adicionado ao pipeline de leads
- Estágio "Não Compareceu" adicionado ao pipeline visual
- Métricas do dashboard agora usam status do lead (não tabela de reuniões) para consistência
- Contagem real de "leads quentes" no bloco de Insights de IA (era hardcoded em 12)
- Filtro por múltiplos status via `?statuses=` na URL (ex: `?statuses=compareceu,proposta_enviada`)

### Changed
- Seção "Bens e Patrimônio" removida do formulário "Editar Contato" — pertence apenas a "Validar Lead"
- "Defesa do Homem" removido de todas as listagens de respostas e opções do CRM

## 2026-03-17

### Added
- Busca full-text em leads
- Scoring comportamental

## 2026-03-09

### Fixed
- Correções no scoring e sincronização de atividades

## 2026-03-08

### Added
- Tags e estágios customizados no pipeline
- Categorias de motivo de perda
- Permissão para admins deletarem estágios de pipeline

## 2026-02-27

### Added
- Integração WhatsApp via UazAPI (send, webhook, manager, followup-scheduler)

## 2026-02-25

### Added
- Schema inicial do banco de dados (leads, user_profiles, lead_answers, activities, meetings, proposals)
- Autenticação e RLS por role
- Edge Function `receive-lead` para receber leads do Meta Ads
- Campos UTM e family_income_range nos leads
