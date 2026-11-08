import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { LOCAL_ROOM_ID } from '@data/simulator/engine-protocol';
import { GameStore } from '@data/simulator/game.store';
import { QueueApi, QueueStatus } from '@data/simulator/queue.api';
import { RoomsApi } from '@data/simulator/rooms.api';
import { RoomInfo, STATUS_LABELS } from '@data/simulator/simulator.model';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { HubMenuComponent, HubMenuItem } from '../home/hub-menu.component';
import { HubScreenComponent } from '../home/hub-screen.component';

const LOBBY_ACTIONS: HubMenuItem[] = [
  { id: 'queue', label: 'Buscar ranked', icon: 'search' },
  { id: 'friendly', label: 'Crear sala amistosa', icon: 'plus' },
  { id: 'ranked', label: 'Crear sala ranked', icon: 'trophy' },
];

/** How often the search for a ranked rival is asked about (it keeps the player in the queue). */
const QUEUE_POLL_MS = 1500;

/** Which open rooms are listed. */
type RoomFilter = 'all' | 'friendly' | 'ranked';

/**
 * Simulator entrance (Online, in the hub's frame like Jugar): create a room or join an open one (listed, all public) or one by its code. A shared
 * link (/simulator/:roomId) joins that room directly after checking it exists (if not, it offers to create one). Decks, starters and who goes first are chosen inside the room,
 * in its pre-room, so changing them never leaves the room.
 */
@Component({
  selector: 'eras-lobby-page',
  imports: [
    HubScreenComponent,
    HubMenuComponent,
    AlertComponent,
    ToggleGroupComponent,
    BadgeComponent,
    ButtonComponent,
    IconButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './lobby.page.html',
  styleUrl: './lobby.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyPage {
  /** Route param of /simulator/:roomId (a shared link). */
  readonly roomId = input<string>();

  private readonly auth = inject(AuthService);
  private readonly rooms = inject(RoomsApi);
  protected readonly game = inject(GameStore);
  private readonly router = inject(Router);
  private readonly queueApi = inject(QueueApi);

  /** The search for a ranked rival under way (null: not searching). */
  protected readonly search = signal<QueueStatus | null>(null);
  private queueTimer: ReturnType<typeof setTimeout> | null = null;
  /** Each search (and leaving the page) is a new generation: an answer of an older one is ignored. */
  private searchGen = 0;
  private destroyed = false;
  /** In the server's queue (or on the way into it): leaving the page tells the server. */
  private inQueue = false;
  /** The menu's busy item: the action under way, or the search while searching. */
  protected readonly menuBusy = computed(() => this.busy() ?? (this.search() ? 'queue' : null));
  /** The time waited, as m:ss. */
  protected readonly waited = computed(() => {
    const s = Math.floor((this.search()?.waitedMs ?? 0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  protected readonly labels = STATUS_LABELS;
  protected readonly actions = LOBBY_ACTIONS;
  /** What is being done: 'create', a room id being joined, or null. */
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** The code typed (or taken from the link). */
  protected readonly code = signal('');
  /** The room asked for does not exist: offer to create one or change the code. */
  protected readonly missing = signal<string | null>(null);
  protected readonly list = signal<RoomInfo[] | null>(null);
  /** Friendly, ranked or every open room. */
  protected readonly filter = signal<RoomFilter>('all');
  protected readonly filterToggle: ToggleOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'friendly', label: 'Amistosas' },
    { value: 'ranked', label: 'Ranked' },
  ];
  protected readonly shown = computed(() => {
    const rooms = this.list();
    const f = this.filter();
    return rooms && (f === 'all' ? rooms : rooms.filter((r) => !!r.ranked === (f === 'ranked')));
  });
  private readonly me = computed(() => this.auth.user()?.id ?? '');

  constructor() {
    void this.refresh();
    // Leaving the page leaves the queue (also a search whose entry is still on its way)
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.inQueue) this.cancelSearch();
      this.searchGen++;
    });
    // Back on the page after a reload while searching: the search goes on (or its room is entered)
    void this.resumeSearch();
    // A shared link (/simulator/:roomId) joins that room right away, once it is known to exist
    effect(() => {
      const room = this.roomId()?.trim();
      if (!this.me()) return;
      untracked(() => {
        this.code.set(room ?? '');
        this.missing.set(null);
        if (room) void this.join(room);
      });
    });
  }

  protected async refresh(): Promise<void> {
    try {
      this.list.set(await firstValueFrom(this.rooms.list()));
    } catch {
      this.list.set([]);
    }
  }

  /** I am already in it: going back to it is always possible. */
  protected isMine(room: RoomInfo): boolean {
    return (room.playerIds ?? []).includes(this.me());
  }

  protected canJoin(room: RoomInfo): boolean {
    return this.isMine(room) || (room.playerCount ?? 0) < 2;
  }

  /** The menu: the ranked queue, or a room of one's own, friendly or ranked (Modo solo and the Sala de pruebas are in Jugar). */
  protected pick(id: string): void {
    if (id === 'queue') void this.startSearch();
    else void this.create(id === 'ranked');
  }

  /**
   * Into the ranked queue: asked about a moment after each answer (never two asks at once) until a rival is found,
   * then into the room made for both.
   */
  protected async startSearch(): Promise<void> {
    if (this.search() || this.busy()) return;
    this.error.set(null);
    const gen = ++this.searchGen;
    this.inQueue = true;
    try {
      this.onStatus(await firstValueFrom(this.queueApi.join(this.auth.user()?.username ?? '')), gen);
    } catch (e) {
      if (gen === this.searchGen) {
        this.inQueue = false;
        this.error.set(apiErrorMessage(e, 'No se pudo entrar a la cola ranked'));
      }
    }
  }

  protected cancelSearch(): void {
    this.searchGen++;
    this.inQueue = false;
    this.stopPolling();
    this.search.set(null);
    void firstValueFrom(this.queueApi.leave()).catch(() => undefined);
  }

  /** A search left running (the page was reloaded while searching): it goes on, or its room is entered. */
  private async resumeSearch(): Promise<void> {
    const gen = ++this.searchGen;
    try {
      const status = await firstValueFrom(this.queueApi.poll());
      if (status.state !== 'none') this.onStatus(status, gen);
    } catch {
      // No search to resume
    }
  }

  private async pollSearch(gen: number): Promise<void> {
    this.queueTimer = null;
    try {
      this.onStatus(await firstValueFrom(this.queueApi.poll()), gen);
    } catch {
      // A moment without connection: asked again a moment later
      if (gen === this.searchGen && !this.destroyed) this.queueTimer = setTimeout(() => void this.pollSearch(gen), QUEUE_POLL_MS);
    }
  }

  /** An answer of the search {@code gen} (ignored when that search is over). */
  private onStatus(status: QueueStatus, gen: number): void {
    if (gen !== this.searchGen || this.destroyed) return;
    this.inQueue = status.state === 'waiting';
    if (status.state === 'matched' && status.roomId) {
      this.stopPolling();
      this.search.set(null);
      this.busy.set(status.roomId);
      void this.enter(status.roomId);
    } else if (status.state === 'waiting') {
      this.search.set(status);
      this.queueTimer = setTimeout(() => void this.pollSearch(gen), QUEUE_POLL_MS);
    } else {
      this.stopPolling();
      this.search.set(null);
    }
  }

  private stopPolling(): void {
    if (this.queueTimer) clearTimeout(this.queueTimer);
    this.queueTimer = null;
  }

  protected setFilter(value: string): void {
    this.filter.set(value as RoomFilter);
  }

  protected async create(ranked = false): Promise<void> {
    if (this.busy()) return;
    if (this.search()) this.cancelSearch();
    this.busy.set(ranked ? 'ranked' : 'friendly');
    this.error.set(null);
    try {
      const { roomId } = await firstValueFrom(this.rooms.create(false, false, ranked));
      await this.enter(roomId);
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo crear la sala'));
      this.busy.set(null);
    }
  }

  /** Joins a room after checking it exists and has room for me. */
  protected async join(id: string): Promise<void> {
    const room = id.trim();
    if (!room || this.busy()) return;
    // The offline game's room lives in this page only: once it is gone (a reload), it is opened again from "Jugar"
    if (room === LOCAL_ROOM_ID && !this.game.local()) {
      void this.router.navigateByUrl('/play', { replaceUrl: true });
      return;
    }
    if (this.search()) this.cancelSearch();
    this.busy.set(room);
    this.error.set(null);
    this.missing.set(null);
    let info: RoomInfo;
    try {
      info = await firstValueFrom(this.rooms.get(room));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) this.missing.set(room);
      else this.error.set(apiErrorMessage(e, 'No se pudo revisar la sala'));
      this.busy.set(null);
      return;
    }
    if (!this.canJoin(info)) {
      this.error.set(`La sala ${room} ya tiene dos jugadores`);
      this.busy.set(null);
      return;
    }
    await this.enter(room);
  }

  private async enter(room: string): Promise<void> {
    try {
      await this.game.connect(room);
      this.game.joinRoom(null);
      // From a link the lobby is left out of the history, so going back does not join again
      await this.router.navigate(['/simulator', room, 'board'], { replaceUrl: !!this.roomId() });
    } catch {
      this.error.set('No se pudo conectar con el servidor del simulador');
      this.game.disconnect();
    } finally {
      this.busy.set(null);
    }
  }

  protected playersOf(room: RoomInfo): string {
    const names = room.players ?? [];
    return names.length ? names.join(' vs ') : 'Sin jugadores';
  }
}
