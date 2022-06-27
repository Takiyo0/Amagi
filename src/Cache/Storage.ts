import flatCache from 'flat-cache';
import { Amagi, AmagiEvents } from '../Index';

export class StorageCache {
  private cache: flatCache.Cache;

  constructor(private readonly amagi: Amagi, timeout: number = -1) {
    this.cache = flatCache.load('amagi');

    if (timeout > 0) {
      setInterval(() => {
        this.clear();
        this.amagi.emit(AmagiEvents.DEBUG, 'Cache cleared');
      }, timeout * 1000);
    }
  }

  public get<T = unknown>(key: string): T | undefined {
    return this.cache.getKey(key);
  }

  public set<T = unknown>(key: string, value: T): void {
    this.cache.setKey(key, value);
    this.save();
    this.amagi.emit(AmagiEvents.DEBUG, `Cache set: ${key}`);
  }

  public delete(key: string): void {
    this.cache.removeKey(key);
  }

  public clear(): void {
    const keys = this.cache.all();
    for (const key in keys) this.delete(key);
  }

  protected save(): void {
    this.cache.save();
  }
}
