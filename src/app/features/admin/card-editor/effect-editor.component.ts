import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Line, PieceCatalog, Seg, splitPieces } from './effect-text';
import { fitInView } from './fit-in-view';
import { Zone } from './render/card-zones';
import { pieceKey } from './render/effect-layout';
import { PieceTable } from './render/spec.model';

const W = 744;
const H = 1039;

/**
 * Typing box over an effect box of the card. Each line is an effect (or a keyword); momentos, condiciones and
 * keywords turn into pieces as they are typed. Emits the lines while typing and once more when closed.
 */
@Component({
  selector: 'eras-effect-editor',
  template: `
    <div
      #box
      class="box"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      aria-label="Efectos"
      spellcheck="false"
      (input)="typed()"
      (keydown.escape)="done()"
      (keydown.backspace)="unpiece($event)"
    ></div>
    <button type="button" class="done" (click)="done()">Listo</button>
  `,
  styles: `
    :host {
      position: absolute;
      z-index: 3;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      gap: var(--space-1);
    }
    .box {
      overflow-y: auto;
      padding: var(--space-2);
      border: 2px solid var(--color-primary);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--font-size-sm);
      line-height: 1.7;
      outline: none;
    }
    .box ::ng-deep .line {
      min-block-size: 1.7em;
    }
    .box ::ng-deep .piece {
      display: inline-block;
      padding: 0 0.4em;
      margin: 0 0.1em;
      border-radius: 0.3em;
      color: #fff;
      font-weight: 700;
      text-shadow: 0 0 2px #000;
      line-height: 1.4;
      user-select: all;
    }
    .done {
      justify-self: end;
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
    }
  `,
  host: {
    '[style.left.%]': '(zone().rect[0] / W) * 100',
    '[style.top.%]': '(zone().rect[1] / H) * 100',
    '[style.width.%]': '((zone().rect[2] - zone().rect[0]) / W) * 100',
    '[style.height.%]': '((zone().rect[3] - zone().rect[1]) / H) * 100 + 4',
    '(pointerdown)': '$event.stopPropagation()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectEditorComponent implements AfterViewInit, OnDestroy {
  readonly zone = input.required<Zone>();
  readonly lines = input.required<Line[]>();
  readonly catalog = input.required<PieceCatalog>();
  readonly pieces = input.required<PieceTable>();
  readonly changed = output<Line[]>();
  readonly closed = output<Line[]>();

  protected readonly W = W;
  protected readonly H = H;
  private readonly box = viewChild.required<ElementRef<HTMLDivElement>>('box');
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    const lines = this.lines().length ? this.lines() : [[]];
    this.render(lines);
    // Kept inside the visible part of the card's viewport (an effect box at the card's foot): it moves, no scroll
    const host = this.host.nativeElement;
    this.observer = new ResizeObserver(() => fitInView(host));
    this.observer.observe(host);
    const el = this.box().nativeElement;
    el.focus({ preventScroll: true });
    // Caret at the end of the text.
    const sel = window.getSelection();
    sel?.selectAllChildren(el);
    sel?.collapseToEnd();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.timer) clearTimeout(this.timer);
  }

  protected typed(): void {
    const el = this.box().nativeElement;
    const before = this.read();
    const caret = this.caret();
    const after = before.map((l) => splitPieces(l, this.catalog()));
    const width = (l: Line) => l.reduce((n, s) => n + (s.t === 'text' ? s.text.length : 1), 0);
    if (after.some((l, i) => width(l) !== width(before[i]))) {
      this.render(after);
      if (caret) {
        // The replaced words shrank to one piece: keep the caret as far from the line's end as it was.
        const shift = width(before[caret.line]) - width(after[caret.line]);
        this.setCaret(caret.line, Math.max(0, caret.offset - shift));
      }
    } else if (!el.querySelector('.line')) {
      // The browser typed straight into the box: wrap it in a line.
      const c = this.caret();
      this.render(after);
      if (c) this.setCaret(c.line, c.offset);
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.changed.emit(this.read()), 250);
  }

  /**
   * Backspace right after a keyword piece (or after the spaces typed behind it) turns it back into its word, in lower
   * case: a keyword needs its capital, so it stays a word ("reactivar" esta carta). The next backspace deletes letters.
   */
  protected unpiece(event: Event): void {
    if (!window.getSelection()?.isCollapsed) return;
    const caret = this.caret();
    const lines = this.read();
    const line = caret ? lines[caret.line] : undefined;
    if (!caret || !line) return;
    let at = 0;
    for (let i = 0; i < line.length && at < caret.offset; i++) {
      const s = line[i];
      const end = at + (s.t === 'text' ? s.text.length : 1);
      at = end;
      if (s.t !== 'piece' || s.kind !== 'keyword' || end > caret.offset) continue;
      const next = line[i + 1];
      const gap = caret.offset - end;
      const spaces = next?.t === 'text' ? next.text.slice(0, gap) : '';
      if (gap && (spaces.length !== gap || spaces.trim())) continue;
      event.preventDefault();
      line[i] = { t: 'text', text: s.label.charAt(0).toLowerCase() + s.label.slice(1) };
      if (gap && next?.t === 'text') line[i + 1] = { t: 'text', text: next.text.slice(gap) };
      this.render(lines.map((l) => l.filter((x) => !(x.t === 'text' && !x.text))));
      this.setCaret(caret.line, end - 1 + s.label.length);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.changed.emit(this.read()), 250);
      return;
    }
  }

  protected done(): void {
    if (this.timer) clearTimeout(this.timer);
    this.closed.emit(this.read().map((l) => splitPieces(l, this.catalog(), true)));
  }

  // ── DOM ↔ lines ─────────────────────────────────────────────────────────

  private render(lines: Line[]): void {
    const el = this.box().nativeElement;
    el.replaceChildren(
      ...lines.map((line) => {
        const div = document.createElement('div');
        div.className = 'line';
        for (const s of line) div.appendChild(this.node(s));
        if (!line.length) div.appendChild(document.createElement('br'));
        return div;
      }),
    );
  }

  private node(s: Seg): Node {
    if (s.t === 'text') return document.createTextNode(s.text);
    const span = document.createElement('span');
    span.className = 'piece';
    span.contentEditable = 'false';
    span.dataset['kind'] = s.kind;
    span.dataset['label'] = s.label;
    if (s.key) span.dataset['key'] = s.key;
    span.textContent = s.label;
    span.style.background = this.paint(s);
    return span;
  }

  /** Chip colors from the symbol sheet (bottom to top), as on the card. */
  private paint(s: Extract<Seg, { t: 'piece' }>): string {
    if (s.kind === 'ultimate') return '#7b3fbf';
    const table = {
      timing: this.pieces().timings,
      condition: this.pieces().conditions,
      keyword: this.pieces().keywords,
    }[s.kind];
    const st = table[pieceKey(s.label)];
    if (!st) return '#555';
    const stops = st.fill.map(([at, c]) => `${c} ${Math.round(at * 100)}%`).join(', ');
    return `linear-gradient(to top, ${stops})`;
  }

  private read(): Line[] {
    const lines: Line[] = [[]];
    const push = (s: Seg) => {
      const line = lines[lines.length - 1];
      const prev = line[line.length - 1];
      if (s.t === 'text' && prev?.t === 'text') prev.text += s.text;
      else line.push(s);
    };
    const walk = (n: Node, top: boolean) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = (n.textContent ?? '').split(String.fromCharCode(160)).join(' ');
        if (text) push({ t: 'text', text });
        return;
      }
      if (!(n instanceof HTMLElement)) return;
      if (n.classList.contains('piece')) {
        push({
          t: 'piece',
          kind: n.dataset['kind'] as Seg extends { kind: infer K } ? K : never,
          label: n.dataset['label'] ?? '',
          key: n.dataset['key'],
        });
        return;
      }
      if (n.tagName === 'BR') return;
      const block = n.tagName === 'DIV';
      if (block && top && lines[lines.length - 1].length) lines.push([]);
      n.childNodes.forEach((c) => walk(c, false));
      if (block && top) lines.push([]);
    };
    this.box().nativeElement.childNodes.forEach((c) => walk(c, true));
    while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
    return lines;
  }

  /** Caret as (line, offset), a piece counting as one character. */
  private caret(): { line: number; offset: number } | null {
    const sel = window.getSelection();
    const el = this.box().nativeElement;
    if (!sel?.rangeCount || !el.contains(sel.anchorNode)) return null;
    const lineEls = [...el.children] as HTMLElement[];
    const lineIdx = lineEls.findIndex((l) => l.contains(sel.anchorNode));
    if (lineIdx < 0) return null;
    let offset = 0;
    let found = false;
    const walk = (n: Node) => {
      if (found) return;
      if (n === sel.anchorNode && n.nodeType === Node.TEXT_NODE) {
        offset += sel.anchorOffset;
        found = true;
        return;
      }
      if (n === sel.anchorNode) {
        n.childNodes.forEach((c, i) => {
          if (i < sel.anchorOffset) offset += this.width(c);
        });
        found = true;
        return;
      }
      if (n.nodeType === Node.TEXT_NODE) offset += (n.textContent ?? '').length;
      else if (n instanceof HTMLElement && n.classList.contains('piece')) offset += 1;
      else n.childNodes.forEach(walk);
    };
    lineEls[lineIdx].childNodes.forEach(walk);
    return { line: lineIdx, offset };
  }

  private width(n: Node): number {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').length;
    if (n instanceof HTMLElement && n.classList.contains('piece')) return 1;
    let w = 0;
    n.childNodes.forEach((c) => (w += this.width(c)));
    return w;
  }

  private setCaret(line: number, offset: number): void {
    const lineEl = this.box().nativeElement.children[line];
    if (!lineEl) return;
    const range = document.createRange();
    let left = offset;
    for (const c of [...lineEl.childNodes]) {
      const w = this.width(c);
      if (c.nodeType === Node.TEXT_NODE && left <= w) {
        range.setStart(c, left);
        break;
      }
      if (left < w || (left === w && c === lineEl.lastChild)) {
        range.setStartAfter(c);
        break;
      }
      left -= w;
      range.setStartAfter(c);
    }
    if (!lineEl.childNodes.length) range.setStart(lineEl, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}
