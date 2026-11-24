import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ServerAccess } from '../server/server-access';
import { ApiConfig } from '../http/api-config';
import { BACKGROUND } from '../http/busy';
import { apiErrorMessage } from '../http/api-error';
import { WalletStore } from '../wallet/wallet.store';
import { Milestone, ProgressionBoard, WelcomeStep } from './progression.model';
import { reloadOnProgress } from './reload-on-progress';

/** The first welcome step: done by taking one of ST1–ST4 (the first of them is free). */
export const STRUCTURE_STEP = 'structure';

/** Claimable now: open, not claimed, and done. */
export function stepClaimable(step: WelcomeStep): boolean {
  return !step.locked && !step.claimed && step.progress >= step.target;
}

/** The next tier is done and waits to be claimed. */
export function milestoneClaimable(m: Milestone): boolean {
  return !m.maxed && m.progress >= m.target;
}

interface ClaimResponse {
  board: ProgressionBoard;
}

/**
 * The signed-in player's progression missions, kept by the server (DriveManager /api/drive/progression): the
 * "Bienvenida" chain, claimed in order, and the milestones, in tiers. Online games, packs opened and what the account
 * has count there; the visits to some pages are reported from here. Read when someone signs in (which counts the
 * day's login); the quick buttons add how many wait to be claimed.
 */
@Injectable({ providedIn: 'root' })
export class ProgressionStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly auth = inject(AuthService);
  /** The installed app asks the server nothing before connecting (ServerAccess). */
  private readonly access = inject(ServerAccess);
  private readonly wallet = inject(WalletStore);

  readonly board = signal<ProgressionBoard | null>(null);
  /** What is being claimed ("welcome|deck", "milestone|wins"), or null. */
  readonly claiming = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  /** Steps and tiers done whose reward waits to be claimed. */
  readonly waiting = computed(() => {
    const board = this.board();
    if (!board) return 0;
    return board.welcome.filter(stepClaimable).length + board.milestones.filter(milestoneClaimable).length;
  });
  /** The "Bienvenida" chain is complete (its last step claimed). */
  readonly welcomeDone = computed(() => !!this.board()?.welcome.every((s) => s.claimed));

  /** Pages already reported in this session. */
  private readonly visited = new Set<string>();

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id ?? null;
      const allowed = this.access.allowed();
      untracked(() => {
        this.board.set(null);
        this.visited.clear();
        if (id && allowed) void this.load();
      });
    });
    reloadOnProgress(() => this.load(), () => this.board() !== null);
  }

  async load(): Promise<void> {
    try {
      this.board.set(await firstValueFrom(this.http.get<ProgressionBoard>(this.api.url('/api/drive/progression/me'))));
    } catch {
      // An older server without progression: none
    }
  }

  /** Claims a welcome step (its gems); false when refused (`error` says why). */
  async claimStep(stepId: string): Promise<boolean> {
    return this.claim({ kind: 'welcome', id: stepId }, `welcome|${stepId}`);
  }

  async claimMilestone(milestoneId: string): Promise<boolean> {
    return this.claim({ kind: 'milestone', id: milestoneId }, `milestone|${milestoneId}`);
  }

  /** Notes a visit to a page that counts ("como-jugar", "cartas"), once per session and only signed in. */
  visit(page: string): void {
    if (!this.auth.user() || !this.access.allowed() || this.visited.has(page)) return;
    this.visited.add(page);
    // In the background: it never holds the buttons (BusyState)
    const context = new HttpContext().set(BACKGROUND, true);
    this.http.post(this.api.url('/api/drive/progression/me/visit'), { page }, { context }).subscribe({
      next: () => void this.load(),
      error: () => this.visited.delete(page),
    });
  }

  private async claim(body: object, key: string): Promise<boolean> {
    this.claiming.set(key);
    this.error.set(null);
    try {
      const done = await firstValueFrom(this.http.post<ClaimResponse>(this.api.url('/api/drive/progression/me/claim'), body));
      this.board.set(done.board);
      void this.wallet.refresh();
      return true;
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo reclamar la misión'));
      return false;
    } finally {
      this.claiming.set(null);
    }
  }
}
