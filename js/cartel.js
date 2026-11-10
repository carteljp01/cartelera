/* =========================================================
   Cartel de horarios COT Chuy
   - Dibuja salidas, retornos y tarifas a partir de datos.js
   - Alterna las dos pantallas con transición en cascada
   - Funciona sin internet (sw.js guarda una copia en la PC)
   - Se actualiza solo cuando hay cambios publicados
   Teclas:  P = pausar / editar   ·   A = buscar actualización ya
            M = música sí/no      ·   + / - = volumen (ver radio.js)
   ========================================================= */
(function () {
  "use strict";

  const ORIGINAL = window.CARTEL;
  if (!ORIGINAL) {
    document.body.textContent = "No se pudo cargar datos.js";
    return;
  }

  const CLAVE_EDICIONES = "cartelEdiciones";
  const FIRMA = JSON.stringify(ORIGINAL);
  const EN_LINEA_POSIBLE = location.protocol.startsWith("http");
  const MINUTOS_ENTRE_CHEQUEOS = 5;

  let datos = cargarEdiciones() || clonar(ORIGINAL);
  let pausado = false;
  let indice = 0;
  let enTransicion = false;
  let ultimoChequeo = null;

  /* ---------------- Dibujo ---------------- */

  const LED = [
    0, 1, 1, 1, 0,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    0, 1, 1, 1, 0,
  ];
  const led = (color) =>
    `<span class="led8 ${color}">${LED.map((on) => `<span${on ? ' class="on"' : ""}></span>`).join("")}</span>`;

  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function panelHTML(tipo) {
    const lista = datos[tipo] || [];
    const titulo =
      tipo === "salidas"
        ? `${led("verde")}<span>SALIDAS DESDE <span data-editar="origen">${esc(datos.origen)}</span> A:</span>`
        : `${led("rojo")}<span>RETORNOS A <span data-editar="origen">${esc(datos.origen)}</span> DESDE:</span>`;

    const filas = lista
      .map(
        (f, i) => `
        <div class="fila" style="--i:${i + 1}">
          <span class="destino" data-editar="${tipo}.${i}.destino">${esc(f.destino)}</span>
          <span class="horas">${f.horas
            .map((h, j) => `<span class="hora" data-editar="${tipo}.${i}.horas.${j}">${esc(h)}</span>`)
            .join("")}</span>
        </div>`
      )
      .join("");

    return `
      <section class="panel" data-tipo="${tipo}">
        <div class="separador"></div>
        <h2 class="titulo" style="--i:0">${titulo}</h2>
        <div class="filas">${filas}</div>
      </section>`;
  }

  function dibujar() {
    const cont = document.getElementById("pantallas");
    cont.innerHTML = panelHTML("salidas") + panelHTML("retornos");
    cont.children[indice].classList.add("activo");

    const nota = document.getElementById("notaTarifas");
    if (nota) nota.textContent = datos.notaTarifas || "";

    document.getElementById("tarifas").innerHTML = datos.tarifas
      .map(
        (t, i) => `
        <div class="tarifa">
          <span class="nombre" data-editar="tarifas.${i}.destino">${esc(t.destino)}</span>
          <span class="precio">$ <span data-editar="tarifas.${i}.precio">${esc(t.precio)}</span></span>
        </div>`
      )
      .join("");
  }

  /* ---------------- Rotación ---------------- */

  const DURACION_SALIDA = 900; // ms hasta que se fue la última fila
  const DURACION_ENTRADA = 1200;

  function cambiarPantalla() {
    if (pausado || enTransicion || editando()) return;
    const paneles = document.querySelectorAll(".panel");
    if (paneles.length < 2) return;

    const actual = paneles[indice];
    indice = (indice + 1) % paneles.length;
    const siguiente = paneles[indice];

    enTransicion = true;
    actual.classList.add("sale");
    setTimeout(() => {
      actual.classList.remove("activo", "sale");
      siguiente.classList.add("activo", "entra");
      setTimeout(() => {
        siguiente.classList.remove("entra");
        enTransicion = false;
      }, DURACION_ENTRADA);
    }, DURACION_SALIDA);
  }

  /* ---------------- Reloj ---------------- */

  const DIAS = ["Dom.", "Lun.", "Mar.", "Mié.", "Jue.", "Vie.", "Sáb."];
  const dos = (n) => String(n).padStart(2, "0");
  function reloj() {
    const a = new Date();
    document.getElementById("reloj").textContent =
      `${DIAS[a.getDay()]} ${dos(a.getDate())}/${dos(a.getMonth() + 1)}\n${dos(a.getHours())}:${dos(a.getMinutes())}`;
  }

  /* ---------------- Edición rápida (clic sobre un dato) ----------------
     Sirve para un cambio de emergencia en esta pantalla.
     Queda guardado en esta PC hasta que se publique un datos.js nuevo;
     ahí se descarta y manda lo publicado. */

  function editando() {
    return !!document.querySelector('[contenteditable="true"]');
  }

  function clonar(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function cargarEdiciones() {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_EDICIONES));
      if (g && g.firma === FIRMA && g.datos) return g.datos;
      localStorage.removeItem(CLAVE_EDICIONES);
      localStorage.removeItem("cartelHorarios"); // ediciones del cartel viejo
    } catch (e) {}
    return null;
  }

  function guardarEdiciones() {
    try {
      localStorage.setItem(CLAVE_EDICIONES, JSON.stringify({ firma: FIRMA, datos }));
    } catch (e) {}
  }

  // Tarifas mandadas desde el control remoto
  function ponerTarifas(lista, nota) {
    if (!Array.isArray(lista)) return;
    const limpias = lista
      .map((t) => ({
        destino: String((t && t.destino) || "").trim().slice(0, 24),
        precio: Number(String((t && t.precio) || "").replace(/[^\d]/g, "")),
      }))
      .filter((t) => t.destino && t.precio > 0)
      .slice(0, 15);
    if (!limpias.length) return;
    datos.tarifas = limpias;
    if (typeof nota === "string") datos.notaTarifas = nota.trim().slice(0, 60);
    guardarEdiciones();
    dibujar();
    aviso("Tarifas actualizadas ✓", "info", 3000);
    informar();
  }

  // Descarta todos los cambios hechos en esta pantalla y vuelve a datos.js
  function volverAGithub() {
    try { localStorage.removeItem(CLAVE_EDICIONES); } catch (e) {}
    datos = clonar(ORIGINAL);
    dibujar();
    aviso("Precios restablecidos ✓", "info", 3000);
    informar();
  }

  function asignar(ruta, valor) {
    const partes = ruta.split(".");
    let obj = datos;
    for (let i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
    const ultima = partes[partes.length - 1];
    if (Array.isArray(obj) && valor === "") obj.splice(Number(ultima), 1); // hora borrada
    else if (ultima === "precio") obj[ultima] = valor.replace(/[^\d]/g, "") || obj[ultima];
    else obj[ultima] = valor;
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-editar]");
    if (!el) return;
    el.setAttribute("contenteditable", "true");
    el.focus();
  });

  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest('[contenteditable="true"]');
    if (el) {
      if (e.key === "Enter") { e.preventDefault(); el.blur(); }
      if (e.key === "Escape") { el.textContent = el.dataset.antes || el.textContent; el.blur(); }
      return; // mientras se escribe, P y A son letras normales
    }
    const k = e.key.toLowerCase();
    if (k === "p") alternarPausa();
    if (k === "a") buscarActualizacion(true);
  });

  document.addEventListener("focusin", (e) => {
    if (e.target.dataset && e.target.dataset.editar) e.target.dataset.antes = e.target.textContent;
  });

  document.addEventListener("focusout", (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.editar) return;
    el.removeAttribute("contenteditable");
    const nuevo = el.textContent.trim();
    if (nuevo === el.dataset.antes) return;
    asignar(el.dataset.editar, nuevo);
    guardarEdiciones();
    dibujar();
  });

  /* ---------------- Pausa y avisos ---------------- */

  let temporizadorAviso = null;
  function aviso(html, tipo, ms) {
    const a = document.getElementById("aviso");
    clearTimeout(temporizadorAviso);
    if (!html) { a.className = ""; return; }
    a.innerHTML = html;
    a.className = "visible " + (tipo || "");
    if (ms) temporizadorAviso = setTimeout(() => aviso(""), ms);
  }

  /* ---------------- Alerta grande (tapa los horarios) ----------------
     Se manda desde el control remoto. Queda guardada con su vencimiento,
     así si la tele se recarga la alerta sigue hasta que vence o se quita. */

  const CLAVE_ALERTA = "cartelAlerta";
  let alertaActual = null;
  let temporizadorAlerta = null;

  function alerta(texto, segundos, color) {
    texto = String(texto || "").trim().slice(0, 200);
    if (!texto) return quitarAlerta();
    const hasta = segundos > 0 ? Date.now() + segundos * 1000 : 0; // 0 = hasta quitarla
    alertaActual = { texto, hasta, color: color === "naranja" ? "naranja" : "rojo" };
    try { localStorage.setItem(CLAVE_ALERTA, JSON.stringify(alertaActual)); } catch (e) {}
    mostrarAlerta();
    informar();
  }

  function quitarAlerta() {
    alertaActual = null;
    clearTimeout(temporizadorAlerta);
    try { localStorage.removeItem(CLAVE_ALERTA); } catch (e) {}
    const el = document.getElementById("alerta");
    if (el) el.hidden = true;
    informar();
  }

  function mostrarAlerta() {
    const el = document.getElementById("alerta");
    if (!el || !alertaActual) return;
    clearTimeout(temporizadorAlerta);
    if (alertaActual.hasta && alertaActual.hasta <= Date.now()) return quitarAlerta();
    el.className = alertaActual.color;
    el.hidden = false;
    const t = document.getElementById("alertaTexto");
    t.textContent = alertaActual.texto;
    ajustarTexto(t);
    if (alertaActual.hasta) {
      temporizadorAlerta = setTimeout(quitarAlerta, Math.min(alertaActual.hasta - Date.now(), 2147483000));
    }
  }

  // Letra lo más grande posible sin que se salga del recuadro
  function ajustarTexto(t) {
    const caja = t.parentElement;
    let tam = 22; // en vh
    t.style.fontSize = tam + "vh";
    while (tam > 3 && (t.scrollHeight > caja.clientHeight || t.scrollWidth > caja.clientWidth)) {
      tam -= 0.5;
      t.style.fontSize = tam + "vh";
    }
  }
  window.addEventListener("resize", () => alertaActual && mostrarAlerta());

  function restaurarAlerta() {
    try { alertaActual = JSON.parse(localStorage.getItem(CLAVE_ALERTA)); } catch (e) { alertaActual = null; }
    if (alertaActual) mostrarAlerta();
  }

  function estadoConexion() {
    const red = navigator.onLine ? "con internet" : "sin internet (mostrando la copia guardada)";
    const chequeo = ultimoChequeo
      ? ` · último chequeo ${dos(ultimoChequeo.getHours())}:${dos(ultimoChequeo.getMinutes())}`
      : "";
    return EN_LINEA_POSIBLE ? red + chequeo : "abierto desde la carpeta (sin actualización automática)";
  }

  function alternarPausa(valor) {
    pausado = typeof valor === "boolean" ? valor : !pausado;
    document.body.classList.toggle("pausado", pausado);
    if (pausado) {
      aviso(
        `⏸ PAUSADO — MODO EDICIÓN<small>Clic en un dato para cambiarlo · P para seguir · A para buscar actualización · M música · +/- volumen<br>${estadoConexion()}${window.radio ? "<br>" + window.radio.estado() : ""}</small>`
      );
    } else {
      aviso("");
    }
    informar();
  }

  // El control remoto (js/remoto.js) se entera de los cambios por acá
  function informar() {
    if (window.remoto && window.remoto.informar) window.remoto.informar();
  }

  /* ---------------- Actualizador ----------------
     Cada 5 minutos (y apenas vuelve internet) compara los archivos
     publicados con los que se están mostrando. Si cambió algo,
     recarga la página sola. Si no hay internet, no hace nada. */

  const ARCHIVOS = ["datos.js", "js/cartel.js", "js/radio.js", "js/remoto.js", "css/cartel.css", "index.html"];
  let huella = null;

  async function leerPublicado() {
    const textos = await Promise.all(
      ARCHIVOS.map((f) =>
        fetch(`${f}?chequeo=${Date.now()}`, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(f);
          return r.text();
        })
      )
    );
    return textos.join("\n@@\n");
  }

  async function buscarActualizacion(manual) {
    if (!EN_LINEA_POSIBLE) {
      if (manual) aviso("Abierto desde la carpeta: no se puede actualizar solo", "", 4000);
      return;
    }
    if (manual) aviso("Buscando actualización…", "info");
    try {
      const actual = await leerPublicado();
      ultimoChequeo = new Date();
      if (huella === null) huella = actual;
      if (actual !== huella) {
        if (pausado && !manual) return; // no recargar en medio de una edición
        aviso("Hay una versión nueva. Actualizando…", "info");
        setTimeout(() => location.reload(), 1500);
        return;
      }
      if (manual) aviso(`Ya está al día ✓<small>${estadoConexion()}</small>`, "info", 4000);
    } catch (e) {
      if (manual) aviso(`No se pudo revisar<small>${estadoConexion()}</small>`, "", 4000);
    }
  }

  /* ---------------- Arranque ---------------- */

  dibujar();
  restaurarAlerta();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => alertaActual && mostrarAlerta());
  reloj();
  setInterval(reloj, 1000);
  setInterval(cambiarPantalla, (Number(datos.segundosPorPantalla) || 40) * 1000);

  if (EN_LINEA_POSIBLE && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  if (EN_LINEA_POSIBLE) {
    buscarActualizacion(false); // toma la "huella" de lo que se está mostrando
    setInterval(() => buscarActualizacion(false), MINUTOS_ENTRE_CHEQUEOS * 60 * 1000);
    window.addEventListener("online", () => setTimeout(() => buscarActualizacion(false), 5000));
  }

  // Para probar rápido desde la consola: cartel.cambiar()
  window.cartel = {
    cambiar: cambiarPantalla,
    actualizar: () => buscarActualizacion(true),
    aviso,
    pausar: alternarPausa,
    alerta,
    quitarAlerta,
    ponerTarifas,
    volverAGithub,
    informar,
    datos: () => ({
      pausado,
      pantalla: indice === 0 ? "Salidas" : "Retornos",
      alerta: alertaActual,
      tarifas: datos.tarifas,
      notaTarifas: datos.notaTarifas || "",
      editado: JSON.stringify(datos) !== FIRMA,
      enLinea: navigator.onLine,
      ultimoChequeo: ultimoChequeo ? `${dos(ultimoChequeo.getHours())}:${dos(ultimoChequeo.getMinutes())}` : "",
    }),
  };
})();
