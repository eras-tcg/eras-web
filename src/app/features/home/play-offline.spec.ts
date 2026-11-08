import { connectionWarning } from './offline-download-dialog.component';
import { playMenu } from './play.page';
import { ESTIMATED_PICTURE_BYTES, estimateBytes } from '@data/simulator/card-images';

describe('playMenu', () => {
  it('with the server: its modes, then Modo solo sin conexión', () => {
    expect(playMenu({ cutOff: false, offline: false }).map((i) => i.id)).toEqual(['online', 'bot', 'tests', 'tutorial', 'offline']);
  });

  it('without the connection: Modo solo sin conexión first, the server modes left out, the tutorial kept', () => {
    expect(playMenu({ cutOff: true, offline: true }).map((i) => i.id)).toEqual(['offline', 'tutorial']);
  });

  it('the server not answering (but a connection): first offline, the rest still tried', () => {
    expect(playMenu({ cutOff: true, offline: false }).map((i) => i.id)).toEqual(['offline', 'online', 'bot', 'tests', 'tutorial']);
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
