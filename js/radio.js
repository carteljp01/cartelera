/* =========================================================
   Radio COT — música de fondo del cartel
   - Pasa en aleatorio los MP3 de la carpeta "musica" del repo.
   - No hace falta anotar los nombres: con internet lee la carpeta
     de GitHub sola y recuerda la lista para los días sin conexión.
   - Cada canción queda guardada en la PC: funciona sin internet.
   Teclas:  M = silenciar / activar   ·   + / - = volumen
   ========================================================= */
(function () {
  "use strict";

  const CFG = Object.assign(
    { activa: true, volumen: 0.4, segundosFundido: 3, repo: "" },
    (window.CARTEL || {}).musica
  );
  if (!CFG.activa) return;

  const CACHE = "cartel-cot";
  const CLAVE_LISTA = "radioLista";
  const CLAVE_VOL = "radioVolumen";
  const CLAVE_MUDO = "radioMudo";
  const WEB = location.protocol.startsWith("http");
  const EXT = /\.(mp3|m4a|ogg|wav)$/i;

  const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? def : v; } catch (e) { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let lista = [];
  let orden = [];
  let pos = 0;
  let fallosSeguidos = 0;
  let volumen = leer(CLAVE_VOL, CFG.volumen);
  let mudo = leer(CLAVE_MUDO, false);
  let bloqueada = false; // el navegador no deja sonar hasta que alguien toque una tecla
  let sonando = "";
  let urlBlob = null;
  let fundidoSalida = false;
  let animacion = null;

  const audio = new Audio();
  audio.preload = "auto";

  const volumenDeseado = () => (mudo ? 0 : volumen);
  const nombreBonito = (ruta) =>
    decodeURIComponent(ruta.split("/").pop()).replace(EXT, "").replace(/[_-]+/g, " ");

  /* ---------- Lista de canciones ---------- */

  function repoGithub() {
    if (CFG.repo) return CFG.repo;
    if (!location.hostname.endsWith(".github.io")) return "";
    const usuario = location.hostname.split(".")[0];
    const carpeta = location.pathname.split("/").filter(Boolean)[0];
    return carpeta && !carpeta.includes(".") ? `${usuario}/${carpeta}` : `${usuario}/${usuario}.github.io`;
  }

  async function obtenerLista() {
    let l = null;
    const repo = repoGithub();
    if (WEB && repo && navigator.onLine) {
      try {
        const r = await fetch(`https://api.github.com/repos/${repo}/contents/musica`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          l = j.filter((f) => f.type === "file" && EXT.test(f.name)).map((f) => "musica/" + f.name);
        } else if (r.status === 404) {
          l = []; // todavía no hay carpeta musica
        }
      } catch (e) {}
    }
    if (l) guardar(CLAVE_LISTA, l);
    else l = leer(CLAVE_LISTA, []);

    // Respaldo manual (sirve también abriendo desde la carpeta): musica/lista.js
    if (!l.length && Array.isArray(window.LISTA_MUSICA)) {
      l = window.LISTA_MUSICA.map((n) => (n.includes("/") ? n : "musica/" + n));
    }
    return l;
  }

  function mezclar() {
    orden = lista.map((_, i) => i);
    for (let i = orden.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    // que no se repita la misma canción al dar la vuelta
    if (orden.length > 1 && lista[orden[0]] === sonando) orden.push(orden.shift());
    pos = 0;
  }

  /* ---------- Reproducción ---------- */

  function fundir(hasta, segundos, alTerminar) {
    clearInterval(animacion);
    const desde = audio.volume;
    const pasos = Math.max(1, Math.round((segundos * 1000) / 50));
    let n = 0;
    animacion = setInterval(() => {
      n++;
      audio.volume = Math.min(1, Math.max(0, desde + ((hasta - desde) * n) / pasos));
      if (n >= pasos) {
        clearInterval(animacion);
        if (alTerminar) alTerminar();
      }
    }, 50);
  }

  async function siguiente() {
    if (!lista.length) return;
    if (pos >= orden.length) mezclar();
    const archivo = lista[orden[pos++]];
    fundidoSalida = false;
    try {
      let src = encodeURI(archivo);
      if (WEB) {
        // se baja entero: así queda guardado para los días sin internet
        const r = await fetch(src);
        if (!r.ok) throw new Error("no está");
        src = URL.createObjectURL(await r.blob());
      }
      if (urlBlob) URL.revokeObjectURL(urlBlob);
      urlBlob = src.startsWith("blob:") ? src : null;
      audio.src = src;
      audio.volume = 0;
      sonando = archivo;
      await reproducir();
      fallosSeguidos = 0;
    } catch (e) {
      fallosSeguidos++;
      // si fallan todas (p. ej. sin internet y nada guardado), reintenta en un rato
      setTimeout(siguiente, fallosSeguidos > lista.length ? 60000 : 1000);
    }
  }

  async function reproducir() {
    try {
      await audio.play();
      bloqueada = false;
      ocultarAvisoBloqueo();
      fundir(volumenDeseado(), CFG.segundosFundido);
    } catch (e) {
      if (e && e.name === "NotAllowedError") {
        bloqueada = true;
        mostrarAvisoBloqueo();
      } else {
        throw e;
      }
    }
  }

  audio.addEventListener("timeupdate", () => {
    const resta = audio.duration - audio.currentTime;
    if (!fundidoSalida && isFinite(resta) && resta < CFG.segundosFundido) {
      fundidoSalida = true;
      fundir(0, Math.max(0.2, resta));
    }
  });
  audio.addEventListener("ended", siguiente);
  audio.addEventListener("error", () => setTimeout(siguiente, 1000));

  /* ---------- Guardar canciones para usar sin internet ---------- */

  async function guardarTodasSinInternet() {
    if (!WEB || !("caches" in window)) return;
    const c = await caches.open(CACHE);
    const urls = lista.map((a) => new URL(encodeURI(a), location.href).href);
    // borrar las que ya no están en la carpeta
    for (const req of await c.keys()) {
      if (req.url.includes("/musica/") && EXT.test(req.url) && !urls.includes(req.url)) await c.delete(req);
    }
    // bajar de a una las que faltan (sin apurar la conexión)
    for (const u of urls) {
      if (!navigator.onLine) return;
      if (await c.match(u)) continue;
      try { const r = await fetch(u); if (r.ok) await r.blob(); } catch (e) {}
    }
  }

  /* ---------- Aviso si el navegador bloquea el sonido ---------- */

  let avisoBloqueo = null;
  function mostrarAvisoBloqueo() {
    if (avisoBloqueo) return;
    avisoBloqueo = document.createElement("div");
    avisoBloqueo.id = "avisoMusica";
    avisoBloqueo.textContent = "♪ Tocá cualquier tecla o hacé clic para activar la música";
    document.body.appendChild(avisoBloqueo);
  }
  function ocultarAvisoBloqueo() {
    if (avisoBloqueo) { avisoBloqueo.remove(); avisoBloqueo = null; }
  }
  const desbloquear = () => { if (bloqueada) reproducir().catch(() => {}); };
  document.addEventListener("keydown", desbloquear);
  document.addEventListener("pointerdown", desbloquear);

  /* ---------- Teclas ---------- */

  document.addEventListener("keydown", (e) => {
    if (e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === "m") {
      mudo = !mudo;
      guardar(CLAVE_MUDO, mudo);
      fundir(volumenDeseado(), 0.4);
      avisar(mudo ? "🔇 Música silenciada" : `🔊 Música activada · volumen ${Math.round(volumen * 100)}%`);
    }
    if (k === "+" || k === "=" || k === "-") {
      volumen = Math.min(1, Math.max(0.05, volumen + (k === "-" ? -0.05 : 0.05)));
      guardar(CLAVE_VOL, volumen);
      if (!mudo) fundir(volumen, 0.2);
      avisar(`🔊 Volumen ${Math.round(volumen * 100)}%`);
    }
  });

  function avisar(texto) {
    if (window.cartel && window.cartel.aviso) window.cartel.aviso(texto, "info", 2500);
  }

  /* ---------- Arranque ---------- */

  async function cargar() {
    const nueva = await obtenerLista();
    const cambio = nueva.join("|") !== lista.join("|");
    lista = nueva;
    if (cambio) {
      mezclar();
      if (!sonando || !lista.includes(sonando)) {
        audio.pause();
        siguiente();
      }
      guardarTodasSinInternet();
    }
  }

  cargar();
  setInterval(cargar, 30 * 60 * 1000); // revisa si subiste canciones nuevas
  window.addEventListener("online", () => setTimeout(cargar, 8000));

  window.radio = {
    estado() {
      if (!lista.length) return "Música: no hay canciones en la carpeta musica";
      if (bloqueada) return "Música: esperando que toquen una tecla";
      return `Música: ${mudo ? "silenciada" : "volumen " + Math.round(volumen * 100) + "%"} · ${lista.length} canciones · sonando «${nombreBonito(sonando)}»`;
    },
    siguiente,
  };
})();
