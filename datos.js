/* =========================================================
   DATOS DEL CARTEL  —  COT Agencia Chuy
   ---------------------------------------------------------
   Para cambiar horarios o precios se edita SOLO este archivo.
   Cuando lo subís a GitHub, las pantallas con internet se
   actualizan solas en unos minutos (sin tocar la PC).

   Reglas:
   - Respetá las comillas "" y las comas del final de cada línea.
   - Un horario con aclaración va así: "20:00 Comb."
   - Para sacar un destino, borrá su línea entera.
   ========================================================= */

window.CARTEL = {
  origen: "CHUY",
  segundosPorPantalla: 40,

  // Música de fondo
  // - Con internet suena la primera radio de la lista (R en el teclado cambia).
  // - Sin internet, o si la radio se cae, pasa los MP3 de la carpeta "musica".
  // - activa: false para apagar todo · volumen de 0 a 1 (1 = al máximo; se baja con la tele o con -)
  musica: {
    activa: true,
    volumen: 1,
    radios: [
      { nombre: "Océano FM 93.9 (80s y 90s)", url: ["https://oceano-2.nty.uy/", "https://oceano-3.nty.uy/"] },
      { nombre: "Atlántica FM 89.3", url: "https://atlanticafm.radioca.st/stream" },
      { nombre: "FM Coronilla 102.3", url: "https://streaming01.shockmedia.com.ar/9184/stream" },
    ],
  },

  // Aclaración que va al lado de TARIFAS (dejar "" para no mostrar nada)
  notaTarifas: "Incluye tasa de uso $10",

  tarifas: [
    { destino: "Coronilla",    precio: 100 },
    { destino: "Fortaleza",    precio: 100 },
    { destino: "P.del Diablo", precio: 177 },
    { destino: "Castillos",    precio: 244 },
    { destino: "Rocha",        precio: 478 },
    { destino: "San Carlos",   precio: 679 },
    { destino: "Maldonado",    precio: 733 },
    { destino: "P.del Este",   precio: 766 },
    { destino: "P.de Azucar",  precio: 812 },
    { destino: "Montevideo",   precio: 1147 },
  ],

  salidas: [
    { destino: "MONTEVIDEO",     horas: ["04:00", "11:30", "20:00"] },
    { destino: "PAN DE AZUCAR",  horas: ["04:00", "11:30", "20:00"] },
    { destino: "SAN CARLOS",     horas: ["04:00", "11:30", "20:00"] },
    { destino: "ROCHA",          horas: ["04:00", "04:45", "11:30", "16:30", "20:00"] },
    { destino: "CASTILLOS",      horas: ["04:00", "04:45", "11:30", "16:30", "20:00"] },
    { destino: "PTA DEL DIABLO", horas: ["04:00", "04:45", "11:30", "16:30", "20:00"] },
    { destino: "LA CORONILLA",   horas: ["04:00", "04:45", "11:30", "16:30", "20:00"] },
    { destino: "PUNTA DEL ESTE", horas: ["04:45", "16:30", "20:00 Comb."] },
    { destino: "MALDONADO",      horas: ["04:45", "16:30", "20:00 Comb."] },
  ],

  retornos: [
    { destino: "MONTEVIDEO",     horas: ["09:40", "13:30", "20:30"] },
    { destino: "PAN DE AZUCAR",  horas: ["11:15", "15:05", "22:00"] },
    { destino: "SAN CARLOS",     horas: ["11:40", "11:45", "15:35", "17:40", "22:30"] },
    { destino: "ROCHA",          horas: ["12:35", "12:45", "16:35", "18:35", "23:25"] },
    { destino: "CASTILLOS",      horas: ["00:15", "13:25", "13:30", "17:25", "19:30"] },
    { destino: "PTA DEL DIABLO", horas: ["00:40", "14:00", "14:05", "17:15", "20:45"] },
    { destino: "LA FORTALEZA",   horas: ["00:50", "14:10", "14:15", "18:05", "20:10"] },
    { destino: "LA CORONILLA",   horas: ["01:00", "14:20", "14:25", "18:15", "20:20"] },
    { destino: "PUNTA DEL ESTE", horas: ["11:00", "17:00"] },
    { destino: "MALDONADO",      horas: ["11:15", "17:15"] },
  ],
};
