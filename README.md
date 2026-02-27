# DF CRM – Divórcios

Sistema de CRM completo para escritório boutique de Direito de Família, focado em otimizar a captação e conversão de leads de divórcio.

## Visão Geral

O DF CRM é uma aplicação web que integra captação de leads (principalmente do Meta Ads), cálculo automático de lead scoring, gestão de pipeline comercial e análise de métricas e lead time.

### Objetivos de Negócio

1. **Reduzir reuniões improdutivas** - Filtrar leads por maturidade de decisão
2. **Aumentar taxa de fechamento** - Focar em leads qualificados
3. **Priorizar atendimento** - Score automático identifica leads estratégicos
4. **Acompanhar lead time** - Métricas de entrada até fechamento

## Stack Tecnológico

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security)
- **Icons**: Lucide React
- **Deployment**: Pronto para Vercel/Netlify

## Instalação

### Requisitos

- Node.js 18+
- Conta Supabase (já configurada)

### Setup Local

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```

3. As variáveis de ambiente já estão configuradas em `.env`:
```
VITE_SUPABASE_URL=https://gknevfldmvtnjluotdmf.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

4. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

5. Acesse `http://localhost:5173`

## Banco de Dados

O schema do banco de dados já foi criado no Supabase e inclui:

### Tabelas Principais

1. **user_profiles** - Perfis de usuários com roles (admin, atendimento, comercial, viewer)
2. **leads** - Dados principais dos leads com scoring e classificação
3. **lead_answers** - Respostas de formulários e validação humana
4. **activities** - Timeline completo de interações
5. **meetings** - Reuniões agendadas e realizadas
6. **proposals** - Propostas comerciais e resultados

### Triggers Automáticos

- Atualização de `first_meeting_scheduled_at` ao criar reunião
- Atualização de `proposal_presented_at` ao criar proposta
- Atualização de `closed_at` ao ganhar/perder proposta
- Recálculo automático de score ao inserir/atualizar respostas

### Row Level Security (RLS)

Todas as tabelas possuem RLS ativado com policies baseadas em roles:
- **Admin**: Acesso completo
- **Comercial**: Visualiza tudo, cria propostas
- **Atendimento**: Gerencia leads e reuniões
- **Viewer**: Somente leitura

## Como Funciona o Lead Scoring

O sistema calcula automaticamente um score de 0-100 baseado em 4 pilares:

### Pilar Decisão (0-40 pontos)

- **Estágio**:
  - `decidi_estruturar` = 25 pontos
  - `quase_decidido` = 15 pontos
  - `avaliando` = 5 pontos

- **Prazo**:
  - `ate_7_dias` = 10 pontos
  - `ate_30_dias` = 5 pontos
  - `sem_prazo` = 0 pontos

- **Autonomia**:
  - `decido_sozinho` = 5 pontos
  - `preciso_alinhar` = 3 pontos
  - `nao_sei` = 1 ponto

### Pilar Urgência/Risco (0-30 pontos, cap 30)

- **Urgências** (múltipla seleção, soma com cap 30):
  - `ja_existe_processo` = 15 pontos
  - `ameaca_processo` = 10 pontos
  - `conflito_bens` = 8 pontos
  - `disputa_filhos` = 8 pontos
  - `organizar_com_calma` = 0 pontos

- **Risco 15 dias**:
  - `sim` = 10 pontos
  - `talvez` = 5 pontos
  - `nao` = 0 pontos

### Pilar Patrimônio (0-25 pontos, cap 25)

- **Tipos de bens** (múltipla seleção):
  - `empresa_cotas` = 10 pontos
  - `imovel_financiado` = 7 pontos
  - `imovel_quitado` = 5 pontos
  - `investimentos` = 5 pontos
  - `veiculos` = 3 pontos
  - `sem_bens` = 0 pontos

- **Faixa de valor**:
  - `acima_1m` = 10 pontos
  - `500k_1m` = 7 pontos
  - `200k_500k` = 4 pontos
  - `ate_200k` = 2 pontos
  - `prefiro_nao_informar` = 3 pontos

### Pilar Fit Oferta (0-5 pontos)

- `conducao_completa` = 5 pontos
- `orientacao_pontual` = 0 pontos
- `nao_sei` = 2 pontos

### Classificação Final

- **0-39 pontos** = Morno (low priority)
- **40-69 pontos** = Qualificado (medium priority)
- **70-100 pontos** = Estratégico (high priority)

## Como Importar Leads do Meta Ads

### Passo 1: Exportar CSV do Meta

1. Acesse o Facebook Business Manager
2. Vá em "Formulários de Cadastro"
3. Selecione o formulário desejado
4. Clique em "Baixar" → "CSV"

### Passo 2: Importar no CRM

1. Acesse "Importar Leads" no menu
2. Selecione o arquivo CSV
3. Mapeie as colunas:
   - **Obrigatórios**: Nome Completo, Telefone
   - **Opcionais**: Email, Cidade, Estado, Campanha
   - **Perguntas do formulário**: Mapeie para as question_keys correspondentes

4. Clique em "Importar"

### Passo 3: Sistema Recalcula Score

Após importação, o sistema:
1. Cria os leads no banco
2. Insere as respostas do formulário
3. Calcula o score automaticamente
4. Define a classificação (morno/qualificado/estratégico)

## Funcionalidades Principais

### 1. Dashboard

Métricas principais:
- Total de leads por período e classificação
- Reuniões agendadas e realizadas
- Show rate (comparecimento)
- Propostas apresentadas
- Taxa de fechamento
- Receita total e ticket médio
- Receita por reunião

**Lead Time** (medianas):
- Entrada → Agendamento
- Agendamento → Proposta
- Proposta → Fechamento
- Entrada → Fechamento (ciclo completo)

Gráficos:
- Leads por dia (últimos 30 dias)
- Funil por status
- Top 5 motivos de perda

### 2. Lista de Leads

- Visualização em tabela
- Filtros avançados:
  - Status
  - Classificação
  - Score (min/max)
  - Busca por nome/telefone/email
- Ordenação por score e data
- Ações rápidas:
  - Atribuir lead
  - Mudar status
  - Ver detalhes

### 3. Pipeline Kanban

- Visualização visual do funil
- Drag & drop para mudar status
- Colunas: Novo → Triagem → Qualificado → Agendado → Compareceu → Proposta → Ganho/Perdido
- Cards mostram:
  - Nome e contato
  - Score e classificação
  - Data de entrada
  - Campanha
  - Próxima reunião

### 4. Lead Detail (Visão 360)

**Cabeçalho**:
- Score total e detalhado por pilar
- Classificação
- Status atual
- Origem e campanha
- Marcos principais (datas)

**Abas**:

1. **Timeline**:
   - Histórico completo de atividades
   - Adicionar notas
   - Respostas do formulário

2. **Validação Humana**:
   - 3 perguntas-chave para validar:
     - Decisão real (tomada vs reconciliação)
     - Urgência real (situação atual)
     - Patrimônio real (simples vs complexo)
   - Recalcula score após validação

3. **Reuniões**:
   - Agendar nova reunião
   - Lista de reuniões
   - Marcar como realizada/no-show/cancelada

4. **Propostas** (comercial/admin):
   - Criar proposta com valor e condições
   - Marcar como ganha/perdida
   - Registrar motivo de perda

### 5. Relatório Semanal

Relatório automático em texto com:
- Resumo executivo do período
- Visão geral de leads
- Desempenho de reuniões
- Resultados de propostas
- Funil de conversão
- **Gargalo principal** (etapa com maior queda)
- **3 ações recomendadas** (geradas automaticamente)

## Perfis e Permissões

### Admin
- Acesso completo
- Gerencia usuários
- Visualiza tudo
- Cria propostas

### Comercial (Advogada/Closer)
- Visualiza todos os leads
- Cria e gerencia propostas
- Registra fechamentos
- Acessa valores

### Atendimento (SDR)
- Cria e edita leads
- Registra triagem
- Agenda reuniões
- Registra atividades
- Não vê valores de proposta (opcional)

### Viewer
- Somente leitura
- Acessa dashboard e relatórios
- Não modifica dados

## Fluxo de Trabalho Recomendado

### 1. Captação (Meta Ads)
- Lead preenche formulário no Meta
- Exportar CSV semanalmente
- Importar no CRM

### 2. Triagem (Atendimento)
- Revisar leads novos
- Contato inicial via WhatsApp
- Validação humana (3 perguntas)
- Sistema recalcula score

### 3. Qualificação
- Leads "estratégicos" e "qualificados" → prioridade
- Leads "mornos" → maturação (não ocupam agenda)
- Agendar reunião para qualificados

### 4. Reunião (Comercial)
- Confirmar presença 24h antes
- Realizar reunião
- Marcar status (held/no_show)

### 5. Proposta (Comercial)
- Criar proposta com valor
- Apresentar condições
- Registrar data de apresentação

### 6. Fechamento
- Marcar proposta como won/lost
- Se lost, registrar motivo
- Sistema atualiza automaticamente os marcos

### 7. Análise
- Dashboard para acompanhamento diário
- Relatório semanal para reuniões de equipe
- Identificar gargalos e otimizar processo

## Métricas Importantes

### Taxa de Conversão Esperada

- Lead → Agendamento: ~20-30%
- Agendamento → Compareceu: ~60-70% (show rate)
- Compareceu → Proposta: ~50-70%
- Proposta → Fechamento: ~30-40%

### Lead Time Ideal

- Entrada → Agendamento: 2-5 dias
- Agendamento → Proposta: 0-1 dia (na reunião)
- Proposta → Fechamento: 3-7 dias
- Entrada → Fechamento: 7-14 dias

## Build e Deploy

### Build de Produção

```bash
npm run build
```

### Deploy (Vercel)

1. Conecte o repositório no Vercel
2. Configure as variáveis de ambiente
3. Deploy automático

### Deploy (Netlify)

1. Conecte o repositório no Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Configure as variáveis de ambiente

## Suporte e Manutenção

### Backup de Dados

O Supabase faz backup automático. Para backup manual:
1. Acesse o painel do Supabase
2. Database → Backups
3. Baixe o backup

### Adicionar Novo Usuário

1. Criar usuário no Supabase Auth
2. Inserir registro em `user_profiles`:
```sql
INSERT INTO user_profiles (id, email, full_name, role)
VALUES ('user-uuid', 'email@example.com', 'Nome', 'atendimento');
```

### Ajustar Regras de Scoring

Edite a função `calculate_lead_score` no Supabase:
1. Database → Functions
2. Localize `calculate_lead_score`
3. Ajuste os valores de pontuação
4. Salve

## Troubleshooting

### Score não atualiza
- Verifique se as respostas foram salvas em `lead_answers`
- Execute manualmente: `SELECT calculate_lead_score('lead-id')`

### RLS bloqueia acesso
- Verifique o role do usuário em `user_profiles`
- Admin tem acesso total, outros roles têm restrições

### Leads não aparecem na lista
- Verifique se o usuário tem permissão (RLS)
- Verifique filtros aplicados

## Roadmap Futuro

- [ ] Integração direta com API do Meta Ads
- [ ] WhatsApp Web integrado
- [ ] Automação de follow-up por email/SMS
- [ ] Relatórios personalizados
- [ ] Previsão de fechamento com ML
- [ ] Integração com calendário (Google Calendar)
- [ ] Notificações push

## Licença

Proprietary - Uso exclusivo do escritório de Direito de Família.

## Contato

Para suporte técnico ou dúvidas sobre o sistema, consulte a documentação interna.
