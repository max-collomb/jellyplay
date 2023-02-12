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

  saveState(state: any) {
    const route: Route | undefined = this.routes.find((r) => r.name === this.currentRoute.name);
    if (route) {
      this.currentRoute.state = { ...this.currentRoute.state, ...state };
      let url: string;
      url = route.url;
      if (this.currentRoute.id) url = url.replace(':id', this.currentRoute.id.toString());
      window.history.replaceState({}, '', `#${url}/state/${JSON.stringify(this.currentRoute.state)}`);
    }
  }

  saveScrollPosition() {
    this.saveState({ windowScrollPosition: window.pageYOffset });
  }

  restoreScrollPosition() {
    if (this.currentRoute?.state?.windowScrollPosition !== undefined) {
      setTimeout(() => {
        // @ts-ignore en attente d'une correction pour https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1195
        window.scrollTo({ left: 0, top: this.currentRoute?.state?.windowScrollPosition || 0, behavior: 'instant' });
      }, 0);
    }
  }

  navigateTo(url: string, stateProvider?: () => any) {
    if (stateProvider) this.saveState(stateProvider());
    const event = { url, getRoute: () => this.resolveRoute(url), cancel: false };
    eventBus.emit('will-navigate-app', event);
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
