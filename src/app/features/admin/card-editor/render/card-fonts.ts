/**
 * The card fonts (Book Antiqua, Agency FB, Arial) are commercial, so the site never ships them: the editor uses the
 * ones installed on the admin's computer (`local()`), or files the admin picks once, kept only in this browser
 * (IndexedDB). The same CSS goes inside every exported SVG so the image keeps its fonts.
 */
export interface FontSlot {
  key: string;
  label: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  locals: string[];
}

export const FONT_SLOTS: FontSlot[] = [
  {
    key: 'antiqua',
    label: 'Book Antiqua Bold',
    family: 'ERAS Book Antiqua',
    weight: 700,
    style: 'normal',
    locals: ['Book Antiqua Bold', 'BookAntiqua-Bold'],
  },
  {
    key: 'agency',
    label: 'Agency FB Bold',
    family: 'ERAS Agency FB',
    weight: 700,
    style: 'normal',
    locals: ['Agency FB Bold', 'AgencyFB-Bold'],
  },
  {
    key: 'arial',
    label: 'Arial',
    family: 'ERAS Arial',
    weight: 400,
    style: 'normal',
    locals: ['Arial', 'ArialMT'],
  },
  {
    key: 'arial-i',
    label: 'Arial Italic',
    family: 'ERAS Arial',
    weight: 400,
    style: 'italic',
    locals: ['Arial Italic', 'Arial-ItalicMT'],
  },
  {
    key: 'arial-b',
    label: 'Arial Bold',
    family: 'ERAS Arial',
    weight: 700,
    style: 'normal',
    locals: ['Arial Bold', 'Arial-BoldMT'],
  },
  {
    key: 'arial-bi',
    label: 'Arial Bold Italic',
    family: 'ERAS Arial',
    weight: 700,
    style: 'italic',
    locals: ['Arial Bold Italic', 'Arial-BoldItalicMT'],
  },
];

const DB = 'eras-card-fonts';
const STORE = 'fonts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function stored(): Promise<Record<string, ArrayBuffer>> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const out: Record<string, ArrayBuffer> = {};
      const req = db.transaction(STORE).objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve(out);
        out[String(c.key)] = c.value as ArrayBuffer;
        c.continue();
      };
      req.onerror = () => resolve(out);
    });
  } catch {
    return {};
  }
}

/** Keeps a font file the admin picked for a slot. */
export async function saveFontFile(key: string, file: File): Promise<void> {
  const data = await file.arrayBuffer();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function toDataUrl(buf: ArrayBuffer): string {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:font/ttf;base64,${btoa(bin)}`;
}

export interface LoadedFonts {
  /** @font-face rules for the page and for exported SVGs. */
  css: string;
  /** Slots with neither an installed font nor a picked file. */
  missing: FontSlot[];
}

/** Registers the card fonts in the document and reports the missing ones. */
export async function loadCardFonts(): Promise<LoadedFonts> {
  const files = await stored();
  const rules: string[] = [];
  const missing: FontSlot[] = [];
  for (const slot of FONT_SLOTS) {
    const src = files[slot.key]
      ? `url("${toDataUrl(files[slot.key])}")`
      : slot.locals.map((n) => `local("${n}")`).join(', ');
    const face = new FontFace(slot.family, src, { weight: String(slot.weight), style: slot.style });
    try {
      await face.load();
      document.fonts.add(face);
    } catch {
      missing.push(slot);
    }
    rules.push(
      `@font-face{font-family:"${slot.family}";src:${src};font-weight:${slot.weight};font-style:${slot.style}}`,
    );
  }
  return { css: rules.join(''), missing };
}
