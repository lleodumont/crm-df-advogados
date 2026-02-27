# Integração com Meta Ads - Importação de Leads

Este documento explica como integrar o CRM com o Meta Ads para receber leads automaticamente.

## 🔗 URL do Webhook

Configure esta URL no Meta Business Suite:

```
https://[seu-projeto].supabase.co/functions/v1/meta-webhook
```

## 📋 Formato do Payload

O webhook aceita o seguinte formato de dados:

```json
{
  "nome": "João Silva",
  "telefone": "11999999999",
  "decidido_divorcio": "sim",
  "esta_separado": "sim",
  "possui_bens": "sim",
  "possui_filhos_pequenos": "nao",
  "nivel_urgencia": "alta",
  "valor_dos_bens": "500000",
  "divorcio_formalizado": "nao",
  "utm_campaign": "divorcio-2024",
  "utm_medium": "cpc",
  "utm_source": "facebook",
  "utm_content": "anuncio-a",
  "campaign-id": "123456789",
  "ad-id": "987654321",
  "groud-id": "456789123"
}
```

## 📊 Campos e Mapeamento

### Campos Obrigatórios
- `nome`: Nome completo do lead
- `telefone`: Telefone com DDD

### Campos de Qualificação (Opcionais)

| Campo Meta | Valores Aceitos | Mapeamento no Sistema |
|------------|----------------|----------------------|
| `decidido_divorcio` | "sim", "nao", "quase" | stage: decidi_estruturar / avaliando / quase_decidido |
| `nivel_urgencia` | "alta", "media", "baixa" | urgency_now: ja_existe_processo / ameaca_processo / organizar_com_calma |
| `esta_separado` | "sim", "nao" | separated |
| `possui_bens` | "sim", "nao" | has_assets |
| `possui_filhos_pequenos` | "sim", "nao" | has_children |
| `divorcio_formalizado` | "sim", "nao" | divorce_formalized |
| `valor_dos_bens` | número ou string | assets_range (convertido em faixas) |

### Campos de Rastreamento UTM

Todos os campos UTM são armazenados para análise de campanhas:

- `utm_campaign`: Nome da campanha
- `utm_medium`: Meio (ex: cpc, social)
- `utm_source`: Origem (ex: facebook, instagram)
- `utm_content`: Identificador do conteúdo
- `campaign-id`: ID da campanha no Meta
- `ad-id`: ID do anúncio
- `groud-id`: ID do grupo de anúncios

## 🎯 Sistema de Scoring

O lead é automaticamente pontuado baseado nas respostas:

### Faixas de Valor de Bens
- Até R$ 200.000 → `ate_200k`
- R$ 200.000 - R$ 500.000 → `200k_500k`
- R$ 500.000 - R$ 1.000.000 → `500k_1m`
- Acima de R$ 1.000.000 → `acima_1m`

### Classificação Automática
- **Estratégico**: Score ≥ 70 pontos
- **Qualificado**: Score 40-69 pontos
- **Morno**: Score < 40 pontos

## 💻 Uso no Frontend

### Método 1: Via Webhook (Recomendado para produção)

```typescript
import { importLeadViaWebhook } from './lib/leadImport';

const lead = {
  nome: "João Silva",
  telefone: "11999999999",
  decidido_divorcio: "sim",
  nivel_urgencia: "alta",
  possui_bens: "sim",
  valor_dos_bens: "500000",
  utm_campaign: "divorcio-2024",
  utm_source: "facebook",
  campaign_id: "123456789"
};

const result = await importLeadViaWebhook(lead);
console.log(result.lead_id);
```

### Método 2: Direto no Banco (Para testes internos)

```typescript
import { importLeadDirectly } from './lib/leadImport';

const lead = {
  nome: "Maria Santos",
  telefone: "11988888888",
  decidido_divorcio: "quase",
  utm_source: "manual"
};

const result = await importLeadDirectly(lead);
console.log(result.lead_id);
```

## 🔒 Segurança

- O webhook é público (não requer autenticação JWT)
- Aceita apenas requisições POST
- CORS habilitado para qualquer origem
- Service Role Key é usada internamente para bypass de RLS

## 📝 Logs e Atividades

Cada lead importado gera automaticamente:
1. Registro na tabela `leads`
2. Respostas na tabela `lead_answers`
3. Atividade de log com informações da origem
4. Cálculo automático de scoring via trigger

## 🧪 Teste Manual via cURL

```bash
curl -X POST https://[seu-projeto].supabase.co/functions/v1/meta-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste Lead",
    "telefone": "11999999999",
    "decidido_divorcio": "sim",
    "utm_campaign": "teste",
    "utm_source": "manual"
  }'
```

## ✅ Resposta de Sucesso

```json
{
  "success": true,
  "lead_id": "uuid-do-lead",
  "message": "Lead criado com sucesso"
}
```

## ❌ Resposta de Erro

```json
{
  "error": "Failed to create lead",
  "details": "Detalhes do erro"
}
```
