import { SharedLoad } from './shared-load';

describe('SharedLoad', () => {
  const setup = () => {
    let loaded = false;
    let calls = 0;
    let finish: () => void = () => undefined;
    const loader = new SharedLoad(
      () => {
        calls++;
        return new Promise<void>((resolve) => {
          finish = () => {
            loaded = true;
            resolve();
          };
        });
      },
      () => loaded,
    );
    return { loader, calls: () => calls, finish: () => finish() };
  };

  it('shares a load on its way and does not run again once loaded', async () => {
    const { loader, calls, finish } = setup();
    const first = loader.run();
    const second = loader.run();
    expect(second).toBe(first);
    finish();
    await first;
    await loader.run();
    expect(calls()).toBe(1);
  });

  it('runs again when forced, even while one is on its way', async () => {
    const { loader, calls, finish } = setup();
    void loader.run();
    const forced = loader.run(true);
    finish();
    await forced;
    expect(calls()).toBe(2);
  });

  it('runs again after a load that failed to mark the store loaded', async () => {
    let calls = 0;
    const loader = new SharedLoad(async () => void calls++, () => false);
    await loader.run();
    await loader.run();
    expect(calls).toBe(2);
  });
});
