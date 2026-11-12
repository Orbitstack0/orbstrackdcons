/**
 * Decolar Consórcios — contribuicoes.js
 * Lógica exclusiva da página pública "Contribua com o Blog"
 * (contribua-com-o-blog.html).
 *
 * Única função: montar o modelo de texto em memória e copiá-lo para a área
 * de transferência quando a pessoa clica em "Copiar modelo de artigo".
 * Não envia nada, não grava nada, não depende de rede nem de Supabase — o
 * envio em si continua sendo só por e-mail (mailto:), como o resto da
 * página já faz.
 */
document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.getElementById('contrib-copy-template-btn');
  const feedbackEl = document.getElementById('contrib-template-feedback');
  const fallbackEl = document.getElementById('contrib-template-fallback');

  if (!copyBtn) return;

  const TEMPLATE = [
    'MODELO DE ARTIGO — BLOG DECOLAR CONSÓRCIOS',
    '',
    'Nome completo do autor:',
    '',
    '',
    'E-mail para contato:',
    '',
    '',
    'Título do artigo:',
    '',
    '',
    'Resumo (2 a 4 frases):',
    '',
    '',
    'Categoria (escolha uma):',
    '[ ] Entenda o Consórcio',
    '[ ] Lances e Contemplação',
    '[ ] Imóveis',
    '[ ] Veículos',
    '[ ] Pesados',
    '[ ] Segurança e Planejamento',
    '[ ] Mercado e Atualidade',
    '',
    'Texto completo do artigo:',
    '',
    '',
    'Fontes e referências (se houver):',
    '',
    '',
    'Imagem de capa (opcional — anexar ao e-mail, se possuir direitos de uso):',
    '',
    '',
    '---',
    'Ao enviar, declaro que este conteúdo é de minha autoria (ou que possuo',
    'autorização para publicá-lo) e concordo com sua eventual publicação no',
    'Blog Decolar Consórcios, com crédito de autoria.',
  ].join('\n');

  function showFeedback(message, kind) {
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.classList.remove('is-success', 'is-error');
    if (kind) feedbackEl.classList.add(kind);
  }

  function showFallback() {
    if (!fallbackEl) return;
    fallbackEl.value = TEMPLATE;
    fallbackEl.hidden = false;
    fallbackEl.focus();
    fallbackEl.select();
  }

  copyBtn.addEventListener('click', async () => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(TEMPLATE);
        showFeedback('Modelo copiado!', 'is-success');
        if (fallbackEl) fallbackEl.hidden = true;
        return;
      } catch (err) {
        console.warn('Decolar: não foi possível copiar automaticamente.', err);
      }
    }

    // Sem Clipboard API (ou falhou): mostra o texto num campo selecionável
    // para a pessoa copiar manualmente (Ctrl+C), sem usar document.execCommand.
    showFeedback('Não foi possível copiar automaticamente — selecione e copie o texto abaixo.', 'is-error');
    showFallback();
  });
});
