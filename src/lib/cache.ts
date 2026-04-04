type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inflightLoads = new Map<string, Promise<T>>();

  public constructor(private readonly defaultTtlMs: number) {}

  public get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  public set(key: string, value: T, ttlMs = this.defaultTtlMs): T {
    const expiresAt = ttlMs <= 0 ? Date.now() : Date.now() + ttlMs;
    this.entries.set(key, { expiresAt, value });
    return value;
  }

  public async getOrLoad(
    key: string,
    loader: () => Promise<T>,
    ttlMs = this.defaultTtlMs
  ): Promise<T> {
    const cachedValue = this.get(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const inflightLoad = this.inflightLoads.get(key);

    if (inflightLoad) {
      return inflightLoad;
    }

    const pendingLoad = loader()
      .then((value) => this.set(key, value, ttlMs))
      .finally(() => {
        this.inflightLoads.delete(key);
      });

    this.inflightLoads.set(key, pendingLoad);
    return pendingLoad;
  }
}
