/**
 * Decolar Consórcios — admin-supabase-client.js
 * Cliente Supabase exclusivo do painel administrativo.
 *
 * Mesma URL e mesma chave PÚBLICA ("anon") já usadas em
 * js/supabase-client.js (site público) — não há chave diferente para o
 * admin, nunca "service_role". O que muda aqui é só a configuração de
 * sessão: o painel precisa manter o login entre páginas e entre
 * recarregamentos, por isso usa uma instância própria com
 * `persistSession: true` (o cliente público usa `false` de propósito).
 *
 * SEGURANÇA:
 * - A chave abaixo é pública por design; a proteção real do painel vem
 *   das políticas RLS no Supabase (quem pode LER/ESCREVER o quê), não do
 *   sigilo desta chave nem da verificação feita em admin-auth-guard.js.
 * - NUNCA colar aqui a "service_role" ou qualquer chave secreta/admin.
 */
(function () {
  'use strict';

  // Mesmos valores de js/supabase-client.js — mantidos idênticos de
  // propósito para não haver divergência entre o cliente público e o
  // administrativo.
  var SUPABASE_URL = 'https://mwrjurjievntdjsakebg.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_t-qvMRSN4Fixqn0sFex7Mg_S8hCQVtN';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Decolar Admin: SDK do Supabase não foi carregado.');
    window.adminSupabase = null;
    return;
  }

  window.adminSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Chave própria no localStorage, para não colidir com nenhum outro
      // uso do Supabase Auth neste domínio.
      storageKey: 'decolar-admin-auth',
    },
  });
})();
