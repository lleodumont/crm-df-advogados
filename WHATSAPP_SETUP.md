# Configuração do WhatsApp com UazAPI

## Pré-requisitos

1. Conta ativa no UazAPI (https://uazapi.com)
2. Token de API do UazAPI

## Passo 1: Configurar o Token da API

Você precisa configurar a variável de ambiente `UAZAPI_TOKEN` no Supabase:

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Project Settings** > **Edge Functions**
4. Na seção **Secrets**, adicione:
   - Nome: `UAZAPI_TOKEN`
   - Valor: Seu token da API UazAPI

## Passo 2: Configurar o Webhook no UazAPI

Configure o webhook no painel do UazAPI para receber mensagens automaticamente:

**URL do Webhook:**
```
https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook
```

Substitua `SEU_PROJETO` pela URL do seu projeto Supabase (você pode encontrar em `.env` como `VITE_SUPABASE_URL`).

**Eventos a serem enviados:**
- Message received (mensagens recebidas)
- Message status update (atualizações de status)

## Passo 3: Criar uma Instância do WhatsApp

1. Acesse o CRM e vá em **WhatsApp** no menu lateral
2. Clique em **Nova Instância**
3. Preencha:
   - **Nome da Instância**: Um nome descritivo (ex: "Atendimento Principal")
   - **Instance ID**: Use o ID da sua instância no UazAPI (ou crie um novo ID único)
4. Clique em **Criar**

## Passo 4: Conectar o WhatsApp

1. Na lista de instâncias, clique em **Conectar**
2. Um QR Code será exibido
3. Abra o WhatsApp no seu celular:
   - No Android: Toque nos três pontos > Aparelhos conectados > Conectar um aparelho
   - No iPhone: Vá em Ajustes > Aparelhos conectados > Conectar um aparelho
4. Escaneie o QR Code exibido na tela
5. Aguarde alguns segundos - a instância será automaticamente marcada como "Conectado"

## Passo 5: Usar o WhatsApp no CRM

Após conectar, você pode:

1. **Visualizar conversas**: Vá na página de detalhes de qualquer lead e clique na aba "WhatsApp"
2. **Enviar mensagens**: Digite a mensagem e clique em enviar
3. **Receber mensagens**: As mensagens recebidas aparecem automaticamente no chat
4. **Histórico completo**: Todo o histórico de conversas fica salvo no banco de dados

## Solução de Problemas

### Erro: "UAZAPI_TOKEN not configured"
- Verifique se adicionou a variável de ambiente `UAZAPI_TOKEN` nas configurações do Supabase
- Após adicionar, aguarde alguns minutos para a alteração ser aplicada

### Erro: "Erro ao criar instância"
- Verifique se seu usuário tem permissão de admin ou manager
- Confirme que o Instance ID é único e não está sendo usado por outra instância

### QR Code não aparece
- Verifique sua conexão com a API do UazAPI
- Confirme que seu token é válido
- Verifique os logs da edge function no Supabase

### Mensagens não chegam automaticamente
- Confirme que o webhook está configurado corretamente no UazAPI
- Verifique se a URL do webhook está correta
- Teste o webhook enviando uma mensagem para o número conectado

## URLs Importantes

- **Edge Function de gerenciamento**: `https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-manager`
- **Edge Function de envio**: `https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-send`
- **Edge Function de webhook**: `https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook`
- **Documentação UazAPI**: https://docs.uazapi.com

## Suporte

Se encontrar problemas, verifique:
1. Os logs das Edge Functions no painel do Supabase
2. O console do navegador (F12) para erros no frontend
3. A documentação do UazAPI para mudanças na API
