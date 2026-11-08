import 'fake-indexeddb/auto';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PREFETCH_AFTER_MS } from '@core/navigation/preloading';
import { connectionGateInterceptor } from '@core/server/connection-gate.interceptor';
import { APP_MODE, ServerAccess } from '@core/server/server-access';
import { erasStore } from '@core/storage/kv-store';
import { CardsStore } from '../cards/cards.store';
import { DecksStore } from '../decks/decks.store';
import { EditionsStore } from '../editions/editions.store';
import { HomeStore } from '../home/home.store';
import { libraryRecord, offlineLibrary } from '../simulator/offline-library';
import { DataPrefetch } from './data-prefetch';

function signedIn(): void {
  localStorage.setItem('auth_token', 'a.e30.x');
  localStorage.setItem('auth_user', JSON.stringify({ id: 'u1', username: 'ana', permissions: [] }));
}

const deck = { id: 'd1', deckName: 'Guardado', cards: ['f-a'], userId: 'u1' };
const image = { id: 'f-a', name: 'Alfa', edition: 'E1', sub_edition: '', number: 1, color_identity: 'B', image_url: 'https://img/x.png', time_stamp: '' };

describe('the installed app before connecting: data from the device', () => {
  let controller: HttpTestingController;

  beforeEach(async () => {
    signedIn();
    await offlineLibrary.save(libraryRecord('u1', { decks: [deck], images: [image], meta: [{ id: 'm-a', cardName: 'Alfa', edition: 'E1' }], starters: null }));
    await erasStore.set('editions', [{ editionId: 'E1', editionName: 'Primera' }]);
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_MODE, useValue: 'app' },
        provideHttpClient(withInterceptors([connectionGateInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    await offlineLibrary.clear();
    await erasStore.delete('editions');
  });

  it('the background prefetch asks nothing until the player connects, then reads it all', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.inject(DataPrefetch);
    TestBed.tick();
    vi.advanceTimersByTime(PREFETCH_AFTER_MS + 100);
    controller.expectNone(() => true);

    TestBed.inject(ServerAccess).markConnected();
    TestBed.tick();
    vi.advanceTimersByTime(PREFETCH_AFTER_MS + 100);
    expect(controller.match('/api/drive/editions').length).toBe(1);
    expect(controller.match('/api/drive/front-content/home').length).toBe(1);
    expect(controller.match((r) => r.url === '/api/drive/decklists' && r.params.get('userId') === 'u1').length).toBe(1);
    expect(controller.match('/api/drive/cards/db').length).toBe(1);
    // The decks are kept for offline again (its own chunk, made once it arrives)
    const { OfflineLibrarySync } = await import('../simulator/offline-library-sync');
    await vi.waitFor(() => expect(TestBed.inject(OfflineLibrarySync)).toBeTruthy());
    await Promise.resolve();
  });

  it('the player\'s decks, their cards and the editions come from what the device kept; the home asks nothing', async () => {
    const decks = TestBed.inject(DecksStore);
    const cards = TestBed.inject(CardsStore);
    const editions = TestBed.inject(EditionsStore);
    const home = TestBed.inject(HomeStore);
    await Promise.all([decks.loadMine('u1'), cards.load(), editions.load(), home.load()]);
    controller.expectNone(() => true);
    expect(decks.myDecks().map((d) => d.deckName)).toEqual(['Guardado']);
    expect(decks.error()).toBeNull();
    // Not taken as the account's live decks (nothing is kept again from them)
    expect(decks.myDecksOwner()).toBeNull();
    expect(cards.imageList().map((c) => c.id)).toEqual(['f-a']);
    expect(editions.editions().map((e) => e.editionId)).toEqual(['E1']);
    expect(home.error()).toBeNull();

    // Connected: read for real
    TestBed.inject(ServerAccess).markConnected();
    void decks.loadMine('u1');
    controller.expectOne((r) => r.url === '/api/drive/decklists').flush([deck, { ...deck, id: 'd2', deckName: 'Nuevo' }]);
    await vi.waitFor(() => expect(decks.myDecks().length).toBe(2));
    expect(decks.myDecksOwner()).toBe('u1');
  });
});
