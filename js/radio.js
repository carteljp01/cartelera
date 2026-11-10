/* =========================================================
   Radio COT — música de fondo del cartel
   - Radio en vivo (las de datos.js) cuando hay internet.
   - Si se corta internet o la radio se cae, pasa sola a los MP3
     de la carpeta "musica" y vuelve a la radio cuando se puede.
   - Los MP3 se guardan en la PC: suenan aunque no haya internet.
     No hace falta anotar los nombres: lee la carpeta de GitHub sola.
   Teclas:  M = silenciar / activar   ·   + / - = volumen
            R = cambiar de radio (… → mis canciones → …)
   ========================================================= */
(function () {
  "use strict";

  const CFG = Object.assign(
    { activa: true, volumen: 0.25, segundosFundido: 3, repo: "", radios: [] },
    (window.CARTEL || {}).musica
  );
  if (!CFG.activa) return;

  const RADIOS = (Array.isArray(CFG.radios) ? CFG.radios : []).filter((r) => r && r.url);
  const CACHE = "cartel-cot";
  const CLAVE_LISTA = "radioLista";
  const CLAVE_VOL = "radioVolumen";
  const CLAVE_MUDO = "radioMudo";
  const CLAVE_EMISORA = "radioEmisora";
  const WEB = location.protocol.startsWith("http");
  const EXT = /\.(mp3|m4a|ogg|wav)$/i;
  const REINTENTO_RADIO_MS = 2 * 60 * 1000;

  const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? def : v; } catch (e) { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let lista = [];
  let orden = [];
  let pos = 0;
  let fallosSeguidos = 0;
  let volumen = leer(CLAVE_VOL, CFG.volumen);
  let mudo = leer(CLAVE_MUDO, false);
  let elegida = Math.min(leer(CLAVE_EMISORA, 0), RADIOS.length); // RADIOS.length = "mis canciones"
  let modo = null; // "vivo" | "local"
  let bloqueada = false; // el navegador no deja sonar hasta que alguien toque una tecla
  let sonando = "";
  let urlBlob = null;
  let fundidoSalida = false;
  let animacion = null;
  let reintento = null;

  const audio = new Audio();
  audio.preload = "auto";

  const volumenDeseado = () => (mudo ? 0 : volumen);
  const quiereVivo = () => elegida < RADIOS.length;
  const nombreBonito = (ruta) =>
    decodeURIComponent(ruta.split("/").pop()).replace(EXT, "").replace(/[_-]+/g, " ");

  /* ---------- Lista de canciones propias ---------- */

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
          l = [];
        }
      } catch (e) {}
    }
    if (l) guardar(CLAVE_LISTA, l);
    else l = leer(CLAVE_LISTA, []);
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
    if (orden.length > 1 && lista[orden[0]] === sonando) orden.push(orden.shift());
    pos = 0;
  }

  /* ---------- Volumen ---------- */

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

  function soltarBlob() {
    if (urlBlob) { URL.revokeObjectURL(urlBlob); urlBlob = null; }
  }

  /* ---------- Radio en vivo ---------- */

  // Una radio puede tener varios enlaces: si uno falla prueba el siguiente
  let enlace = 0;
  const enlacesDe = (r) => (Array.isArray(r.url) ? r.url : [r.url]);

  async function arrancarVivo(siguienteEnlace) {
    const r = RADIOS[elegida];
    const enlaces = enlacesDe(r);
    enlace = siguienteEnlace ? enlace + 1 : 0;
    if (enlace >= enlaces.length) { pasarALocal(); return; }
    clearTimeout(reintento);
    modo = "vivo";
    sonando = r.nombre || enlaces[enlace];
    soltarBlob();
    audio.src = enlaces[enlace];
    audio.volume = 0;
    try {
      await reproducir();
    } catch (e) {
      falloVivo();
    }
  }

  function falloVivo() {
    if (enlace + 1 < enlacesDe(RADIOS[elegida]).length) arrancarVivo(true);
    else pasarALocal();
  }

  function pasarALocal() {
    if (modo === "local") return;
    modo = "local";
    sonando = "";
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    siguiente();
    programarReintento();
  }

  function programarReintento() {
    clearTimeout(reintento);
    if (!quiereVivo()) return;
    reintento = setTimeout(() => {
      if (quiereVivo() && modo !== "vivo" && navigator.onLine) arrancarVivo();
      else programarReintento();
    }, REINTENTO_RADIO_MS);
  }

  // Si la radio se queda "colgada" (sin avanzar) más de 20 s, pasa a las canciones propias
  let ultimoTiempo = 0;
  let quieto = 0;
  setInterval(() => {
    if (modo !== "vivo" || bloqueada || audio.paused) { quieto = 0; return; }
    if (audio.currentTime === ultimoTiempo) quieto += 5;
    else quieto = 0;
    ultimoTiempo = audio.currentTime;
    if (quieto >= 20) { quieto = 0; falloVivo(); }
  }, 5000);

  /* ---------- Canciones propias ---------- */

  async function siguiente() {
    if (modo !== "local" || !lista.length) return;
    if (pos >= orden.length) mezclar();
    const archivo = lista[orden[pos++]];
    fundidoSalida = false;
    try {
      let src = encodeURI(archivo);
      if (WEB) {
        const r = await fetch(src);
        if (!r.ok) throw new Error("no está");
        src = URL.createObjectURL(await r.blob());
      }
      if (modo !== "local") { if (src.startsWith("blob:")) URL.revokeObjectURL(src); return; }
      soltarBlob();
      urlBlob = src.startsWith("blob:") ? src : null;
      audio.src = src;
      audio.volume = 0;
      sonando = archivo;
      await reproducir();
      fallosSeguidos = 0;
    } catch (e) {
      fallosSeguidos++;
      setTimeout(siguiente, fallosSeguidos > lista.length ? 60000 : 1000);
    }
  }

  audio.addEventListener("timeupdate", () => {
    if (modo !== "local") return;
    const resta = audio.duration - audio.currentTime;
    if (!fundidoSalida && isFinite(resta) && resta < CFG.segundosFundido) {
      fundidoSalida = true;
      fundir(0, Math.max(0.2, resta));
    }
  });
  audio.addEventListener("ended", () => (modo === "vivo" ? falloVivo() : siguiente()));
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    if (modo === "vivo") falloVivo();
    else setTimeout(siguiente, 1000);
  });

  async function guardarTodasSinInternet() {
    if (!WEB || !("caches" in window)) return;
    const c = await caches.open(CACHE);
    const urls = lista.map((a) => new URL(encodeURI(a), location.href).href);
    for (const req of await c.keys()) {
      if (req.url.includes("/musica/") && EXT.test(req.url) && !urls.includes(req.url)) await c.delete(req);
    }
    for (const u of urls) {
      if (!navigator.onLine) return;
      if (await c.match(u)) continue;
      try { const r = await fetch(u); if (r.ok) await r.blob(); } catch (e) {}
    }
  }

  /* ---------- Qué suena ---------- */

  function decidir() {
    clearTimeout(reintento);
    if (quiereVivo() && navigator.onLine) {
      arrancarVivo();
    } else {
      modo = null;
      pasarALocal();
    }
  }

  window.addEventListener("offline", () => { if (modo === "vivo") pasarALocal(); });
  window.addEventListener("online", () => {
    setTimeout(() => { if (quiereVivo() && modo !== "vivo") arrancarVivo(); }, 5000);
    setTimeout(cargar, 8000);
  });

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
  const desbloquear = () => { if (bloqueada) reproducir().catch(() => (modo === "vivo" ? pasarALocal() : null)); };
  document.addEventListener("keydown", desbloquear);
  document.addEventListener("pointerdown", desbloquear);

  /* ---------- Teclas ---------- */

  function nombreElegida() {
    return quiereVivo() ? RADIOS[elegida].nombre : "Mis canciones";
  }

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
    if (k === "r" && RADIOS.length) {
      elegida = (elegida + 1) % (RADIOS.length + 1);
      guardar(CLAVE_EMISORA, elegida);
      avisar(`📻 ${nombreElegida()}`);
      fundir(0, 0.3, decidir);
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
      if (modo === "local" && (!sonando || !lista.includes(sonando))) {
        audio.pause();
        siguiente();
      }
      guardarTodasSinInternet();
    }
  }

  decidir();
  cargar();
  setInterval(cargar, 30 * 60 * 1000);

  window.radio = {
    estado() {
      const vol = mudo ? "silenciada" : "volumen " + Math.round(volumen * 100) + "%";
      if (bloqueada) return "Música: esperando que toquen una tecla";
      if (modo === "vivo") return `Música: 📻 ${sonando} en vivo · ${vol} · R cambia de radio`;
      if (!lista.length) {
        return quiereVivo()
          ? `Música: sin conexión con ${nombreElegida()} y sin canciones propias · reintenta cada 2 min`
          : "Música: no hay canciones en la carpeta musica";
      }
      const extra = quiereVivo() ? ` · sin conexión con ${nombreElegida()}, reintenta cada 2 min` : "";
      return `Música: ${vol} · sonando «${nombreBonito(sonando)}»${extra}`;
    },
    siguiente,
  };
})();
