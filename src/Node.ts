import { Amagi, AmagiEvents, Node as AmagiNode } from './Index';
import Undici from 'undici';

export class Node {
  public rateLimited: boolean = false;

  constructor(protected readonly node: AmagiNode, private readonly amagi: Amagi) {}

  protected get url(): string {
    return `${this.node.secure ? 'https' : 'http'}://${this.node.host}`;
  }

  protected get password(): string {
    return this.node.auth;
  }

  public get name(): string {
    return this.node.identifier ?? this.node.host;
  }

  public async get<T = unknown>(path: string, params?: { [key: string]: any }[]): Promise<T> {
    return this.request('GET', path, params).then((response) => response.json()) as Promise<T>;
  }

  public async validateNode(): Promise<void> {
    const response = await this.request('GET', '/');
    if (response.status !== 400) throw new Error('Invalid node');
    this.amagi.emit(AmagiEvents.DEBUG, `Node ${this.name} validated`);
  }

  public async request(method: string, path: string, params?: { [key: string]: any }[]): Promise<any> {
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
    const response = await Undici.fetch(url, options);
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
