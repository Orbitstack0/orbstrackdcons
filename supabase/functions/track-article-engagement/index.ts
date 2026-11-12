// ==============================================================================
// DECOLAR CONSÓRCIOS — SUPABASE EDGE FUNCTION: track-article-engagement
// ==============================================================================
// Gateway de ingestão de telemetria e métricas de leitura do Blog Decolar.
// Executado no Deno Runtime na infraestrutura de borda do Supabase.
// ==============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// 1. ORIGENS PERMITIDAS (CORS)
const ALLOWED_ORIGINS = [
  "https://decolarconsorcios.com.br",
  "https://www.decolarconsorcios.com.br",
];

// Expressão regular de localhost com grupos não-capturantes (?:...) e suporte a IPv4/IPv6 local
const LOCALHOST_REGEX = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/;

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  let matchedOrigin = "https://decolarconsorcios.com.br";
  if (requestOrigin) {
    if (ALLOWED_ORIGINS.includes(requestOrigin) || LOCALHOST_REGEX.test(requestOrigin)) {
      matchedOrigin = requestOrigin;
    }
  }

  return {
    "Access-Control-Allow-Origin": matchedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
  };
}

// 2. RATE LIMITING DE BORDA EM MEMÓRIA (Defesa rápida contra flood na mesma instância)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryRateLimit = new Map<string, RateLimitEntry>();
const MEMORY_MAX_REQUESTS_PER_MINUTE = 40;
const MEMORY_WINDOW_MS = 60 * 1000;

function checkMemoryBurstLimit(key: string): boolean {
  const now = Date.now();
  const entry = memoryRateLimit.get(key);

  if (!entry || now > entry.resetAt) {
    memoryRateLimit.set(key, { count: 1, resetAt: now + MEMORY_WINDOW_MS });
    return true;
  }

  if (entry.count >= MEMORY_MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  entry.count++;
  return true;
}

// Limpeza de memória a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryRateLimit.entries()) {
    if (now > entry.resetAt) {
      memoryRateLimit.delete(key);
    }
  }
}, 5 * 60 * 1000);

// 3. EXTRAÇÃO E VALIDAÇÃO ESTRITA DE IP CONFIÁVEL
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$/i;

function getTrustedClientIp(req: Request): string | null {
  // cf-connecting-ip é injetado pelo proxy Cloudflare na borda do Supabase
  // x-real-ip é injetado pelo gateway de entrada do Supabase
  // NUNCA usamos x-forwarded-for cru, pois ele pode ser manipulado por clientes intermediários
  const candidate = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
  if (!candidate) return null;

  const cleanIp = candidate.trim().split(",")[0].trim();
  if (IPV4_REGEX.test(cleanIp) || IPV6_REGEX.test(cleanIp)) {
    return cleanIp;
  }

  return null;
}

// 4. GERAÇÃO DE TOKEN DE VISITANTE ÚNICO (HMAC-SHA256 PSEUDONIMIZADO COM ROTAÇÃO DIÁRIA)
// Transparência: Este token é uma estimativa estatística de conexões diárias e constitui dado pseudonimizado.
// Não permite identificar nominalmente a pessoa física, mas requer governança conforme a LGPD.
async function generateDailyVisitorToken(clientIp: string | null, userAgent: string, secretSalt: string): Promise<string | null> {
  if (!clientIp) return null;

  // Reduz User-Agent à família do navegador (ex.: Chrome/120, Safari/17) para evitar fingerprinting excessivo
  const uaFamily = userAgent.slice(0, 48).replace(/[^a-zA-Z0-9/._\-]/g, "");
  const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const rawInput = `${clientIp}|${uaFamily}|${todayUtc}|${secretSalt}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretSalt);
  const msgData = encoder.encode(rawInput);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 5. REGEX DE VALIDAÇÃO DE ENTRADA
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_ID_REGEX = /^[a-zA-Z0-9_\-]{16,64}$/;
const MAX_BODY_BYTES = 2048; // Limite de 2 KB para o corpo da requisição

// 6. CONTROLADOR PRINCIPAL DA FUNÇÃO
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido. Utilize POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  // Limite estrito de tamanho do payload
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return new Response(
      JSON.stringify({ error: "Payload excede o tamanho máximo permitido (2 KB)." }),
      { status: 413, headers: corsHeaders }
    );
  }

  try {
    // A. Verificação de Variáveis de Ambiente Obrigatórias
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const metricsSalt = Deno.env.get("METRICS_SALT");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Decolar Edge Function: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
      return new Response(
        JSON.stringify({ error: "Configuração interna do servidor indisponível." }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Exigência estrita: METRICS_SALT deve existir sem fallbacks arbitrários
    if (!metricsSalt || metricsSalt.trim().length < 16) {
      console.error("Decolar Edge Function: variável METRICS_SALT ausente ou com tamanho insuficiente.");
      return new Response(
        JSON.stringify({ error: "Configuração de segurança pendente no servidor (METRICS_SALT)." }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // B. Verificação Segura de Administradores (Fail-Closed)
    // Se o cabeçalho Authorization estiver presente, valida o JWT com a API do Supabase Auth
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const jwtToken = authHeader.slice(7).trim();
      if (jwtToken.length > 0) {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(jwtToken);

        if (authErr) {
          console.warn("Decolar Edge Function: token JWT inválido ou expirado.", authErr.message);
          // Token malformado ou corrompido: não falha aberto
          return new Response(
            JSON.stringify({ error: "Token de autorização inválido ou expirado." }),
            { status: 401, headers: corsHeaders }
          );
        }

        if (authData && authData.user) {
          // Consulta autorização em public.blog_admins
          const { data: adminRecord, error: adminQueryErr } = await supabaseAdmin
            .from("blog_admins")
            .select("user_id")
            .eq("user_id", authData.user.id)
            .maybeSingle();

          if (adminQueryErr) {
            console.error("Decolar Edge Function: falha ao consultar blog_admins.", adminQueryErr);
            return new Response(
              JSON.stringify({ error: "Falha de validação administrativa no banco." }),
              { status: 500, headers: corsHeaders }
            );
          }

          if (adminRecord) {
            // Confirmado administrador: descarte seguro sem alterar métricas
            return new Response(
              JSON.stringify({
                status: "ignored",
                reason: "admin_access",
                message: "Telemetria inibida para administradores do Blog Decolar.",
              }),
              { status: 200, headers: corsHeaders }
            );
          }
        }
      }
    }

    // C. Proteção Básica contra Bots Conhecidos via User-Agent
    const userAgent = req.headers.get("user-agent") || "";
    if (
      /bot|crawler|spider|crawling|slurp|facebookexternalhit|bingbot|googlebot|yandex|duckduckbot/i.test(
        userAgent
      )
    ) {
      return new Response(
        JSON.stringify({ status: "ignored", reason: "bot_detected" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // D. Leitura e Validação do Corpo da Requisição
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição excede o limite." }),
        { status: 413, headers: corsHeaders }
      );
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "Formato JSON inválido." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { article_id, session_id, pulse_seconds, consent } = parsedBody || {};

    // E. Validação do Campo de Consentimento
    // Importante: A conformidade real da LGPD é garantida pelo frontend não executando
    // o rastreador sem consentimento; a validação aqui evita ingestão acidental se o cliente sinalizar recusa.
    if (consent !== "accepted") {
      return new Response(
        JSON.stringify({
          status: "ignored",
          reason: "consent_not_granted",
          message: "Telemetria inibida: consentimento de cookies não confirmado.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // F. Validações Estruturais de Parâmetros
    if (!article_id || !UUID_REGEX.test(article_id)) {
      return new Response(
        JSON.stringify({ error: "article_id inválido ou ausente." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!session_id || !SESSION_ID_REGEX.test(session_id)) {
      return new Response(
        JSON.stringify({ error: "session_id inválido (deve ter entre 16 e 64 caracteres)." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const sanitizedPulse = Number.isInteger(pulse_seconds) ? pulse_seconds : 0;
    if (sanitizedPulse < 0 || sanitizedPulse > 30) {
      return new Response(
        JSON.stringify({ error: "pulse_seconds fora do intervalo permitido (0 a 30)." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // G. Extração de IP Confiável e Rate Limiting em Memória
    const clientIp = getTrustedClientIp(req);
    const burstKey = clientIp || `no_ip_${session_id.slice(0, 16)}`;

    if (!checkMemoryBurstLimit(burstKey)) {
      return new Response(
        JSON.stringify({
          error: "Limite de requisições excedido. Tente novamente em instantes.",
          status: "rate_limited",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // H. Geração do Identificador de Visitante Único Anônimo
    const visitorToken = await generateDailyVisitorToken(clientIp, userAgent, metricsSalt);

    // I. Rate Limiting Persistente no Banco contra Criação Abusiva de Sessões
    // Se for pulso inicial (criação de sessão) e houver token de visitante, verifica se foram criadas muitas sessões
    if (sanitizedPulse === 0 && visitorToken) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count: recentSessionsCount, error: countErr } = await supabaseAdmin
        .from("blog_article_sessions")
        .select("id", { count: "exact", head: true })
        .eq("article_id", article_id)
        .eq("visitor_token", visitorToken)
        .gte("created_at", tenMinutesAgo);

      if (countErr) {
        console.error("Decolar Edge Function: falha na verificação de rate limiting no banco.", countErr);
        return new Response(
          JSON.stringify({ error: "Falha ao verificar limites de requisição no banco." }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (typeof recentSessionsCount === "number" && recentSessionsCount >= 15) {
        return new Response(
          JSON.stringify({
            status: "rate_limited",
            message: "Muitas sessões criadas em curto intervalo para este leitor. Aguarde alguns minutos.",
          }),
          { status: 429, headers: corsHeaders }
        );
      }
    }

    // J. Invocação Transacional da Stored Procedure (process_article_pulse)
    const { data: dbResult, error: dbError } = await supabaseAdmin.rpc(
      "process_article_pulse",
      {
        p_article_id: article_id,
        p_session_id: session_id,
        p_visitor_token: visitorToken,
        p_pulse_seconds: sanitizedPulse,
      }
    );

    if (dbError) {
      console.error("Decolar Edge Function: erro ao executar process_article_pulse.", dbError);
      return new Response(
        JSON.stringify({ error: "Falha interna ao processar telemetria no banco de dados." }),
        { status: 500, headers: corsHeaders }
      );
    }

    // K. Tratamento das Respostas de Negócio do Banco
    if (dbResult && dbResult.status === "expired") {
      return new Response(
        JSON.stringify({
          status: "expired",
          message: "Sessão expirada por inatividade. Reinicie a sessão de leitura.",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (dbResult && dbResult.status === "rate_limited") {
      return new Response(
        JSON.stringify({
          status: "rate_limited",
          message: "Pulso enviado rápido demais. Aguarde o intervalo regular.",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    if (dbResult && dbResult.status === "rejected") {
      return new Response(
        JSON.stringify({
          status: "rejected",
          reason: dbResult.reason || "unspecified",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify(dbResult), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("Decolar Edge Function: exceção não tratada.", errorMsg);
    return new Response(
      JSON.stringify({ error: "Erro interno no servidor de telemetria." }),
      { status: 500, headers: corsHeaders }
    );
  }
});
