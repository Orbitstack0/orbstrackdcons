/**
 * Decolar Consórcios — reading-time.js
 * Utilitário compartilhado para estimativa do tempo de leitura dos artigos.
 *
 * Utilizado por:
 * - blog.html (destaque e cards) via js/blog.js
 * - artigo.html (cabeçalho editorial) via js/artigo.js
 * - admin/artigo-editor.html (pré-visualização em tempo real) via js/admin-editor.js
 * - admin/artigo-detalhes.html (estatística editorial) via js/admin-article-details.js
 *
 * Regras:
 * - 200 palavras por minuto (PPM)
 * - Mínimo de 1 minuto para qualquer artigo com conteúdo
 * - Arredondamento para cima (Math.ceil)
 * - Ignora tags HTML e decodifica entidades (ex.: &nbsp;)
 * - Remove quebras invisíveis (soft hyphens, zero-width spaces)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var lib = factory();
    root.estimateReadingTime = lib.estimateReadingTime;
    root.countArticleWords = lib.countArticleWords;
    root.stripHtmlToText = lib.stripHtmlToText;
    root.DecolarReadingTime = lib;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var INVISIBLE_BREAK_CHARS_RE = /[­​‌‍⁠﻿]/g;

  /**
   * Converte conteúdo HTML (ou texto com tags/entidades) em texto puro limpo.
   * @param {string} htmlOrText
   * @returns {string}
   */
  function stripHtmlToText(htmlOrText) {
    if (!htmlOrText || typeof htmlOrText !== 'string') return '';

    // Remove tags de estilo ou script por segurança
    var cleaned = htmlOrText.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

    // Remove tags de imagem para evitar requisições de rede ao instanciar elementos
    cleaned = cleaned.replace(/<img[^>]*>/gi, ' ');

    // Garante espaçamento ao fechar blocos para evitar aglutinação de palavras
    var spaced = cleaned
      .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|table|section|article)>/gi, ' ')
      .replace(/<br\s*[\/]?>/gi, ' ');

    // Se estiver em ambiente com DOM (navegador), usa elemento inerte para
    // decodificar todas as entidades HTML (&nbsp;, &amp;, etc.) com fidelidade.
    if (typeof document !== 'undefined') {
      var tmp = document.createElement('div');
      tmp.innerHTML = spaced;
      var text = tmp.textContent || tmp.innerText || '';
      return text.replace(INVISIBLE_BREAK_CHARS_RE, '');
    }

    // Fallback puro para Node.js / testes / SSR
    return spaced
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(INVISIBLE_BREAK_CHARS_RE, '');
  }

  /**
   * Conta as palavras de um artigo a partir de seu conteúdo (HTML ou texto).
   * @param {string} content
   * @returns {number}
   */
  function countArticleWords(content) {
    if (!content) return 0;
    var plain = stripHtmlToText(content);
    var words = plain.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }

  /**
   * Calcula o tempo estimado de leitura em minutos.
   * - 200 palavras por minuto.
   * - Arredondamento para cima (Math.ceil).
   * - Mínimo de 1 minuto se houver conteúdo.
   * - Retorna null se não houver conteúdo/palavras.
   *
   * @param {string} content
   * @returns {number|null}
   */
  function estimateReadingTime(content) {
    if (!content) return null;
    var words = countArticleWords(content);
    if (!words) return null;
    return Math.max(1, Math.ceil(words / 200));
  }

  return {
    stripHtmlToText: stripHtmlToText,
    countArticleWords: countArticleWords,
    estimateReadingTime: estimateReadingTime,
  };
});
