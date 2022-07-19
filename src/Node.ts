import { Amagi, AmagiEvents, Node as AmagiNode, NodeStatus } from './Index';
import Undici from 'undici';
import Aborter from 'abort-controller';

export class Node {
  public rateLimited: boolean = false;

  constructor(protected readonly node: AmagiNode, private readonly amagi: Amagi) {}

  /** Get Node's url */
  protected get url(): string {
    return `${this.node.secure ? 'https' : 'http'}://${this.node.host}`;
  }

  /** Get node's password */
  protected get password(): string {
    return this.node.auth;
  }

  /** Get node's name/identifier */
  public get name(): string {
    return this.node.identifier ?? this.node.host;
  }

  /** Make a get request */
  public async get<T = unknown>(path: string, params?: { [key: string]: any }[]): Promise<T> {
    return this.request('GET', path, params).then((response) => response.json()) as Promise<T>;
  }

  /** Enable a ratelimited node in case the issue has been fixed */
  public enable(): Node {
    this.rateLimited = false;
    return this;
  }

  public async getStatus(): Promise<NodeStatus> {
    let time = process.hrtime();
    const response = await this.request('GET', '/').catch(() => ({ status: 500 }));
    time = process.hrtime(time);

    const dead = response.status !== 400;

    return {
      identifier: this.name,
      status: {
        rateLimited: this.rateLimited,
        dead,
        latency: time[1] / 1000000,
      },
    };
  }

  /** Validate the password */
  public async validateNode(): Promise<void> {
    const response = await this.request('GET', '/').catch(() => ({ status: 500 }));
    if (response.status !== 400 && !this.amagi.options.ignoreDeadNode) throw new Error('Invalid node');
    else if (response.status !== 400 && this.amagi.options.ignoreDeadNode)
      this.amagi.emit(AmagiEvents.DEBUG, `Node ${this.name} failed to validate`);
    else this.amagi.emit(AmagiEvents.DEBUG, `Node ${this.name} validated`);
  }

  /** Make a request to node */
  public async request(method: string, path: string, params?: { [key: string]: any }[]): Promise<any> {
    const abort = AbortController ? new AbortController() : new Aborter();

    setTimeout(() => abort.abort(), this.amagi.options.request?.timeout ?? 10 * 1000);

    let url = this.url + path;
    const options = {
      method,
      headers: {
        'User-Agent': 'Amagi/1.0',
        authorization: `${this.password}`,
      },
    };
    if (params && params.length > 0) {
      url += '?';
      for (const param of params) url += `${Object.keys(param)[0]}=${Object.values(param)[0]}&`;
      url = url.slice(0, -1);
    }
    const time = process.hrtime();
    const response = await Undici.fetch(url, { ...options, signal: abort.signal as AbortSignal }).catch(() => {
      throw new Error('Request failed');
    });
    this.amagi.emit(
      AmagiEvents.REQUEST,
      `
METHOD  :: ${method}
PATH    :: ${path}
URL     :: ${url}
RESPONSE:: ${response.status}
TIME    :: ${process.hrtime(time)[1] / 1000000}ms
        `,
    );
    return response;
  }
}
