import { eventBus } from './event-bus';

export type Route = {
  name: string;
  url: string;
  regexp: RegExp;
};

export type MatchedRoute = {
  name: string;
  id?: number;
  state?: any;
};

export class Router {
  private routes: Route[];

  currentRoute: MatchedRoute;

  constructor() {
    this.routes = [];
    this.currentRoute = { name: 'home', state: {} };
    window.addEventListener('hashchange', this.onHashChanged.bind(this));
  }

  add(name: string, url: string) {
    this.routes.push({
      name,
      url,
      regexp: new RegExp(`^${url.replace(':id', '(\\d+)')}(?:/state/({.*}))?`, 'i'),
    });
  }

  navigateTo(url: string) {
    const event = { url, getRoute: () => this.resolveRoute(url), cancel: false };
    eventBus.emit('will-navigate', event);
    if (!event.cancel) {
      document.location.href = url;
    }
  }

  onHashChanged(): void {
    const url = window.location.hash.slice(1) || '/';
    this.currentRoute = this.resolveRoute(url);
    eventBus.emit('hash-changed', { route: this.currentRoute });
  }

  resolveRoute(url: string): MatchedRoute {
    for (const route of this.routes) {
      const match = route.regexp.exec(url);
      if (match != null) {
        return {
          name: route.name,
          id: match.length > 2 ? (parseFloat(match[1]) || undefined) : undefined,
          state: match[match.length - 1] ? JSON.parse(decodeURIComponent(match[match.length - 1])) : {},
        };
      }
    }

    return { name: this.routes[0]?.name || '' };
  }
}

export const router: Router = new Router();
