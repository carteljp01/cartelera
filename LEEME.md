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
- Con internet suena la radio en vivo (Atlántica FM 89.3; **R** pasa a FM Coronilla 102.3 y después a "mis canciones").
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

## Sin internet
La primera vez que se abre con internet, el cartel queda guardado en la PC.
Después funciona aunque no haya conexión, y se pone al día solo cuando vuelve.
Abrirlo siempre desde la dirección de GitHub Pages (no desde el archivo), en Chrome o Edge.

## Archivos
- `datos.js` — horarios y tarifas (lo único que se edita normalmente)
- `index.html`, `css/cartel.css`, `js/cartel.js` — el cartel
- `sw.js` — modo sin internet
- `fonts/` — fuentes LED (bigdots y triad)
