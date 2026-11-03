import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProgressionStore } from '@core/missions/progression.store';
import { PageComponent } from '@ui/layout/page/page.component';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { GemPracticeComponent } from './gem-practice.component';
import { KeywordListComponent } from './keyword-list.component';
import { TABLE_ZONES, TableDiagramComponent, TableZone } from './table-diagram.component';

interface Chapter {
  id: string;
  title: string;
  icon: IconName;
  /** One line under the title. */
  lead: string;
}

/** The guide's chapters, in reading order; the URL names the open one (?capitulo=combate). */
const CHAPTERS: Chapter[] = [
  { id: 'objetivo', title: 'El objetivo', icon: 'flag', lead: 'Cómo se gana y qué pasa en cada turno.' },
  { id: 'mazo', title: 'Tu mazo', icon: 'stack', lead: 'Cómo se arma y cómo se prepara la partida.' },
  { id: 'mesa', title: 'La mesa', icon: 'layers', lead: 'Las zonas de juego y para qué sirve cada una.' },
  { id: 'turno', title: 'El turno', icon: 'clock', lead: 'Las tres fases y en qué orden ocurren.' },
  { id: 'gemas', title: 'Las gemas', icon: 'gem', lead: 'El Marcador, el Contador compartido y las deudas.' },
  { id: 'invocar', title: 'Invocar', icon: 'creature', lead: 'Invocación normal, por efecto y especial.' },
  { id: 'combate', title: 'Combate', icon: 'sword', lead: 'Atacar, bloquear, enfrentarse y hacer daño.' },
  { id: 'efectos', title: 'Cartas y efectos', icon: 'cards', lead: 'Las partes de una carta y cómo leer un efecto.' },
  { id: 'habilidades', title: 'Habilidades', icon: 'zap', lead: 'Las palabras clave que aparecen en las cartas.' },
];

/** What each zone of the table is for (rules v1.1, section 4). */
const ZONE_TEXT: Record<TableZone, string> = {
  front: 'Solo criaturas. Desde aquí atacan y bloquean, y aquí los efectos del rival sí pueden alcanzarlas.',
  back: 'Aquí entran las criaturas que invocas y aquí se juegan utilidades y estructuras. Las criaturas de la Retaguardia no atacan ni bloquean, y los efectos del rival no pueden elegirlas ni afectarlas directamente.',
  lives: 'Seis cartas bocabajo. Cada vez que recibes daño directo se revela la de arriba. Si llegan a 0, pierdes.',
  hand: 'Tus cartas para jugar. No tiene límite y solo tú la ves.',
  deck: 'Bocabajo; robas del tope. Si al inicio de tu turno no puedes robar, pierdes.',
  tributes: 'Las cartas sacrificadas o tributadas, y las criaturas que pierdes de tus vidas. Quedan boca arriba.',
  discard: 'Las criaturas destruidas, las utilidades ya resueltas y las cartas descartadas.',
  marker: 'Va de 0 a 5 y dice cuántas gemas generas en cada turno. Empieza en 0 y sube 1 al inicio de cada turno tuyo.',
  counter: 'Una recta compartida entre los dos jugadores, de 10 a 0 a 10, que marca las gemas que tiene cada uno ahora.',
};

/**
 * "Cómo jugar": a friendly guide to the rules (v1.1), not the full manual, in chapters with a side index (chips on a
 * phone) and previous/next buttons. One screen high: the bar and the index stay put, only the chapter scrolls. It has a practice for the gem Contador, the table with its zones and the
 * keywords (KeywordListComponent).
 */
@Component({
  selector: 'eras-ruling-page',
  imports: [PageComponent, IconComponent, RouterLink, GemPracticeComponent, KeywordListComponent, TableDiagramComponent],
  templateUrl: './ruling.page.html',
  styleUrl: './ruling.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulingPage {
  /** ?capitulo= from the URL. */
  readonly capitulo = input<string>();

  private readonly router = inject(Router);

  /** The chapter's text: the only part of the screen that scrolls. */
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  protected readonly chapters = CHAPTERS;
  protected readonly index = computed(() => Math.max(0, CHAPTERS.findIndex((c) => c.id === this.capitulo())));
  protected readonly chapter = computed(() => CHAPTERS[this.index()]);
  protected readonly previous = computed(() => CHAPTERS[this.index() - 1] ?? null);
  protected readonly next = computed(() => CHAPTERS[this.index() + 1] ?? null);

  protected readonly tableZones = TABLE_ZONES;
  protected readonly zoneText = ZONE_TEXT;
  protected readonly zone = signal<TableZone>('front');

  constructor() {
    // Reading the guide is a step of the "Bienvenida" missions
    inject(ProgressionStore).visit('como-jugar');
  }

  protected open(id: string): void {
    void this.router.navigate([], { queryParams: { capitulo: id } });
    this.body()?.nativeElement.scrollTo({ top: 0 });
  }
}
