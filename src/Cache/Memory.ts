import { Amagi, AmagiEvents } from '../Index';

export class MemoryCache {
  private cache: { [key: string]: any } = {};

  constructor(private readonly amagi: Amagi, timeout: number = -1) {
    if (timeout > 0) {
      setInterval(() => {
        this.clear();
        this.amagi.emit(AmagiEvents.DEBUG, 'Cache cleared');
      }, timeout * 1000);
    }
  }

  public get<T = unknown>(key: string): T | undefined {
    return this.cache[key];
  }

  public set<T = unknown>(key: string, value: T): void {
    this.cache[key] = value;
    this.amagi.emit(AmagiEvents.DEBUG, `Cache set: ${key}`);
  }

  public delete(key: string): void {
    delete this.cache[key];
  }

  public clear(): void {
    this.cache = {};
  }

  public total(): number {
    return Object.keys(this.cache).length;
  }
}
