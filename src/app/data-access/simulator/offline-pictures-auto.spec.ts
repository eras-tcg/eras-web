import { shouldKeepPicturesNow } from './offline-pictures-auto';

describe('shouldKeepPicturesNow', () => {
  const wifi = { saveData: false, metered: false, slow: false };

  it('the installed app keeps the pictures by itself on wifi, or when the browser does not say', () => {
    expect(shouldKeepPicturesNow({ app: true, canKeep: true, connection: wifi })).toBe(true);
    expect(shouldKeepPicturesNow({ app: true, canKeep: true, connection: null })).toBe(true);
  });

  it('waits on mobile data, Save-Data or 2G', () => {
    expect(shouldKeepPicturesNow({ app: true, canKeep: true, connection: { ...wifi, metered: true } })).toBe(false);
    expect(shouldKeepPicturesNow({ app: true, canKeep: true, connection: { ...wifi, saveData: true } })).toBe(false);
    expect(shouldKeepPicturesNow({ app: true, canKeep: true, connection: { ...wifi, slow: true } })).toBe(false);
  });

  it('never in the browser tab (it has the button) or where pictures cannot be kept', () => {
    expect(shouldKeepPicturesNow({ app: false, canKeep: true, connection: wifi })).toBe(false);
    expect(shouldKeepPicturesNow({ app: true, canKeep: false, connection: wifi })).toBe(false);
  });
});
