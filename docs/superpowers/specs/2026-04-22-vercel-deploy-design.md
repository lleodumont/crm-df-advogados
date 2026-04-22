# Design: Deploy no Vercel via CLI

**Data:** 2026-04-22  
**Status:** Aprovado

---

## Contexto

CRM React/Vite/Supabase que roda localmente em `localhost:5175`. Nunca foi feito deploy em produção. O roteador usa `window.location.pathname` customizado — sem react-router — o que exige rewrite SPA obrigatório para funcionar no Vercel.

---

## Abordagem

CLI + `vercel.json` commitado. O arquivo de configuração resolve o rewrite de SPA e documenta o build no repositório. As env vars são cadastradas via CLI lendo o `.env` local.

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `vercel.json` | Criar na raiz do projeto |
| `.vercel/` | Gerado pelo `vercel link` — já está no `.gitignore` |

---

## Design

### 1. `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- `buildCommand`: usa o script padrão do Vite
- `outputDirectory`: pasta gerada pelo Vite build
- `rewrites`: qualquer rota serve `index.html` — o roteador customizado do app assume o controle no cliente

### 2. Variáveis de ambiente

Cadastradas no projeto Vercel para o ambiente `production`, lidas do `.env` local:

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon pública do Supabase |
| `VITE_UAZAPI_URL` | URL da instância UazAPI/WhatsApp |
| `VITE_UAZAPI_TOKEN` | Token de autenticação UazAPI |
| `VITE_WHATSAPP_INSTANCE` | Nome da instância WhatsApp |

Nenhuma dessas variáveis é commitada — vivem apenas no painel do projeto Vercel.

### 3. Fluxo de deploy

1. `vercel login` — autenticar CLI (abre browser se necessário)
2. `vercel link` — associar diretório ao projeto Vercel (cria `.vercel/project.json`)
3. Cadastrar as 5 env vars via CLI com os valores do `.env` local
4. `npm run build` — verificar build local sem erros
5. `vercel --prod` — deploy de produção, retorna URL `*.vercel.app`

### 4. O que não está no escopo

- Domínio personalizado (configurado depois, via `vercel domains add`)
- GitHub integration / auto-deploy (pode ser ativado no dashboard depois)
- Supabase Edge Functions (deployadas separadamente no Supabase, não no Vercel)
- Preview deployments

---

## Resultado esperado

URL pública `*.vercel.app` com o CRM acessível, todas as rotas funcionando ao recarregar a página, e conexão com Supabase via env vars de produção.
