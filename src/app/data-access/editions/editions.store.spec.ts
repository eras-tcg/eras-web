import 'fake-indexeddb/auto';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_MODE } from '@core/server/server-access';
import { EditionsStore } from './editions.store';

describe('EditionsStore: an edition hidden by an admin', () => {
  let controller: HttpTestingController;
  let store: EditionsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: APP_MODE, useValue: 'browser' }, provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    controller = TestBed.inject(HttpTestingController);
    store = TestBed.inject(EditionsStore);
  });

  afterEach(() => controller.verify());

  it('hides it on the server and reads the editions again', async () => {
    const done = store.setHidden('E3', true);
    const put = controller.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/drive/editions/E3/hidden'));
    expect(put.request.body).toEqual({ hidden: true });
    put.flush({ editionId: 'E3', hidden: true });
    await Promise.resolve();
    await Promise.resolve();
    controller
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/drive/editions'))
      .flush([{ editionId: 'E1' }, { editionId: 'E3', hidden: true }]);
    await done;
    expect(store.catalogEditions().find((e) => e.editionId === 'E3')?.hidden).toBe(true);
  });

  it('reports a readable message when it fails', async () => {
    const done = store.setHidden('E3', false);
    controller
      .expectOne((r) => r.url.endsWith('/api/drive/editions/E3/hidden'))
      .flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });
    await expect(done).rejects.toThrow();
  });
});
