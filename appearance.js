/* Aparência — a preferência visual da interface (Preto + gelo · Grafite neutro · Claro neutro).
 *
 * É PREFERÊNCIA, não conteúdo: mora numa chave própria (`pp_appearance_v1`), fora do
 * `pp_empreendedor_v1` e do `pp_video_projects_v1`, e não entra em nada que seja exportado.
 * Trocar de aparência só reescreve `<html data-appearance>` — nenhum componente é remontado,
 * então o vídeo continua tocando, o campo em edição mantém o valor e o foco fica onde estava.
 *
 * `data-theme` (score-bar.js) é OUTRA coisa e continua sendo dele: aquilo troca as imagens do
 * placar ao vivo. A interface é Black + Ice em qualquer time.
 *
 * Carregado no <head>, síncrono e minúsculo (~1KB, longe do teto do BP-005), porque o atributo
 * precisa existir ANTES do primeiro paint — senão a tela pisca no tema errado.
 */
(function (root) {
  var KEY = 'pp_appearance_v1';
  var PRESETS = ['preto-gelo', 'grafite', 'claro'];
  var FALLBACK = 'preto-gelo';   // o padrão aprovado

  /* O localStorage pode não existir e pode LANÇAR ao ser lido (aba privada, cookies de
     terceiros bloqueados, cota estourada). Preferência que derruba o site é pior que
     preferência esquecida: qualquer falha aqui cai no padrão, calada. */
  function read() {
    try { return root.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(value) {
    try { root.localStorage.setItem(KEY, value); return true; } catch (e) { return false; }
  }

  /* Valor gravado por uma versão antiga, editado à mão ou corrompido não vira atributo:
     `data-appearance="lixo"` não casaria com nenhum bloco de token e deixaria a tela sem cor. */
  function pick(raw) {
    return PRESETS.indexOf(raw) >= 0 ? raw : FALLBACK;
  }

  function apply(raw) {
    var chosen = pick(raw);
    if (root.document && root.document.documentElement) {
      root.document.documentElement.setAttribute('data-appearance', chosen);
    }
    return chosen;
  }

  /* Escolha do usuário: aplica primeiro (a tela tem de responder mesmo sem storage),
     grava depois. O retorno diz o que ficou valendo, não o que foi pedido. */
  function set(raw) {
    var chosen = apply(raw);
    write(chosen);
    return chosen;
  }

  var api = {
    KEY: KEY, PRESETS: PRESETS, FALLBACK: FALLBACK,
    pick: pick, read: read, write: write, apply: apply, set: set,
    current: function () { return pick(read()); }
  };

  root.Appearance = api;
  if (typeof module === 'object' && module.exports) module.exports = api;

  apply(read());
})(typeof window !== 'undefined' ? window : globalThis);
