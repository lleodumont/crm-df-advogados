# Regras de Negócio — CRM DF Advogados

Documento de referência para as regras de negócio implementadas no sistema.

---

## Pipeline de Leads

### Status e Transições

```
novo → triagem → qualificado → agendado → compareceu → proposta_enviada → ganho
                                        ↘ no_show   ↗
                                        → maturacao
                                        → perdido
```

| Status | Descrição |
|--------|-----------|
| `novo` | Lead recém-chegado, aguardando triagem |
| `triagem` | Em qualificação pelo atendimento |
| `qualificado` | Validado, pronto para agendar reunião |
| `agendado` | Reunião agendada, aguardando data |
| `compareceu` | Participou da reunião |
| `no_show` | Tinha reunião agendada e não compareceu |
| `proposta_enviada` | Proposta comercial apresentada |
| `ganho` | Fechou contrato |
| `perdido` | Negócio não concretizado |
| `maturacao` | Potencial futuro, sem condições de fechar agora |

### Lógica cumulativa no dashboard

Para métricas de funil, os status são cumulativos:

- **Total Agendamentos** = leads com status: `agendado`, `compareceu`, `no_show`, `proposta_enviada`, `ganho`, `perdido`
- **Compareceram** = leads com status: `compareceu`, `proposta_enviada`, `ganho`, `perdido`
- **Não Compareceram** = leads com status: `no_show`
- **Propostas** = leads com status: `proposta_enviada`, `ganho`, `perdido`

---

## Sistema de Scoring (0–100 pontos)

O score é calculado pela função PostgreSQL `calculate_lead_score(lead_id)` a cada inserção/atualização em `lead_answers`. Os valores vêm de respostas com tokens específicos.

### Pilar Decisão (0–40 pontos)

**question_key: `decisao_real`**
| Token | Pontos |
|-------|--------|
| `decidi_estruturar` | 25 |
| `quase_decidido` | 15 |
| `avaliando` | 5 |

**question_key: `prazo_real`**
| Token | Pontos |
|-------|--------|
| `ate_7_dias` | 10 |
| `ate_30_dias` | 5 |
| `sem_prazo` | 0 |

**question_key: `autonomia_real`**
| Token | Pontos |
|-------|--------|
| `decido_sozinho` | 5 |
| `preciso_alinhar` | 3 |
| `nao_sei` | 1 |

### Pilar Urgência (0–30 pontos, cap 30)

**question_key: `urgencia_real`** (urgência declarada)
| Token | Pontos |
|-------|--------|
| `alta` | 30 |
| `media` | 15 |
| `baixa` | 5 |

**question_key: `urgency_now`** (situação de risco — múltipla seleção, separada por vírgula)
| Token | Pontos adicionais |
|-------|------------------|
| `ja_existe_processo` | +15 |
| `ameaca_processo` | +10 |
| `conflito_bens` | +8 |
| `disputa_filhos` | +8 |
| `organizar_com_calma` | 0 |

**question_key: `risk_15d`** (risco nos próximos 15 dias)
| Token | Pontos adicionais |
|-------|------------------|
| `sim` | +10 |
| `talvez` | +5 |

### Pilar Patrimônio (0–25 pontos)

**question_key: `valor_bens_real`** (ou `assets_range` como fallback)
| Token | Pontos |
|-------|--------|
| `acima_1m`, `acima_5m`, `1m_5m` | 25 |
| `500k_1m` | 18 |
| `200k_500k`, `100k_500k` | 10 |
| `ate_200k`, `abaixo_100k` | 4 |

> O tipo de bens (`tipo_bens_real`) é registrado para contexto da negociação mas **não impacta o score**.

### Pilar Fit (0–5 pontos)

**question_key: `offer_fit`**
| Token | Pontos |
|-------|--------|
| `conducao_completa` | 5 |
| `nao_sei` | 2 |
| outros | 0 |

### Classificação Final

| Score | Classificação | Prioridade |
|-------|--------------|------------|
| ≥ 70 | `estrategico` | Máxima — contato em até 1h |
| 40–69 | `qualificado` | Regular — acompanhar ativamente |
| < 40 | `morno` | Baixa — contato esporádico |

---

## Perguntas de Validação ("Validar Lead")

Preenchidas pelo atendimento durante a triagem. Sobrescrevem as respostas do formulário Meta para recálculo do score.

| Campo no form | question_key salvo | Tipo |
|---------------|-------------------|------|
| Decisão real | `decisao_real` | Select (token) |
| Urgência real | `urgencia_real` | Select (token) |
| Prazo | `prazo_real` | Select (token) |
| Autonomia | `autonomia_real` | Select (token) |
| Situação de risco | `urgency_now` | Select (token) |
| Risco 15 dias | `risk_15d` | Select (token) |
| Faixa de valor dos bens | `valor_bens_real` | Select (token) |
| Tipo de bens | `tipo_bens_real` | Checkboxes (tokens separados por vírgula) |
| Fit da oferta | `offer_fit` | Select (token) |

> **Importante:** Os selects devem ter o `value` com o token exato (ex: `decidi_estruturar`), não o rótulo legível. Caso contrário, o `has_token()` do banco não reconhece a resposta e o score fica 0.

---

## Permissões por Role

| Ação | admin | comercial | atendimento | viewer |
|------|-------|-----------|-------------|--------|
| Criar/editar leads | ✓ | ✓ | ✓ | — |
| Validar lead (scoring) | ✓ | ✓ | ✓ | — |
| Ver valores de propostas | ✓ | ✓ | — | — |
| Criar propostas | ✓ | ✓ | — | — |
| Gerenciar usuários | ✓ | — | — | — |
| Ver dashboard e relatórios | ✓ | ✓ | ✓ | ✓ |
| Agendar reuniões | ✓ | ✓ | ✓ | — |

---

## Integração WhatsApp (UazAPI)

- Mensagens enviadas via Edge Function `whatsapp-send`
- Instâncias gerenciadas via `whatsapp-manager`
- Webhooks de entrada processados por `whatsapp-webhook`
- Follow-ups automáticos agendados via `followup-scheduler`

---

## Lead Time (Marcos)

Campos registrados automaticamente por triggers no banco:

| Campo | Quando é definido |
|-------|------------------|
| `created_at` | Criação do lead |
| `first_meeting_scheduled_at` | Primeira reunião agendada |
| `proposal_presented_at` | Primeira proposta criada |
| `closed_at` | Proposta marcada como ganha ou perdida |

---

## Recálculo de Score

Para recalcular manualmente o score de um lead (ex: após corrigir respostas):

```sql
SELECT calculate_lead_score('uuid-do-lead');
```

Para recalcular todos os leads com respostas:

```sql
SELECT calculate_lead_score(id) FROM leads WHERE id IN (
  SELECT DISTINCT lead_id FROM lead_answers
);
```
