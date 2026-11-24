import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { APP_TITLE, ErasTitleStrategy } from './eras-title';

describe('ErasTitleStrategy', () => {
  it('names the tab ERAS on every screen, whatever the route calls it', () => {
    const title = TestBed.inject(Title);
    title.setTitle('Partida · ERAS');
    TestBed.inject(ErasTitleStrategy).updateTitle();
    expect(title.getTitle()).toBe(APP_TITLE);
  });
});
