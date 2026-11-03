import { ChangeDetectionStrategy, Component, booleanAttribute, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { AvatarStore } from '@core/auth/avatar.store';
import { AppToolsComponent } from '@core/layout/app-tools.component';
import { Edition } from '@data/editions/edition.model';
import { EditionsStore } from '@data/editions/editions.store';
import { AvatarComponent } from '@ui/domain/avatar/avatar.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { pickBackground } from './hub-rules';

const BACKGROUND_KEY = 'eras-hub-background';

/**
 * Frame of the game-like screens (home, Jugar, Social): edition artwork on the right using the whole height, a
 * flat column in the theme's background color on the left for the menu, and the quick buttons at the top right.
 * The home shows the player's nameplate; the other screens a way back and their title, as every other screen.
 *
 * <eras-hub-screen reroll> <eras-hub-menu hub-menu … /> …more left-column content… </eras-hub-screen>
 */
@Component({
  selector: 'eras-hub-screen',
  imports: [RouterLink, AppToolsComponent, AvatarComponent, IconComponent],
  templateUrl: './hub-screen.component.html',
  styleUrl: './hub-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `title` is an input: without this, a static title="…" also stays on the host as the browser's tooltip
  host: { '[attr.title]': 'null' },
})
export class HubScreenComponent {
  protected readonly auth = inject(AuthService);
  protected readonly avatar = inject(AvatarStore);
  private readonly editions = inject(EditionsStore);
  private readonly router = inject(Router);

  /** Screen name; without it the screen is the home (player card instead of "back"). */
  readonly title = input<string | null>(null);
  /** Where "back" leads (the home unless the screen hangs from another, as Online from Jugar), and its name. */
  readonly back = input<{ route: string; label: string }>({ route: '/home', label: 'el inicio' });
  /** Choose a new artwork (the home); other screens keep the last one. */
  readonly reroll = input(false, { transform: booleanAttribute });

  protected readonly background = signal<Edition | null>(null);

  constructor() {
    // With the editions already cached the artwork is there from the first frame, which is also the one the
    // screen transition captures; otherwise it appears once they load
    if (this.editions.editions().length) this.chooseBackground();
    else void this.editions.load().then(() => this.chooseBackground());
  }

  protected openCards(editionId: string): void {
    void this.router.navigate(['/cards'], { queryParams: { edition: editionId } });
  }

  private chooseBackground(): void {
    const all = this.editions.editions();
    const previous = readSession(BACKGROUND_KEY);
    const kept = this.reroll() ? null : all.find((e) => e.editionId === previous && e.editionImage);
    const chosen = kept ?? pickBackground(all, previous);
    this.background.set(chosen);
    if (chosen) writeSession(BACKGROUND_KEY, chosen.editionId);
  }
}

// Storage can be unavailable (private mode): the hub then just may repeat a background
function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignored, see readSession
  }
}
