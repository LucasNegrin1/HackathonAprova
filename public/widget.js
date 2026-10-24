/*
 * Widget de atendimento Aprova.
 * Instale com uma linha no site:
 *   <script src="https://SEU_HOST/widget.js" data-conta="Nome da prefeitura" async></script>
 * data-conta (opcional) fixa a conta do chamado. Sem ele, o usuário escolhe a prefeitura.
 */
(function () {
  if (window.__aprovaWidget) return;
  window.__aprovaWidget = true;

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var origem = new URL(script.src, location.href).origin;
  var conta = script.getAttribute("data-conta") || "";

  var botao = document.createElement("button");
  botao.type = "button";
  botao.setAttribute("aria-label", "Abrir atendimento");
  botao.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  botao.style.cssText = "position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;background:#047857;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center";

  var quadro = document.createElement("iframe");
  quadro.title = "Atendimento Aprova";
  quadro.src = origem + "/widget" + (conta ? "?conta=" + encodeURIComponent(conta) : "");
  quadro.allow = "clipboard-write";
  quadro.style.cssText = "position:fixed;right:20px;bottom:92px;width:380px;height:600px;max-height:calc(100vh - 112px);border:0;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);z-index:2147483647;display:none;background:#fff";

  // Celular: o chat ocupa a tela inteira.
  function ajustar() {
    if (window.innerWidth < 480) {
      quadro.style.right = "0"; quadro.style.bottom = "0"; quadro.style.width = "100vw";
      quadro.style.height = "100dvh"; quadro.style.maxHeight = "none"; quadro.style.borderRadius = "0";
    } else {
      quadro.style.right = "20px"; quadro.style.bottom = "92px"; quadro.style.width = "380px";
      quadro.style.height = "600px"; quadro.style.maxHeight = "calc(100vh - 112px)"; quadro.style.borderRadius = "16px";
    }
  }

  var aberto = false;
  function alternar(abrir) {
    aberto = typeof abrir === "boolean" ? abrir : !aberto;
    quadro.style.display = aberto ? "block" : "none";
    botao.style.display = aberto && window.innerWidth < 480 ? "none" : "flex";
    botao.setAttribute("aria-label", aberto ? "Fechar atendimento" : "Abrir atendimento");
  }

  botao.addEventListener("click", function () { alternar(); });
  window.addEventListener("resize", ajustar);
  window.addEventListener("message", function (e) {
    if (e.origin === origem && e.data && e.data.tipo === "aprova-widget-fechar") alternar(false);
  });

  ajustar();
  document.body.appendChild(quadro);
  document.body.appendChild(botao);
})();
