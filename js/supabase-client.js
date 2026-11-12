/**
 * Decolar Consórcios — supabase-client.js
 * Inicialização única e compartilhada do cliente Supabase, usada pelo
 * Blog (js/blog.js, js/artigo.js) e futuramente pelo formulário público
 * e pelo painel administrativo.
 *
 * Carrega o SDK a partir de um <script> de CDN (ver blog.html/artigo.html)
 * — este projeto é um site estático no GitHub Pages, sem npm/bundler.
 *
 * SEGURANÇA:
 * - A URL do projeto e a chave abaixo são a chave PÚBLICA ("publishable"/
 *   "anon"), feita para ficar exposta no navegador — a segurança real é
 *   aplicada pelo Row Level Security (RLS) no banco, não pelo sigilo
 *   desta chave.
 * - NUNCA colar aqui a "service_role" ou qualquer chave secreta/admin.
 *   Isso daria acesso total ao banco a qualquer visitante do site.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://mwrjurjievntdjsakebg.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_t-qvMRSN4Fixqn0sFex7Mg_S8hCQVtN';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    // SDK não carregou (ex.: bloqueado por extensão, sem internet). O
    // código que consome window.decolarSupabase já trata esse caso como
    // falha de conexão, não como "sem artigos".
    console.error('Decolar: SDK do Supabase não foi carregado.');
    window.decolarSupabase = null;
    return;
  }

  window.decolarSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // O site público não precisa persistir sessão de usuário: evita
      // comportamento inesperado de auth em páginas de leitura.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
})();
