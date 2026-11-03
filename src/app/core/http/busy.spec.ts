import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BACKGROUND, BusyState, busyInterceptor, holdsButtons } from './busy';

describe('holdsButtons', () => {
  it('holds them for a change the player waits for, not for a load or a background request', () => {
    expect(holdsButtons('POST', false)).toBe(true);
    expect(holdsButtons('delete', false)).toBe(true);
    expect(holdsButtons('GET', false)).toBe(false);
    expect(holdsButtons('POST', true)).toBe(false);
  });
});

describe('BusyState', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let state: BusyState;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([busyInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    state = TestBed.inject(BusyState);
  });

  afterEach(() => document.body.replaceChildren());

  it('is busy while a change is on its way, until it answers or fails', () => {
    http.post('/api/a', {}).subscribe({ error: () => undefined });
    http.get('/api/b').subscribe();
    http.post('/api/c', {}, { context: new HttpContext().set(BACKGROUND, true) }).subscribe();
    expect(state.busy()).toBe(true);

    backend.expectOne('/api/a').flush('no', { status: 500, statusText: 'Error' });
    expect(state.busy()).toBe(false);
    backend.expectOne('/api/b').flush({});
    backend.expectOne('/api/c').flush({});
  });

  it('swallows clicks on buttons meanwhile, except those marked to stay usable', () => {
    const button = document.createElement('button');
    const free = document.createElement('button');
    free.setAttribute('data-while-busy', '');
    document.body.append(button, free);
    let clicks = 0;
    button.addEventListener('click', () => clicks++);
    free.addEventListener('click', () => clicks++);

    button.click();
    expect(clicks).toBe(1);

    state.start();
    button.click();
    expect(clicks).toBe(1);
    free.click();
    expect(clicks).toBe(2);

    state.end();
    button.click();
    expect(clicks).toBe(3);
  });
});
