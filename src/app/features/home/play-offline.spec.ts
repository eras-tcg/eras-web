import { connectionWarning } from './offline-download-dialog.component';
import { playMenu } from './play.page';
import { itemNeedsServer } from './hub-menu.component';
import { ESTIMATED_PICTURE_BYTES, estimateBytes } from '@data/simulator/card-images';

describe('playMenu', () => {
  it('with the server: Modo solo, no offline mode', () => {
    expect(playMenu({ cutOff: false, offline: false }).map((i) => i.id)).toEqual(['online', 'bot', 'tests', 'tutorial']);
  });

  it('without the connection: Modo solo sin conexión in its place, the server modes left out, the tutorial kept', () => {
    expect(playMenu({ cutOff: true, offline: true }).map((i) => i.id)).toEqual(['offline', 'tutorial']);
  });

  it('the installed app not connected: Modo solo sin conexión in place of Modo solo, the server modes marked (opening one connects)', () => {
    const menu = playMenu({ cutOff: false, offline: false, local: true });
    expect(menu.map((i) => i.id)).toEqual(['online', 'offline', 'tests', 'tutorial']);
    expect(menu.filter(itemNeedsServer).map((i) => i.id)).toEqual(['online', 'tests']);
  });

  it('the server not answering (but a connection): the offline mode in place of Modo solo, the rest still tried', () => {
    expect(playMenu({ cutOff: true, offline: false }).map((i) => i.id)).toEqual(['online', 'offline', 'tests', 'tutorial']);
  });
});

describe('the offline download', () => {
  it('warns before a big download on a costly connection', () => {
    expect(connectionWarning(null)).toBeNull();
    expect(connectionWarning({ saveData: true, metered: true, slow: false })).toContain('ahorro de datos');
    expect(connectionWarning({ saveData: false, metered: true, slow: false })).toContain('datos móviles');
    expect(connectionWarning({ saveData: false, metered: false, slow: false })).toBeNull();
  });

  it('estimates the size with a guess, then with the measured average', () => {
    expect(estimateBytes(10)).toBe(10 * ESTIMATED_PICTURE_BYTES);
    expect(estimateBytes(10, { bytes: 3000, measured: 3 })).toBe(10_000);
  });
});
