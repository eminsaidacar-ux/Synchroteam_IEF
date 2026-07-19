// Extraction EXIF minimale côté client (aucune dépendance) : date de prise
// de vue (DateTimeOriginal) et coordonnées GPS d'un JPEG.
//
// IMPORTANT : à appeler sur le fichier ORIGINAL, AVANT compressImage()
// (compress.js repasse par canvas et détruit toutes les métadonnées).
//
// Retourne { taken_at: string ISO | null, lat: number | null, lng: number | null }.
// Tout échec de parsing est silencieux (métadonnées à null).

const TAG_EXIF_IFD      = 0x8769;
const TAG_GPS_IFD       = 0x8825;
const TAG_DATETIME      = 0x0132;
const TAG_DATETIME_ORIG = 0x9003;
const TAG_GPS_LAT_REF   = 0x0001;
const TAG_GPS_LAT       = 0x0002;
const TAG_GPS_LNG_REF   = 0x0003;
const TAG_GPS_LNG       = 0x0004;

export async function extractExif(file) {
  const empty = { taken_at: null, lat: null, lng: null };
  try {
    if (!(file instanceof Blob)) return empty;
    // L'APP1 EXIF est en tête de fichier : 256 Ko suffisent largement.
    const buf  = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return empty; // pas un JPEG

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      if (marker === 0xffda) break; // SOS : début des données image
      const size = view.getUint16(offset + 2);
      if (marker === 0xffe1 && readAscii(view, offset + 4, 4) === 'Exif') {
        return parseTiff(view, offset + 10); // après "Exif\0\0"
      }
      offset += 2 + size;
    }
  } catch { /* métadonnées illisibles : on abandonne silencieusement */ }
  return empty;
}

function readAscii(view, start, length) {
  let s = '';
  for (let i = 0; i < length && start + i < view.byteLength; i++) {
    const c = view.getUint8(start + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function parseTiff(view, base) {
  const out = { taken_at: null, lat: null, lng: null };
  const endian = view.getUint16(base);
  const little = endian === 0x4949; // 'II'
  if (!little && endian !== 0x4d4d) return out; // ni 'II' ni 'MM'
  if (view.getUint16(base + 2, little) !== 42) return out;

  const u16 = (o) => view.getUint16(base + o, little);
  const u32 = (o) => view.getUint32(base + o, little);

  // Lit un IFD et retourne { tag: { type, count, valueOffset } } (offsets relatifs à base).
  function readIfd(ifdOffset) {
    const entries = {};
    if (ifdOffset + 2 > view.byteLength - base) return entries;
    const n = u16(ifdOffset);
    for (let i = 0; i < n; i++) {
      const e = ifdOffset + 2 + i * 12;
      if (base + e + 12 > view.byteLength) break;
      const tag   = u16(e);
      const type  = u16(e + 2);
      const count = u32(e + 4);
      const byteLen = typeLength(type) * count;
      const valueOffset = byteLen <= 4 ? e + 8 : u32(e + 8);
      entries[tag] = { type, count, valueOffset };
    }
    return entries;
  }

  function typeLength(type) {
    switch (type) {
      case 1: case 2: case 7: return 1; // BYTE, ASCII, UNDEFINED
      case 3: return 2;                 // SHORT
      case 4: case 9: return 4;         // LONG, SLONG
      case 5: case 10: return 8;        // RATIONAL, SRATIONAL
      default: return 1;
    }
  }

  const ascii = (entry) => (entry ? readAscii(view, base + entry.valueOffset, entry.count) : null);
  const rationals = (entry) => {
    if (!entry) return null;
    const vals = [];
    for (let i = 0; i < entry.count; i++) {
      const num = u32(entry.valueOffset + i * 8);
      const den = u32(entry.valueOffset + i * 8 + 4);
      vals.push(den === 0 ? 0 : num / den);
    }
    return vals;
  };

  const ifd0 = readIfd(u32(4));

  // Date de prise de vue : DateTimeOriginal (sous-IFD EXIF), sinon DateTime.
  let dateStr = null;
  if (ifd0[TAG_EXIF_IFD]) {
    const exifIfd = readIfd(u32(ifd0[TAG_EXIF_IFD].valueOffset));
    dateStr = ascii(exifIfd[TAG_DATETIME_ORIG]);
  }
  if (!dateStr) dateStr = ascii(ifd0[TAG_DATETIME]);
  out.taken_at = parseExifDate(dateStr);

  // GPS
  if (ifd0[TAG_GPS_IFD]) {
    const gps = readIfd(u32(ifd0[TAG_GPS_IFD].valueOffset));
    const latRef = ascii(gps[TAG_GPS_LAT_REF]);
    const lngRef = ascii(gps[TAG_GPS_LNG_REF]);
    const lat = dmsToDecimal(rationals(gps[TAG_GPS_LAT]));
    const lng = dmsToDecimal(rationals(gps[TAG_GPS_LNG]));
    if (lat != null && lng != null) {
      out.lat = latRef === 'S' ? -lat : lat;
      out.lng = lngRef === 'W' ? -lng : lng;
    }
  }
  return out;
}

// "AAAA:MM:JJ HH:MM:SS" (heure locale de l'appareil) → ISO 8601.
function parseExifDate(s) {
  if (!s) return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function dmsToDecimal(dms) {
  if (!dms || dms.length < 1) return null;
  const [deg = 0, min = 0, sec = 0] = dms;
  const val = deg + min / 60 + sec / 3600;
  return Number.isFinite(val) ? val : null;
}

// Géolocalisation navigateur — fallback quand l'EXIF ne contient pas de GPS
// (demande la permission ; échec/refus → null, jamais bloquant).
export function getBrowserPosition(timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}
