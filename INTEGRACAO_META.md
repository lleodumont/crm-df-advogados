# Integração com Meta Ads

Leads do Meta Lead Ads chegam automaticamente via webhook direto para a Edge Function `receive-lead`.

## URL do Webhook

Configure esta URL no Meta Business Suite → Formulários de Cadastro → Webhooks:

```
https://gknevfldmvtnjluotdmf.supabase.co/functions/v1/receive-lead
```

## Formato do Payload

```json
{
  "full_name": "João Silva",
  "phone": "11999999999",
  "email": "joao@email.com",
  "city": "Brasília",
  "state": "DF",
  "source": "meta_ads",
  "campaign": "Divórcio - Março 2026",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "divorcio_mar_2026",
  "utm_content": "video_beneficios",
  "campaign_id": "120210000000000",
  "adset_id": "120210000000001",
  "ad_id": "120210000000002",
  "form_responses": [
    { "question": "decidido_divorcio", "answer": "sim" },
    { "question": "nivel_urgencia", "answer": "alta" },
    { "question": "possui_bens", "answer": "sim" },
    { "question": "valor_dos_bens", "answer": "500000" }
  ]
}
```

### Campos obrigatórios
- `full_name`: Nome completo
- `phone`: Telefone com DDD (sem formatação)

### Campos opcionais de qualificação

| Campo | Valores aceitos |
|-------|----------------|
| `form_responses[].question` | Qualquer string — vira `question_key` em `lead_answers` |
| `form_responses[].answer` | Qualquer string — vira `answer_value` |

> O score inicial é calculado pelo banco via trigger `calculate_lead_score` após inserção das respostas, não pela Edge Function.

## Classificação Automática

Após a inserção, o trigger do banco recalcula o score e define a classificação:

| Score | Classificação |
|-------|---------------|
| ≥ 70 | `estrategico` |
| 40–69 | `qualificado` |
| < 40 | `morno` |

## Segurança

- O endpoint é público (não requer JWT) — usa `SUPABASE_SERVICE_ROLE_KEY` internamente
- Aceita apenas `POST`
- CORS habilitado para qualquer origem

## Resposta de Sucesso (201)

```json
{
  "success": true,
  "lead_id": "uuid-do-lead",
  "message": "Lead created successfully"
}
```

## Resposta de Erro

```json
{
  "error": "full_name and phone are required fields"
}
```

## Teste Manual

```bash
curl -X POST https://gknevfldmvtnjluotdmf.supabase.co/functions/v1/receive-lead \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Teste Lead",
    "phone": "61999999999",
    "source": "manual",
    "form_responses": []
  }'
```

## Logs

Acompanhe os logs da Edge Function no painel Supabase:
**Edge Functions → receive-lead → Logs**
