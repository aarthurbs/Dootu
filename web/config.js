/* Camada de configuração do site público. É o ÚNICO arquivo que muda entre a
   máquina local e o ar — sem framework, sem build, sem npm.

   Nada aqui é segredo: a sitekey do Turnstile é pública por desenho (ela vive no
   HTML de qualquer site que o use). O SECRET do Turnstile fica só na variável de
   ambiente do serviço de análise, e nunca neste arquivo. */
window.CLIPS_CONFIG = {
  /* Endereço do motor de análise (cloud/probe_server.py).

     Este valor NÃO muda entre a máquina de casa, a do trabalho e o site publicado
     no Vercel — é sempre o SEU próprio computador. É isso que faz uma página só
     servir para tudo: ela chama o motor de quem está olhando.

     Com o motor desligado, a página abre e explica isso, em vez de dar erro de
     rede. Ligue com `.\analise-local.ps1`. */
  apiBase: 'http://127.0.0.1:8080',

  /* Sitekey do Cloudflare Turnstile. Vazio = nenhuma verificação, e a análise só
     funciona contra um servidor rodando com CLIPS_DEV=1. Publicar sem sitekey
     deixa o endpoint aberto — o servidor se recusa a subir nessa condição. */
  turnstileSiteKey: '',
};
