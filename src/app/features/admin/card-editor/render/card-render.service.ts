import { Injectable, inject } from '@angular/core';
import { CardMeta } from '@data/cards/card.model';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { CardsStore } from '@data/cards/cards.store';
import { formFromMeta } from '@data/cards/meta-rules';
import { isGlossyRarity } from '@data/cards/card-rules';
import { firstValueFrom } from 'rxjs';
import { draftFromForm, readDesign } from '../card-editor-rules';
import { buildCard } from './card-build';
import { loadCardFonts } from './card-fonts';
import { ColorLut, convertCanvas } from './color-lut';
import { drawEffects } from './effect-layout';
import { foilCutSpec, glossSpec, goldSpec } from './gloss-mask';
import { svgToCanvasFine } from './print-export';
import { ArtPlacement, CardSpec, PieceTable } from './spec.model';
import { SvgRenderer } from './svg-render';

/** The size of each third of a card's shine (half the card's 744 × 1039). */
const SHINE_WIDTH = 372;
const SHINE_HEIGHT = 520;

interface Assets {
  templates: Record<string, CardSpec>;
  pieces: PieceTable;
  lut: ColorLut;
  css: string;
  missingFonts: string[];
}

/**
 * Draws a saved card as the card editor does (its metadata, design and art, in screen colors) and stores it as the
 * card's finished image, without opening the editor: used when a card changes slot, so its image shows the new code.
 */
@Injectable({ providedIn: 'root' })
export class CardRenderService {
  private readonly api = inject(CardsAdminApi);
  private readonly cards = inject(CardsStore);
  private assets: Promise<Assets> | null = null;
  private readonly ctx = document.createElement('canvas').getContext('2d')!;
  private readonly measure = (text: string, font: string) => {
    this.ctx.font = font;
    return this.ctx.measureText(text).width;
  };

  /** The fonts the card needs and this device lacks (drawn without them, the image would be wrong). */
  async missingFonts(): Promise<string[]> {
    return (await this.load()).missingFonts;
  }

  /**
   * Draws the card and saves it as its finished image, with where it shines; answers the card as it is now (its new
   * render and shine keys).
   */
  async refresh(meta: CardMeta): Promise<CardMeta> {
    const blob = await this.draw(meta);
    const saved = await firstValueFrom(this.api.setRender(meta.id, blob));
    return this.saveShine(saved);
  }

  /** Draws where the card shines and saves it next to its render; answers the card (its new shine key). */
  async saveShine(meta: CardMeta): Promise<CardMeta> {
    return firstValueFrom(this.api.setShine(meta.id, await this.shine(meta)));
  }

  /**
   * Where the card shines, as the site lays it over the card's image: a grey PNG at half the card's size, three times
   * as tall, white where it shines and black elsewhere (luminance masks): the glossy parts on top (rarity R and
   * above), the gold border in the middle (cards that have one), and below where a foil goes (all the card
   * but its glossy parts and its effect box, see foilCutSpec).
   */
  async shine(meta: CardMeta): Promise<Blob> {
    const { templates, css } = await this.load();
    const built = buildCard({ ...this.draftOf(meta), art: null }, templates, this.measure);
    const parts = [isGlossyRarity(meta.rarity) ? glossSpec(built) : null, goldSpec(built), foilCutSpec(built)];
    const [w, h] = [SHINE_WIDTH, SHINE_HEIGHT];
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h * 3;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h * 3);
    // The foil's third starts white: what it leaves uncovered is drawn over it inverted (white on white turns black)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, h * 2, w, h);
    for (const [i, spec] of parts.entries()) {
      if (!spec) continue;
      const r = new SvgRenderer(spec, css);
      r.render();
      ctx.globalCompositeOperation = i === 2 ? 'difference' : 'source-over';
      ctx.drawImage(await svgToCanvasFine(r.svg), 0, i * h, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo dibujar el brillo de la carta');
    return blob;
  }

  /** The card drawn as a JPEG, as the editor saves it. */
  async draw(meta: CardMeta): Promise<Blob> {
    const { templates, pieces, lut, css } = await this.load();
    const design = readDesign(meta.design);
    const art = meta.artKey ? await this.art(meta.id, lut, design.art ?? { scale: 1, x: 0, y: 0 }) : null;
    const built = buildCard({ ...this.draftOf(meta), art }, templates, this.measure);
    const r = new SvgRenderer(built, css);
    r.render();
    drawEffects(r, built, pieces, this.cards.ref()?.keywordEffects ?? {}, this.measure);
    await r.bake();
    const canvas = convertCanvas(await svgToCanvasFine(r.svg), (px) => lut.forward(px));
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('No se pudo dibujar la carta');
    return blob;
  }

  /**
   * Where the card's glossy coat goes (see glossSpec) as an SVG data URL,
   * white over transparent at the card's size: a mask for a shine laid over the card's image.
   */
  async glossMask(meta: CardMeta): Promise<string> {
    const { templates, css } = await this.load();
    const built = buildCard({ ...this.draftOf(meta), art: null }, templates, this.measure);
    // The fonts go inside: the level's number and the matte texts are drawn in their own
    return maskUrl(glossSpec(built), css);
  }

  /** Where the card's gold border is (see goldSpec) as an SVG data URL, or null when the card has none. */
  async goldMask(meta: CardMeta): Promise<string | null> {
    const { templates, css } = await this.load();
    const built = buildCard({ ...this.draftOf(meta), art: null }, templates, this.measure);
    const spec = goldSpec(built);
    return spec ? maskUrl(spec, css) : null;
  }

  /** What the card builder draws for a saved card (its metadata and design), without its art. */
  private draftOf(meta: CardMeta) {
    const form = formFromMeta(meta);
    const design = readDesign(meta.design);
    return {
      ...draftFromForm(form, design.her),
      // Cards made before the editor: cost and strength left out are the empty ones
      noCost: meta.design ? design.noCost : form.cost === null,
      noStrength: meta.design ? design.noStrength : form.cardType === 'creature' && form.strength === null,
      goldBorder: design.goldBorder,
      frameStyle: design.frameStyle,
    };
  }

  /** The card's art in the design's color space, placed as saved (the editor does the same when it opens a card). */
  private async art(id: string, lut: ColorLut, place: { scale: number; x: number; y: number }): Promise<ArtPlacement> {
    const blob = await firstValueFrom(this.api.art(id));
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo leer el arte de la carta'));
        img.src = url;
      });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      convertCanvas(c, (px) => lut.inverse(px));
      return { src: c.toDataURL('image/jpeg', 0.95), width: c.width, height: c.height, ...place };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private load(): Promise<Assets> {
    this.assets ??= (async () => {
      const [templates, pieces, lut, fonts] = await Promise.all([
        fetch('/card-maker/templates.json').then((r) => r.json()),
        fetch('/card-maker/pieces.json').then((r) => r.json()),
        fetch('/card-maker/color-lut.bin').then((r) => r.arrayBuffer()),
        loadCardFonts(),
      ]);
      return {
        templates,
        pieces,
        lut: new ColorLut(new Uint8Array(lut)),
        css: fonts.css,
        missingFonts: fonts.missing.map((s) => s.label),
      };
    })();
    this.assets.catch(() => (this.assets = null));
    return this.assets;
  }
}

/** A mask spec drawn as an SVG data URL. */
function maskUrl(spec: CardSpec, css: string): string {
  const r = new SvgRenderer(spec, css);
  r.render();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(r.svg))}`;
}
