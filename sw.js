/* =========================================================
   Modo sin internet del cartel
   - La primera vez que se abre con internet guarda todo en la PC.
   - Con internet: siempre pide la versión más nueva (y la guarda).
   - Sin internet (o si la red tarda más de 4 s): usa la copia guardada.
   ========================================================= */
const CACHE = "cartel-cot";
const PRECARGA = [
  "./",
  "./index.html",
  "./datos.js",
  "./js/cartel.js",
  "./js/radio.js",
  "./js/remoto.js",
  "./control.html",
  "./control.webmanifest",
  "./img/icono-192.png",
  "./musica/lista.js",
  "./css/cartel.css",
  "./img/Cot_logo_Solo.svg",
  "./fonts/bigdots/BigDots.ttf",
  "./fonts/triad/Triad_xs.ttf",
  "./COT.ico",
];
const ESPERA_RED_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // uno por uno: si falta un archivo no se cae todo
      Promise.all(PRECARGA.map((url) => c.add(new Request(url, { cache: "reload" })).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Guarda sin el "?chequeo=..." para no llenar el disco de copias
const sinParametros = (url) => {
  const u = new URL(url);
  return u.origin + u.pathname;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const clave = sinParametros(req.url);

      // Canciones: si ya está guardada se usa la copia (no cambian y pesan)
      if (/\/musica\/.+\.(mp3|m4a|ogg|wav)$/i.test(clave)) {
        const guardada = await cache.match(clave);
        if (guardada) return guardada;
        const res = await fetch(clave);
        if (res.ok) await cache.put(clave, res.clone());
        return res;
      }
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, no) => setTimeout(() => no(new Error("lenta")), ESPERA_RED_MS)),
        ]);
        if (res && res.ok) cache.put(clave, res.clone());
        return res;
      } catch (err) {
        const guardada =
          (await cache.match(clave)) ||
          (req.mode === "navigate" ? await cache.match(sinParametros(new URL("./index.html", self.registration.scope).href)) : null);
        if (guardada) return guardada;
        throw err;
      }
    })()
  );
});
