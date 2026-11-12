# Supabase Edge Function: `track-article-engagement`

Esta função Deno é o gateway de ingestão segura de métricas de leitura do Blog Decolar Consórcios, conectando o leitor público à Stored Procedure interna `process_article_pulse`.

---

## 1. Ajustes e Proteções Implementadas

1. **Rate Limiting em Camadas:**
   - **Nível 1 (Borda em Memória):** Limita rajadas a no máximo 40 requisições por minuto por IP na instância quente, protegendo a Edge Function contra floods imediatos.
   - **Nível 2 (Banco de Dados Persistente):** Ao inicializar uma sessão, o servidor verifica em `public.blog_article_sessions` se o visitante já criou mais de 15 sessões nos últimos 10 minutos para aquele artigo. Se ultrapassar, retorna `HTTP 429 Too Many Requests`.
   - **Nível 3 (Temporal por Sessão):** `process_article_pulse` no PostgreSQL descarta pulsos com intervalo real inferior a 3 segundos e rejeita aceleração temporal.
2. **Identificação do Visitante e Limitações Reais:**
   - O IP do cliente é extraído de cabeçalhos confiáveis da infraestrutura (`cf-connecting-ip` da Cloudflare ou `x-real-ip` do Supabase Gateway) e validado com regex estrito de IPv4 e IPv6.
   - O `visitor_token` diário é calculado via `HMAC-SHA256(IP + User-Agent_Family + Data_UTC, METRICS_SALT)`.
   - **Limitações e LGPD:** O indicador "Visitantes Únicos Estimados" é uma estimativa estatística diária. Conexões na mesma rede Wi-Fi/NAT compartilham o mesmo IP e são agrupadas sob o mesmo token. Sob a LGPD, o token é considerado um dado pseudonimizado (e não um dado anônimo absoluto) e expira matematicamente a cada 24 horas UTC.
   - Se o IP não puder ser confiavelmente determinado pela infraestrutura, o sistema **não sintetiza IPs artificiais** (como `127.0.0.1`): a sessão e a leitura são registradas, mas `visitor_token` fica nulo, evitando distorcer o contador de visitantes únicos.
3. **Exclusão Segura de Administradores (Fail-Closed):**
   - Inspeciona o cabeçalho `Authorization: Bearer <jwt>`.
   - Consulta a API de autenticação do Supabase (`auth.getUser()`) e valida se o `user.id` consta em `public.blog_admins`.
   - Se a validação falhar por erro de banco, a função **não falha aberta** (retorna erro 500 em vez de registrar a leitura como visitante comum).
   - Se for confirmado administrador, responde `200 OK` com status `"ignored"` sem alterar acumuladores.
4. **Segredo Obrigatório (`METRICS_SALT`):**
   - A função exige a variável de ambiente `METRICS_SALT` configurada no Supabase.
   - Não há fallback para chaves de serviço ou valores estáticos inseguros. Se a variável não estiver configurada, a função recusa a execução com erro 500 explícito.
5. **Proteção de Tamanho de Payload:**
   - Limite estrito de 2.048 bytes (2 KB) para o corpo da requisição via cabeçalho `content-length` e verificação no stream de texto.
6. **CORS Restrito:**
   - Autoriza apenas `https://decolarconsorcios.com.br`, `https://www.decolarconsorcios.com.br` e ambientes locais (`localhost`, `127.0.0.1`).

---

## 2. Configuração de Segredos no Supabase

Antes de publicar ou testar a função, configure o segredo obrigatório no seu projeto:

### Opção A: Via Supabase Dashboard (Web)
1. Acesse o **Supabase Dashboard** → Seu Projeto → menu lateral **Project Settings** → **Edge Functions** (ou **Secrets**).
2. Adicione o novo segredo:
   - **Nome:** `METRICS_SALT`
   - **Valor:** Uma string criptográfica aleatória longa (ex.: gerada com 32 a 64 caracteres alfanuméricos aleatórios).
3. Salve as alterações.

---

## 3. Publicação (Deploy) no Supabase

### Pelo Supabase Dashboard (Web):
1. Acesse o **Supabase Dashboard** → **Edge Functions**.
2. Clique em **"Deploy a new function"** (ou **"Create Function"**).
3. Nome: `track-article-engagement`.
4. Cole o código de [`supabase/functions/track-article-engagement/index.ts`](./index.ts).
5. Em **Settings**, certifique-se de que a opção **"Enforce JWT Verification"** esteja **desmarcada** (pois os leitores anônimos não possuem JWT, e a verificação é realizada internamente pelo código).
6. Clique em **Deploy**.

---

## 4. Testes de Validação

### Teste 1: Inicialização de Sessão Válida
```powershell
$body = @{
    article_id = "e80b387d-9f68-415b-bda4-9de8959a08c1"
    session_id = "sessao_valida_1234567890abcdef"
    pulse_seconds = 0
    consent = "accepted"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mwrjurjievntdjsakebg.supabase.co/functions/v1/track-article-engagement" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body
```
* **Resposta esperada:** `{ "status": "session_initialized", "is_qualified": false }`

### Teste 2: Rejeição de Payload Excessivo (> 2 KB)
Envio de payload artificialmente inflado para comprovar a rejeição com `HTTP 413 Payload Too Large`.

### Teste 3: Verificação de Falta de `METRICS_SALT`
Se `METRICS_SALT` não for configurado no Supabase, a função responde `HTTP 500` com `{ "error": "Configuração de segurança pendente no servidor (METRICS_SALT)." }`.
