/**
 * A store's load that runs once and is shared: a caller while it is on its way waits for the same promise (a page
 * opened during the prefetch waits for it), and once the store says it is loaded it is not run again unless forced.
 * The fetch keeps its own error handling and marks the store loaded when it succeeds.
 *
 *   private readonly loader = new SharedLoad(() => this.fetch(), () => this.loaded);
 *   load(force = false): Promise<void> { return this.loader.run(force); }
 */
export class SharedLoad {
  private pending: Promise<void> | null = null;

  constructor(
    private readonly fetch: () => Promise<void>,
    private readonly loaded: () => boolean,
  ) {}

  /** Runs the fetch unless loaded (`force`: again, even while one is on its way). */
  run(force = false): Promise<void> {
    if (!force && this.loaded()) return Promise.resolve();
    if (!force && this.pending) return this.pending;
    const pending = this.fetch().finally(() => {
      if (this.pending === pending) this.pending = null;
    });
    this.pending = pending;
    return pending;
  }
}
