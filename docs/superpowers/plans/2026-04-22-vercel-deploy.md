# Vercel Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o primeiro deploy do CRM no Vercel via CLI, com SPA rewrites e variáveis de ambiente configuradas.

**Architecture:** Criar `vercel.json` com rewrite SPA e configuração de build, adicionar `.vercel/` ao `.gitignore`, cadastrar env vars via CLI lendo do `.env` local, e fazer deploy de produção com `vercel --prod`.

**Tech Stack:** Vercel CLI v50, Vite, React 18, Node/npm.

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `vercel.json` | Criar na raiz |
| `.gitignore` | Adicionar entrada `.vercel/` |
| `.vercel/` | Gerado pelo `vercel link` — nunca commitado |

---

## Task 1: Criar `vercel.json` e atualizar `.gitignore`

**Files:**
- Create: `vercel.json`
- Modify: `.gitignore`

- [ ] **Step 1: Criar `vercel.json` na raiz do projeto**

Conteúdo exato do arquivo:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 2: Adicionar `.vercel/` ao `.gitignore`**

Adicionar ao final do arquivo `.gitignore`:
```
.vercel/
```

- [ ] **Step 3: Verificar que o build Vite funciona localmente**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Rafael Haddad/crm-rafael-haddad"
npm run build
```

Esperado: saída terminando com algo como:
```
dist/index.html          x.xx kB
dist/assets/index-xxx.js   xxx kB
✓ built in Xs
```
Se houver erros TypeScript ou de build, corrija antes de continuar.

- [ ] **Step 4: Commit**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Rafael Haddad/crm-rafael-haddad"
git add vercel.json .gitignore
git commit -m "feat: add vercel.json with SPA rewrites and build config"
```

---

## Task 2: Linkar o projeto ao Vercel

**Files:**
- `.vercel/project.json` (gerado automaticamente, não commitado)

- [ ] **Step 1: Executar `vercel link` no diretório do projeto**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Rafael Haddad/crm-rafael-haddad"
vercel link
```

Quando perguntado:
- `Set up and deploy?` → **N** (só linkar por enquanto)
- `Which scope?` → selecionar `lleodumont-5332`
- `Link to existing project?` → **N** (é um projeto novo)
- `What's your project's name?` → `crm-rafael-haddad`
- `In which directory is your code located?` → `.` (Enter)

Esperado: mensagem `✅ Linked to lleodumont-5332/crm-rafael-haddad`

- [ ] **Step 2: Verificar que `.vercel/project.json` foi criado**

```bash
cat "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Rafael Haddad/crm-rafael-haddad/.vercel/project.json"
```

Esperado: JSON com `orgId` e `projectId` preenchidos.

---

## Task 3: Cadastrar variáveis de ambiente no Vercel

**Pré-requisito:** `.env` local com os valores reais das 5 variáveis.

Para cada variável abaixo, executar o comando lendo o valor do `.env` local e passando via pipe para o CLI (evita expor no histórico do shell):

- [ ] **Step 1: Cadastrar `VITE_SUPABASE_URL`**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Rafael Haddad/crm-rafael-haddad"
grep VITE_SUPABASE_URL .env | cut -d'=' -f2- | vercel env add VITE_SUPABASE_URL production
```

Esperado: `✅ Added Environment Variable VITE_SUPABASE_URL to Project crm-rafael-haddad [production]`

- [ ] **Step 2: Cadastrar `VITE_SUPABASE_ANON_KEY`**

```bash
grep VITE_SUPABASE_ANON_KEY .env | cut -d'=' -f2- | vercel env add VITE_SUPABASE_ANON_KEY production
```

Esperado: `✅ Added Environment Variable VITE_SUPABASE_ANON_KEY to Project crm-rafael-haddad [production]`

- [ ] **Step 3: Cadastrar `VITE_UAZAPI_URL`**

```bash
grep VITE_UAZAPI_URL .env | cut -d'=' -f2- | vercel env add VITE_UAZAPI_URL production
```

Esperado: `✅ Added Environment Variable VITE_UAZAPI_URL to Project crm-rafael-haddad [production]`

- [ ] **Step 4: Cadastrar `VITE_UAZAPI_TOKEN`**

```bash
grep VITE_UAZAPI_TOKEN .env | cut -d'=' -f2- | vercel env add VITE_UAZAPI_TOKEN production
```

Esperado: `✅ Added Environment Variable VITE_UAZAPI_TOKEN to Project crm-rafael-haddad [production]`

- [ ] **Step 5: Cadastrar `VITE_WHATSAPP_INSTANCE`**

```bash
grep VITE_WHATSAPP_INSTANCE .env | cut -d'=' -f2- | vercel env add VITE_WHATSAPP_INSTANCE production
```

Esperado: `✅ Added Environment Variable VITE_WHATSAPP_INSTANCE to Project crm-rafael-haddad [production]`

- [ ] **Step 6: Confirmar que todas as 5 variáveis foram cadastradas**

```bash
vercel env ls production
```

Esperado: lista com as 5 variáveis `VITE_*` no ambiente `production`.

---

## Task 4: Deploy de produção

- [ ] **Step 1: Executar deploy de produção**

```bash
cd "/Users/leonardo/Library/Mobile Documents/com~apple~CloudDocs/Documents/www/Rafael Haddad/crm-rafael-haddad"
vercel --prod
```

Esperado: saída com URL final, ex:
```
✅ Production: https://crm-rafael-haddad.vercel.app [Xs]
```

- [ ] **Step 2: Abrir a URL e verificar login**

Abrir a URL retornada no browser. Verificar:
- Página de login carrega
- É possível autenticar com usuário do Supabase

- [ ] **Step 3: Verificar SPA routing (rota direta)**

Com o app logado, copiar a URL de uma rota interna (ex: `https://crm-rafael-haddad.vercel.app/leads`) e colar diretamente na barra de endereço (forçar reload).

Esperado: página de leads carrega normalmente, sem erro 404.

- [ ] **Step 4: Verificar conexão com WhatsApp/UazAPI**

Navegar para Configurações de WhatsApp e verificar que a conexão aparece sem erro de CORS ou URL inválida.

---

## Self-Review

**Spec coverage:**
- [x] `vercel.json` com rewrites SPA → Task 1
- [x] `.vercel/` no `.gitignore` → Task 1
- [x] `vercel link` para projeto novo → Task 2
- [x] 5 env vars cadastradas para `production` → Task 3
- [x] `vercel --prod` → Task 4
- [x] Verificação de SPA routing (reload em rota interna) → Task 4, Step 3

**Placeholder scan:** Nenhum TBD encontrado. Todos os comandos são exatos.

**Consistência:** Nome do projeto `crm-rafael-haddad` usado de forma consistente em todos os tasks.
