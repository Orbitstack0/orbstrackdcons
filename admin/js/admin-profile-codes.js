/**
 * Decolar Consórcios — admin-profile-codes.js
 * Configuração dos códigos individuais usados SOMENTE na tela "Digite seu
 * código de acesso" (admin/selecionar-perfil.html), para identificar qual
 * perfil visual mostrar na etapa de confirmação.
 *
 * IMPORTANTE — leia antes de alterar:
 * Estes códigos NÃO são senhas nem um mecanismo de autenticação adicional.
 * Qualquer pessoa com acesso aos arquivos do site pode ler este arquivo e
 * descobrir os quatro dígitos de cada perfil. Eles servem apenas para
 * decidir qual fotografia/nome mostrar antes de abrir o painel — a
 * segurança real de acesso continua inteiramente em
 * DecolarAdminGuard.requireAdmin() (login + Supabase Auth + blog_admins +
 * RLS), que já foi validado ANTES desta tela ser exibida. Selecionar um
 * código nunca concede permissão nem troca a identidade autenticada.
 *
 * Mantenha os códigos como texto (strings), nunca como número — "0945"
 * perderia o zero à esquerda se fosse tratado como inteiro.
 *
 * Para adicionar/trocar um código: edite só o objeto CODES abaixo. O id
 * à direita precisa corresponder a um dos ids de admin-profile.js
 * (samir | andrey | william) — um código com id inexistente é ignorado.
 */
(function () {
  'use strict';

  var CODES = {
    '2106': 'samir',
    '2680': 'william',
    '0945': 'andrey',
  };

  // Nunca confia no texto digitado: só resolve para um id se o código
  // bater exatamente com um dos cadastrados acima.
  function resolveProfileIdByCode(code) {
    if (typeof code !== 'string') return null;
    return Object.prototype.hasOwnProperty.call(CODES, code) ? CODES[code] : null;
  }

  window.DecolarAdminProfileCodes = {
    resolveProfileIdByCode: resolveProfileIdByCode,
  };
})();
