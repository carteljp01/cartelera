/* =========================================================
   Radio COT — música de fondo del cartel
   - Radio en vivo (las de datos.js) cuando hay internet.
   - Si se corta internet o la radio se cae, pasa sola a los MP3
     de la carpeta "musica" y vuelve a la radio cuando se puede.
   - Los MP3 se guardan en la PC: suenan aunque no haya internet.
     No hace falta anotar los nombres: lee la carpeta de GitHub sola.
   Teclas:  M = silenciar / activar   ·   + / - = volumen
            R = cambiar de radio (… → mis canciones → …)
   YouTube: una "radio" puede ser un link de YouTube (video o lista).
   Suena solo el audio y se silencia sola mientras pasa un anuncio.
   ========================================================= */
(function () {
  "use strict";

  const CFG = Object.assign(
    { activa: true, volumen: 0.25, segundosFundido: 3, repo: "", radios: [] },
    (window.CARTEL || {}).musica
  );
  if (!CFG.activa) return;

  // Radios: las de datos.js + las agregadas desde el control (guardadas en esta PC)
  const CLAVE_EXTRAS = "radiosExtra";
  const BASE = (Array.isArray(CFG.radios) ? CFG.radios : []).filter((r) => r && (r.url || r.youtube));
  const RADIOS = [];
  function armarRadios() {
    let extras = [];
    try { extras = JSON.parse(localStorage.getItem(CLAVE_EXTRAS)) || []; } catch (e) {}
    RADIOS.length = 0;
    BASE.forEach((r) => RADIOS.push(r));
    extras.filter((r) => r && r.url && r.nombre).forEach((r) => RADIOS.push(Object.assign({ extra: true }, r)));
  }
  armarRadios();
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
      cambio();
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
    const idYt = ytDe(r);
    if (idYt) {
      if (siguienteEnlace) pasarALocal();
      else arrancarYoutube(r, idYt);
      return;
    }
    pararYoutube();
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
    pararYoutube();
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

  /* ---------- YouTube (solo el audio) ---------- */
  // Acepta links de video (watch?v=, youtu.be, shorts, live) y de listas (list=)
  function idYoutube(u) {
    u = String(u || "").trim();
    if (!/youtube\.com|youtu\.be/i.test(u)) return null;
    const l = /[?&]list=([\w-]+)/.exec(u);
    const v = /(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(u);
    if (!l && !v) return null;
    return { v: v ? v[1] : "", list: l ? l[1] : "" };
  }
  const ytDe = (r) => (r ? idYoutube(r.youtube) || idYoutube(Array.isArray(r.url) ? r.url[0] : r.url) : null);

  // anuncio = true también al arrancar: queda en silencio hasta que el video
  // de verdad empieza a avanzar (así no suena el anuncio del principio).
  const yt = { p: null, caja: null, anuncio: true, quieto: 0, ultimo: -1, espera: null, errores: 0 };

  function cargarApiYT() {
    return new Promise((ok, mal) => {
      if (window.YT && window.YT.Player) return ok();
      const listos = window._ytListos || (window._ytListos = []);
      listos.push(ok);
      if (!window._ytCargando) {
        window._ytCargando = true;
        const antes = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (antes) try { antes(); } catch (e) {}
          (window._ytListos || []).splice(0).forEach((f) => f());
        };
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.onerror = () => { window._ytCargando = false; s.remove(); };
        document.head.appendChild(s);
      }
      setTimeout(() => (window.YT && window.YT.Player ? ok() : mal(new Error("YouTube no carga"))), 15000);
    });
  }

  function volumenYT() {
    if (!yt.p || !yt.p.setVolume) return;
    const v = yt.anuncio ? 0 : volumenDeseado();
    try {
      if (v <= 0) yt.p.mute();
      else { yt.p.unMute(); yt.p.setVolume(Math.round(v * 100)); }
    } catch (e) {}
  }

  function pararYoutube() {
    clearTimeout(yt.espera);
    if (yt.p) { try { yt.p.destroy(); } catch (e) {} }
    if (yt.caja) yt.caja.remove();
    Object.assign(yt, { p: null, caja: null, anuncio: true, quieto: 0, ultimo: -1, errores: 0 });
  }

  async function arrancarYoutube(r, id) {
    clearTimeout(reintento);
    pararYoutube();
    modo = "vivo";
    sonando = r.nombre || "YouTube";
    audio.pause();
    audio.removeAttribute("src");
    soltarBlob();
    try { await cargarApiYT(); } catch (e) { pasarALocal(); return; }
    if (modo !== "vivo" || RADIOS[elegida] !== r) return;
    // El reproductor existe pero no se ve: queda detrás del cartel
    yt.caja = document.createElement("div");
    yt.caja.id = "ytAudio";
    yt.caja.setAttribute("aria-hidden", "true");
    yt.caja.style.cssText = "position:fixed;right:0;bottom:0;width:200px;height:200px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden";
    const dentro = document.createElement("div");
    yt.caja.appendChild(dentro);
    document.body.appendChild(yt.caja);
    const pv = { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, loop: 1 };
    if (id.list) { pv.listType = "playlist"; pv.list = id.list; } else { pv.playlist = id.v; }
    yt.p = new YT.Player(dentro, {
      width: 200, height: 200,
      videoId: id.v || undefined,
      playerVars: pv,
      events: {
        onReady: (e) => {
          volumenYT();
          try { if (id.list) e.target.setShuffle(true); e.target.playVideo(); } catch (x) {}
          clearTimeout(yt.espera);
          yt.espera = setTimeout(() => {
            if (yt.p && yt.p.getPlayerState && yt.p.getPlayerState() !== 1) { bloqueada = true; mostrarAvisoBloqueo(); cambio(); }
          }, 8000);
        },
        onStateChange: (e) => {
          if (e.data === 1) {
            yt.errores = 0;
            if (bloqueada) { bloqueada = false; ocultarAvisoBloqueo(); }
            cambio();
          }
          if (e.data === 0 && !id.list) { try { e.target.playVideo(); } catch (x) {} }
        },
        onError: () => {
          // en una lista salta al siguiente; si falla todo, pasa a las canciones propias
          // (muchos videos oficiales de música no dejan reproducirse fuera de YouTube:
          //  se prueba toda la lista antes de rendirse)
          yt.errores++;
          let total = 0;
          try { total = (yt.p.getPlaylist() || []).length; } catch (x) {}
          if (id.list && yt.errores < Math.max(5, total)) { try { yt.p.nextVideo(); } catch (x) {} return; }
          avisar("⚠ Ese video de YouTube no se puede pasar fuera de YouTube");
          pasarALocal();
        },
      },
    });
  }

  // Anuncios: mientras pasa uno, el reproductor dice "reproduciendo" pero el
  // tiempo del video no avanza. Si queda así más de 1,5 s, se silencia.
  setInterval(() => {
    if (!yt.p || !yt.p.getPlayerState) return;
    let st, t;
    try { st = yt.p.getPlayerState(); t = yt.p.getCurrentTime(); } catch (e) { return; }
    const avanza = Math.abs(t - yt.ultimo) >= 0.05 && yt.ultimo >= 0;
    if (st === 1) yt.quieto = avanza ? 0 : yt.quieto + 0.5;
    yt.ultimo = t;
    const anuncio = yt.anuncio ? !(st === 1 && avanza) : yt.quieto >= 1.5;
    if (anuncio !== yt.anuncio) { yt.anuncio = anuncio; volumenYT(); cambio(); }
  }, 500);

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
  const desbloquear = () => {
    if (!bloqueada) return;
    if (yt.p) { try { yt.p.playVideo(); volumenYT(); } catch (e) {} return; }
    reproducir().catch(() => (modo === "vivo" ? pasarALocal() : null));
  };
  document.addEventListener("keydown", desbloquear);
  document.addEventListener("pointerdown", desbloquear);

  /* ---------- Teclas ---------- */

  // Agregar / quitar radios desde el control remoto
  const esHttps = (u) => /^https:\/\/[^\s]+$/i.test(u);
  function agregarRadio(r) {
    const nombre = String((r && r.nombre) || "").trim().slice(0, 40);
    const urls = (Array.isArray(r && r.url) ? r.url : [r && r.url]).map((u) => String(u || "").trim()).filter(esHttps).slice(0, 3);
    if (!nombre || !urls.length) { avisar("⚠ Ese enlace de radio no sirve (tiene que empezar con https)"); return; }
    if (/youtube\.com|youtu\.be/i.test(urls[0]) && !idYoutube(urls[0])) { avisar("⚠ Ese link de YouTube no sirve: copiá el de un video o una lista"); return; }
    let extras = [];
    try { extras = JSON.parse(localStorage.getItem(CLAVE_EXTRAS)) || []; } catch (e) {}
    if (extras.length >= 12) { avisar("⚠ Ya hay demasiadas radios agregadas"); return; }
    const eraMisCanciones = !quiereVivo();
    extras.push({ nombre, url: urls.length === 1 ? urls[0] : urls });
    guardar(CLAVE_EXTRAS, extras);
    armarRadios();
    if (eraMisCanciones) { elegida = RADIOS.length; guardar(CLAVE_EMISORA, elegida); }
    avisar(`📻 Radio agregada: ${nombre}`);
    elegirRadio(RADIOS.length - 1); // la pone a sonar para probarla
  }
  function quitarRadio(i) {
    i = Number(i);
    const r = RADIOS[i];
    if (!r || !r.extra) return;
    let extras = [];
    try { extras = JSON.parse(localStorage.getItem(CLAVE_EXTRAS)) || []; } catch (e) {}
    extras.splice(i - BASE.length, 1);
    guardar(CLAVE_EXTRAS, extras);
    const sonabaEsta = elegida === i;
    armarRadios();
    if (elegida > i) elegida--;
    guardar(CLAVE_EMISORA, elegida);
    avisar(`Radio quitada: ${r.nombre}`);
    if (sonabaEsta) elegirRadio(0); else cambio();
  }

  function nombreElegida() {
    return quiereVivo() ? RADIOS[elegida].nombre : "Mis canciones";
  }

  // Acciones (las usan el teclado y el control remoto)
  function alternarMudo(valor) {
    mudo = typeof valor === "boolean" ? valor : !mudo;
    guardar(CLAVE_MUDO, mudo);
    fundir(volumenDeseado(), 0.4);
    volumenYT();
    avisar(mudo ? "🔇 Música silenciada" : `🔊 Música activada · volumen ${Math.round(volumen * 100)}%`);
    cambio();
  }
  function ponerVolumen(v) {
    volumen = Math.min(1, Math.max(0.05, Number(v) || 0));
    guardar(CLAVE_VOL, volumen);
    if (!mudo) fundir(volumen, 0.2);
    volumenYT();
    avisar(`🔊 Volumen ${Math.round(volumen * 100)}%`);
    cambio();
  }
  function elegirRadio(i) {
    if (!RADIOS.length && i !== 0) return;
    elegida = ((Number(i) % (RADIOS.length + 1)) + RADIOS.length + 1) % (RADIOS.length + 1);
    guardar(CLAVE_EMISORA, elegida);
    avisar(`📻 ${nombreElegida()}`);
    fundir(0, 0.3, () => { decidir(); setTimeout(cambio, 3000); });
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === "m") alternarMudo();
    if (k === "+" || k === "=") ponerVolumen(volumen + 0.05);
    if (k === "-") ponerVolumen(volumen - 0.05);
    if (k === "r" && RADIOS.length) elegirRadio(elegida + 1);
  });

  // Avisa al control remoto que algo cambió
  function cambio() {
    if (window.cartel && window.cartel.informar) window.cartel.informar();
  }

  function avisar(texto) {
    if (window.cartel && window.cartel.aviso) window.cartel.aviso(texto, "info", 2500);
  }

  /* ---------- Arranque ---------- */

  async function cargar() {
    const nueva = await obtenerLista();
    const distinta = nueva.join("|") !== lista.join("|");
    lista = nueva;
    if (distinta) {
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
      if (modo === "vivo" && ytDe(RADIOS[elegida])) return `Música: ▶ ${sonando} (YouTube) · ${yt.anuncio ? "anuncio o cargando, en silencio" : vol} · R cambia de radio`;
      if (modo === "vivo") return `Música: 📻 ${sonando} en vivo · ${vol} · R cambia de radio`;
      if (!lista.length) {
        return quiereVivo()
          ? `Música: sin conexión con ${nombreElegida()} y sin canciones propias · reintenta cada 2 min`
          : "Música: no hay canciones en la carpeta musica";
      }
      const extra = quiereVivo() ? ` · sin conexión con ${nombreElegida()}, reintenta cada 2 min` : "";
      return `Música: ${vol} · sonando «${nombreBonito(sonando)}»${extra}`;
    },
    datos() {
      return {
        radios: RADIOS.map((r) => r.nombre),
        tipos: RADIOS.map((r) => (ytDe(r) ? "youtube" : "radio")),
        fijas: BASE.length,
        elegida,
        modo,
        sonando: modo === "vivo" ? sonando : sonando ? nombreBonito(sonando) : "",
        volumen: Math.round(volumen * 100),
        mudo,
        bloqueada,
        youtube: modo === "vivo" && !!ytDe(RADIOS[elegida]),
        anuncio: !!yt.p && yt.anuncio,
        canciones: lista.length,
      };
    },
    alternarMudo,
    ponerVolumen,
    elegirRadio,
    siguienteRadio: () => elegirRadio(elegida + 1),
    agregarRadio,
    quitarRadio,
    siguiente,
  };
})();
