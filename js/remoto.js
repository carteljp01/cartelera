/* =========================================================
   Control remoto del cartel (lado de la tele)
   - Escucha órdenes que manda control.html desde el celular.
   - Usa ntfy.sh (gratis) con un canal de nombre secreto.
   - El secreto NO está en GitHub: se carga una sola vez abriendo
       carteljp01.github.io/cartelera/?control=EL_SECRETO
     y queda guardado en esta PC.
   ========================================================= */
(function () {
  "use strict";

  const SERVIDOR = window.CONTROL_SERVIDOR || "https://ntfy.sh";
  const CLAVE = "cartelControl";

  // ?control=xxxx  → guardar y limpiar la barra de direcciones
  try {
    const u = new URL(location.href);
    const nuevo = u.searchParams.get("control");
    if (nuevo !== null) {
      if (nuevo === "" || nuevo === "no") localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, nuevo.trim());
      u.searchParams.delete("control");
      history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    }
  } catch (e) {}

  let secreto = null;
  try { secreto = localStorage.getItem(CLAVE); } catch (e) {}
  if (!secreto || !location.protocol.startsWith("http")) return;

  const canalOrdenes = `${SERVIDOR}/${encodeURIComponent(secreto)}`;
  const canalEstado = `${SERVIDOR}/${encodeURIComponent(secreto)}-estado`;

  /* ---------- Contar a qué está la tele ---------- */

  function foto() {
    return Object.assign(
      { hora: new Date().toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }) },
      window.cartel && window.cartel.datos ? window.cartel.datos() : {},
      window.radio && window.radio.datos ? { radio: window.radio.datos() } : {}
    );
  }

  let espera = null;
  let ultimoEnviado = "";
  function informar(forzar) {
    clearTimeout(espera);
    // agrupa cambios seguidos en un solo mensaje (el servicio limita la cantidad)
    espera = setTimeout(() => {
      const f = foto();
      const firma = JSON.stringify(Object.assign({}, f, { hora: "" }));
      if (!forzar && firma === ultimoEnviado) return;
      ultimoEnviado = firma;
      fetch(canalEstado, { method: "POST", body: JSON.stringify(f) }).catch(() => {});
    }, 1200);
  }

  /* ---------- Recibir órdenes ---------- */

  function ejecutar(orden) {
    const c = window.cartel || {};
    const r = window.radio || {};
    switch (orden.cmd) {
      case "estado": informar(true); return;
      case "radio": r.elegirRadio && r.elegirRadio(orden.valor); return;
      case "radio-agregar": r.agregarRadio && r.agregarRadio(orden.valor); return;
      case "radio-quitar": r.quitarRadio && r.quitarRadio(orden.valor); return;
      case "radio-siguiente": r.siguienteRadio && r.siguienteRadio(); return;
      case "mudo": r.alternarMudo && r.alternarMudo(orden.valor); return;
      case "volumen": r.ponerVolumen && r.ponerVolumen(Number(orden.valor) / 100); return;
      case "pausa": c.pausar && c.pausar(orden.valor); return;
      case "pantalla": c.cambiar && c.cambiar(); setTimeout(() => informar(true), 2500); return;
      case "actualizar": c.actualizar && c.actualizar(); return;
      case "recargar": location.reload(); return;
      case "alerta": {
        const v = orden.valor || {};
        c.alerta && c.alerta(v.texto, Number(v.segundos) || 0, v.color);
        return;
      }
      case "quitar-alerta": c.quitarAlerta && c.quitarAlerta(); return;
      case "tarifas": {
        const v = orden.valor || {};
        c.ponerTarifas && c.ponerTarifas(v.tarifas, v.nota);
        return;
      }
      case "volver-github": c.volverAGithub && c.volverAGithub(); return;
    }
  }

  let fuente = null;
  function conectar() {
    if (fuente) fuente.close();
    fuente = new EventSource(`${canalOrdenes}/sse`);
    fuente.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.event !== "message") return;
        const orden = JSON.parse(m.message);
        // descarta órdenes viejas (más de 2 minutos)
        if (m.time && Date.now() / 1000 - m.time > 120) return;
        ejecutar(orden);
      } catch (e) {}
    };
    // EventSource reintenta solo; si el navegador lo cierra, lo reabrimos
    fuente.onerror = () => {
      if (fuente.readyState === EventSource.CLOSED) setTimeout(conectar, 30000);
    };
  }

  conectar();
  window.addEventListener("online", () => setTimeout(conectar, 3000));
  setTimeout(() => informar(true), 8000);

  window.remoto = { informar: () => informar(false) };
})();
