import EventEmitter from 'events';
import { CacheManager } from './CacheManager';
import { Node as NodeManager } from './Node';

export declare interface Amagi {
  /**
   * Debug purpose.
   * @event Amagi#debug
   */
  on(event: 'debug', listener: (value: string) => void): this;
  /**
   * Emitted when node get rate limited.
   * @event Amagi#rateLimited
   */
  on(event: 'rateLimited', listener: (node: NodeManager) => void): this;
  /**
   * Emitted when a request made.
   * @event Amagi#rateLimited
   */
  on(event: 'request', listener: (request: string) => void): this;
}

export class Amagi extends EventEmitter {
  /** All nodes */
  public readonly nodes: Map<string, NodeManager> = new Map();
  /** The cache manager */
  public readonly cache: CacheManager;
  /** Amagi options */
  public readonly options: AmagiOptions;
  /** Whether the module is loaded */
  private loaded: boolean = false;

  protected readonly engines: { [key: string]: string } = {
    youtube: 'ytsearch:',
    youtubeMusic: 'ytmsearch:',
    soundcloud: 'scsearch:',
  };

  /**
   * Initialize the module.
   * @param _nodes The nodes to use.
   * @param options AmagiOptions
   */
  constructor(private readonly _nodes: Node[], options?: AmagiOptions) {
    super();
    this.options = this.mergeDefaults(options);
    this.cache = new CacheManager(this);

    if (this.options?.plugins) {
      for (const [, plugin] of this.options?.plugins.entries()) {
        if (!plugin.load || !plugin.unload) throw new Error('Plugin must have load and unload functions');
        plugin.load(this);
      }
    }
  }

  /**
   * Search a song
   * @param query The query to search for.
   * @param options SearchOptions
   * @returns The search results.
   */
  public async search(query: string, options: SearchOptions): Promise<SearchResult> {
    if (!this.loaded) throw new Error('Nodes not loaded');

    options = options ?? {};
    options.engine = this.engines[options.engine ?? this.options?.defaultEngine ?? 'youtube'] as SearchEngines;

    const node = this.getRandomNode();
    if (!node) throw new Error('No nodes available');

    const isUrl = /^(http|https):\/\//.test(query);
    if (!isUrl) query = `${options.engine}${query}`;

    if (this.cache.enabled) {
      const cached = await this.cache.cache.get<SearchResult>(query);

      if (cached) {
        this.emit(AmagiEvents.DEBUG, `Cache hit for ${query}`);
        cached.nodeUsed = 'cache';
        return cached;
      }
    }

    let results = await node.get<SearchResult>(`/loadtracks`, [{ identifier: query }]);

    while (results.loadType === 'LOAD_FAILED' && results.exception && results.exception.message.includes('429')) {
      this.emit(AmagiEvents.DEBUG, `${node.name} rate limited, using another node...`);
      this.emit(AmagiEvents.RATE_LIMITED, node);
      node.rateLimited = true;
      const _node = this.getRandomNode();
      if (!_node) throw new Error('No nodes available');
      results = await _node.get<SearchResult>(`/loadtracks`, [{ identifier: query }]);
    }

    if (this.options?.modifyTracks && typeof this.options.modifyTracks === 'function')
      results.tracks = results.tracks.map((t) => this.options!.modifyTracks!(t as Track));

    if (this.cache.enabled) this.cache.cache.set(query, results);
    return { ...results, nodeUsed: node.name };
  }

  /**
   * Get node's and cache status
   * @returns Promise<Status>
   */
  public async getStatus(): Promise<Status> {
    const nodes = Array.from(this.nodes.values());
    const status: Status = {
      nodes: await Promise.all(nodes.map((node) => node.getStatus())),
      cache: {
        enabled: this.options.cache?.enabled ?? false,
        type: this.options.cache?.type ?? 'memory',
        timeout: this.options.cache?.timeout ?? -1,
        total: this.cache.cache.total(),
      },
    };
    return status;
  }

  /**
   * Get a random node.
   * @returns The random node.
   */
  private getRandomNode(): NodeManager {
    const nodeArray = Array.from(this.nodes.values()).filter((node) => !node.rateLimited);
    return nodeArray[Math.floor(Math.random() * nodeArray.length)];
  }

  /**
   * Initialize the module.
   * @returns void
   */
  public async init(): Promise<void> {
    if (this.loaded) return;

    this.emit(AmagiEvents.DEBUG, 'Validating nodes...');
    await Promise.all(
      this._nodes.map(async (node) => {
        const _node = new NodeManager(node, this);
        await _node.validateNode();
        const name = node.identifier ?? node.host;
        this.nodes.set(name, _node);
      }),
    );

    this.emit(AmagiEvents.DEBUG, `${this.nodes.size} nodes loaded`);
    this.loaded = true;
  }

  protected mergeDefaults(options?: AmagiOptions): AmagiOptions {
    return {
      defaultEngine: 'youtube',
      modifyTracks: undefined,
      plugins: [],
      ignoreDeadNode: false,
      cache: {
        enabled: false,
        type: 'memory',
        timeout: -1,
      },
      ...options,
    };
  }
}

export interface Status {
  nodes: NodeStatus[];
  cache: CacheStatus;
}

export interface CacheStatus {
  enabled: boolean;
  type: 'memory' | 'storage';
  timeout: number;
  total: number;
}

export interface NodeStatus {
  identifier: string;
  status: {
    rateLimited: boolean;
    dead: boolean;
    latency: number;
  };
}

export type LoadType = 'TRACK_LOADED' | 'PLAYLIST_LOADED' | 'SEARCH_RESULT' | 'NO_MATCHES' | 'LOAD_FAILED';

export interface Track {
  track: string;
  info: {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    isStream: boolean;
    position: number;
    title: string;
    uri: string;
    sourceName: string;
  };
}

export type SearchEngines = 'youtube' | 'soundcloud' | 'youtube_music' | string;

export interface SearchOptions {
  engine?: SearchEngines;
}

export interface SearchResult {
  /** Result loadType */
  loadType: LoadType;
  /** Playlist info if exist */
  playlistInfo: {
    name?: string;
    selectedTrack?: number;
  };
  /** Track results */
  tracks: Track[] | any[];
  /** Exception if exist */
  exception?: {
    message: string;
    severity: string;
  };
  /** Node used */
  nodeUsed: string;
}

export const AmagiEvents = {
  DEBUG: 'debug',
  RATE_LIMITED: 'rateLimited',
  REQUEST: 'request',
};

export interface AmagiOptions {
  /** Cache configuration */
  cache?: {
    /** Enable cache */
    enabled?: boolean;
    /** Cache timeout. -1 for infinity. Default to -1. (in second) */
    timeout?: number;
    /** Cache type. Default to memory */
    type?: 'memory' | 'storage';
  };
  /** The default search engine */
  defaultEngine?: SearchEngines;
  /** If you want to modify track result to something else */
  modifyTracks?: (track: Track | undefined) => any;
  /** Plugins */
  plugins?: any[];
  /** Ignore a dead node on init by not throwing an error. Default to false */
  ignoreDeadNode?: boolean;
}

export interface Node {
  /** The name of the node. */
  identifier: string;
  /** The node's host. domain:port */
  host: string;
  /** The node's password */
  auth: string;
  /** Whether is secure or not */
  secure?: boolean;
}
