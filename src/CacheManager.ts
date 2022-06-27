import { MemoryCache } from './Cache/Memory';
import { StorageCache } from './Cache/Storage';
import { Amagi } from './Index';

export class CacheManager {
  public readonly cache: MemoryCache | StorageCache;

  constructor(private readonly amagi: Amagi) {
    let type: 'memory' | 'storage' = 'memory';
    if (this.amagi.options?.cache?.type === 'storage') type = 'storage';

    this.cache = new (type === 'memory' ? MemoryCache : StorageCache)(
      this.amagi,
      this.amagi.options?.cache?.timeout ?? -1,
    );
  }

  public get enabled(): boolean {
    return this.amagi.options?.cache?.enabled ?? false;
  }
}