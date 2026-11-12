/**
 * Decolar Consórcios — admin-profile.js
 * Seleção de perfil visual, compartilhada por admin/index.html e
 * admin/artigo-editor.html.
 *
 * IMPORTANTE: perfis são apenas identificação visual (quem está usando a
 * conta administrativa compartilhada neste momento) — não são contas
 * separadas nem níveis de permissão. Qualquer pessoa autenticada na conta
 * compartilhada pode escolher qualquer um dos três perfis. A segurança real
 * continua inteiramente em DecolarAdminGuard (Supabase Auth + blog_admins
 * + RLS); este arquivo nunca autentica ou autoriza nada.
 *
 * Guardado em sessionStorage (não localStorage): a escolha vale só para a
 * sessão de uso atual da aba/navegador, some ao fechar, e nunca é lida como
 * se fosse uma identidade permanente do dispositivo.
 *
 * Exposto em window.DecolarAdminProfile:
 *   - PROFILES: lista fixa, na ordem obrigatória Samir, Andrey, William.
 *   - getSelectedProfile(): devolve o perfil salvo, ou null se não houver
 *     nenhum ou se o valor salvo não corresponder a nenhum dos três
 *     permitidos (validação contra a lista, nunca confia no valor bruto).
 *   - setSelectedProfile(id): só grava se o id for um dos três permitidos.
 *   - clearSelectedProfile(): remove a escolha (usado no logout e em
 *     "Trocar perfil").
 *   - requireProfile(): usado por toda página protegida que também exige
 *     perfil. Deve ser chamado SOMENTE depois de
 *     DecolarAdminGuard.requireAdmin() já ter resolvido com sucesso.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'decolar-admin-profile';
  var SELECT_PAGE = 'selecionar-perfil.html';

  // Ordem fixa e obrigatória: Samir (esquerda) | Andrey (centro) | William (direita).
  // "photo" é opcional — quando presente, a tela de seleção mostra a
  // fotografia em vez das iniciais. Caminho relativo a partir de admin/*.html.
  var PROFILES = [
    { id: 'samir', firstName: 'Samir', fullName: 'Samir Mannaa', photo: '../assets/images/decolar-perfil-samir-mannaa.webp' },
    { id: 'andrey', firstName: 'Andrey', fullName: 'Andrey Roque', photo: '../assets/images/decolar-perfil-andrey-roque.webp' },
    { id: 'william', firstName: 'William', fullName: 'William Richer', photo: '../assets/images/decolar-perfil-william-richer.webp' },
  ];

  function getProfileById(id) {
    for (var i = 0; i < PROFILES.length; i += 1) {
      if (PROFILES[i].id === id) return PROFILES[i];
    }
    return null;
  }

  // Nunca confia no valor bruto salvo: só devolve um perfil se ele bater
  // exatamente com um dos três ids permitidos.
  function getSelectedProfile() {
    var storedId;
    try {
      storedId = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
    return getProfileById(storedId);
  }

  function setSelectedProfile(id) {
    var profile = getProfileById(id);
    if (!profile) return false;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, profile.id);
    } catch (err) {
      return false;
    }
    return true;
  }

  function clearSelectedProfile() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // Silencioso: sessionStorage pode estar indisponível (modo privado
      // restritivo); nesse caso simplesmente não há nada para limpar.
    }
  }

  function requireProfile() {
    var profile = getSelectedProfile();
    if (profile) return profile;
    window.location.replace(SELECT_PAGE);
    return null;
  }

  window.DecolarAdminProfile = {
    PROFILES: PROFILES,
    getSelectedProfile: getSelectedProfile,
    setSelectedProfile: setSelectedProfile,
    clearSelectedProfile: clearSelectedProfile,
    requireProfile: requireProfile,
  };
})();
