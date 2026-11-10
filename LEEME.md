# Cartel de horarios — COT Chuy

## Cambiar horarios o precios
1. En GitHub abrí `datos.js` → lápiz (Edit).
2. Cambiá lo que necesites (respetá comillas y comas).
3. **Commit changes**.
4. En unos 5–10 minutos todas las pantallas con internet se actualizan solas.

## En la pantalla
- **P**: pausar la rotación / modo edición (muestra si hay internet y el último chequeo).
- **A**: buscar actualización ahora.
- Clic en un dato (con P): cambio rápido solo en esa pantalla. Se descarta cuando se publica un `datos.js` nuevo.

## Radio COT (música)
- Con internet suena la radio en vivo (Océano FM 93.9, 80s y 90s; **R** pasa a Atlántica FM 89.3, FM Coronilla 102.3 y "mis canciones").
  Las radios se cambian en `datos.js` → `musica.radios` (el enlace tiene que empezar con https).
- Sin internet, o si la radio se cae, pasa sola a los MP3 de la carpeta `musica` y reintenta la radio cada 2 minutos.
- Subí los MP3 a la carpeta `musica` del repo (Add file → Upload files). No hace falta anotar nada más.
- Pasan en aleatorio con fundido entre canciones. Se guardan en la PC: suenan aunque no haya internet.
- Canciones nuevas aparecen solas en hasta 30 minutos (o recargando la página).
- **M** silencia / activa · **+ / -** volumen. Apagarla del todo: en `datos.js`, `musica: { activa: false }`.
- Si al encender aparece "Tocá cualquier tecla para activar la música", es el navegador pidiendo permiso:
  tocá una tecla, o en Brave: candado de la barra → Configuración del sitio → Reproducción automática → Permitir.
- Usar solo música con licencia que permita pasarla en un local (por ejemplo Creative Commons CC BY o CC0)
  y anotar autor y título en `musica/creditos.txt`.

## Control remoto (desde el celular)
- Página: `control.html` → cambiar radio, volumen, silenciar, pausar, cambiar pantalla, buscar cambios y recargar.
- **Tarifas desde el control**: cambiar precios o nombres al instante (queda guardado en esa tele). "Volver a las de GitHub" deshace. Para dejarlo fijo, cargarlo en `datos.js`.
- **Aviso en la tele**: tapa todo el recuadro de horarios (rojo = alerta, naranja = aviso). Duración: 1, 5, 15, 30 min, 1 hora o hasta quitarlo.
  Si la tele se recarga, el aviso sigue hasta que vence. Se quita con QUITAR AVISO.
- Usa ntfy.sh (gratis) con un código secreto. **El código no está en GitHub**:
  - En la tele se abre una sola vez: `carteljp01.github.io/cartelera/?control=CÓDIGO`
  - En el celular: `carteljp01.github.io/cartelera/control.html?c=CÓDIGO`
  - Cada uno lo guarda para siempre. Para desactivar el control en la tele: `?control=no`.
- Si la tele no tiene internet, las órdenes no llegan (el cartel sigue funcionando igual).

## Sin internet
La primera vez que se abre con internet, el cartel queda guardado en la PC.
Después funciona aunque no haya conexión, y se pone al día solo cuando vuelve.
Abrirlo siempre desde la dirección de GitHub Pages (no desde el archivo), en Chrome o Edge.

## Archivos
- `datos.js` — horarios y tarifas (lo único que se edita normalmente)
- `index.html`, `css/cartel.css`, `js/cartel.js` — el cartel
- `sw.js` — modo sin internet
- `fonts/` — fuentes LED (bigdots y triad)
