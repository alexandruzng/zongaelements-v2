/* Calidad visual (alta / media / baja), compartida por todas las páginas.
   Se carga en el <head> sin defer para aplicar el modo antes del primer pintado.
   - alta: todo como está diseñado.
   - media: quita lo que más pesa a la tarjeta gráfica (ruido de pantalla completa,
     cristal esmerilado, desenfoques que se mueven, efectos que siguen al ratón).
   - baja: además apaga las animaciones decorativas en bucle y la intro. */
(() => {
  const KEY = "ze-quality", MODES = ["alta", "media", "baja"];
  const get = () => { try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : "alta"; } catch (e) { return "alta"; } };
  const root = document.documentElement;
  root.dataset.quality = get();

  const css = `
/* siempre: la capa de ruido no se anima, no hace falta que mida el doble de la pantalla */
.noise{inset:0!important;contain:strict}
/* media y baja */
:root:not([data-quality="alta"]) .noise{display:none!important}
:root:not([data-quality="alta"]) *,:root:not([data-quality="alta"]) *::before,:root:not([data-quality="alta"]) *::after{
  -webkit-backdrop-filter:none!important;backdrop-filter:none!important}
`;
  const st = document.createElement("style");
  st.id = "ze-quality-css"; st.textContent = css;
  document.head.appendChild(st);

  window.ZQ = {
    modes: MODES,
    get,
    set(v) {
      if (!MODES.includes(v)) return;
      try { localStorage.setItem(KEY, v); } catch (e) {}
      root.dataset.quality = v;
      dispatchEvent(new CustomEvent("ze-quality", { detail: v }));
    }
  };
})();
