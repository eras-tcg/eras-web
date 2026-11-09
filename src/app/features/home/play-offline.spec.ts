import { connectionWarning } from './offline-download-dialog.component';
import { playMenu } from './play.page';
import { itemNeedsServer } from './hub-menu.component';
import { ESTIMATED_PICTURE_BYTES, estimateBytes } from '@data/simulator/card-images';

describe('playMenu', () => {
  it('with the server: Modo solo and the Sala de pruebas of the server', () => {
    expect(playMenu({ cutOff: false, offline: false }).map((i) => i.id)).toEqual(['online', 'bot', 'tests', 'tutorial']);
  });

  it('without the connection: both solo modes in this browser, Online left out, the tutorial kept', () => {
    expect(playMenu({ cutOff: true, offline: true }).map((i) => i.id)).toEqual(['offline', 'tests-offline', 'tutorial']);
  });

  it('the installed app not connected: both solo modes in this browser, Online marked (opening it connects)', () => {
    const menu = playMenu({ cutOff: false, offline: false, local: true });
    expect(menu.map((i) => i.id)).toEqual(['online', 'offline', 'tests-offline', 'tutorial']);
    expect(menu.filter(itemNeedsServer).map((i) => i.id)).toEqual(['online']);
  });

  it('the server not answering (but a connection): both solo modes in this browser, Online still tried', () => {
    expect(playMenu({ cutOff: true, offline: false }).map((i) => i.id)).toEqual(['online', 'offline', 'tests-offline', 'tutorial']);
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
