import React from 'react';

import { DbCredit, DbMovie } from '../../api/src/types';
import { OrderBy } from '../../api/src/enums';

import { ctx, cleanString } from './common';
import MovieCard from './movie-card';

type MoviesProps = {
  orderBy: OrderBy;
  search: string;
};
type MoviesState = {
  movies: DbMovie[];
  credits: DbCredit[];
  selection?: DbMovie;
};

export default class Movies extends React.Component<MoviesProps, MoviesState> {
  lastOrderBy?: OrderBy;

  constructor(props: MoviesProps) {
    super(props);
    this.handleEventWillNavigate = this.handleEventWillNavigate.bind(this);
    this.handleEventSetSearch = this.handleEventSetSearch.bind(this);
    this.state = {
      movies: [],
      credits: [],
    };
    this.refreshContent();
  }

  componentDidMount() {
    ctx.eventBus.on('set-search', this.handleEventSetSearch);
    ctx.eventBus.on('will-navigate', this.handleEventWillNavigate);
  }

  componentDidUpdate() {
    if (ctx.router.currentRoute?.state?.windowScrollPosition !== undefined) {
      setTimeout(() => {
        // @ts-ignore en attente d'une correction pour https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1195
        window.scrollTo({ left: 0, top: ctx.router.currentRoute?.state?.windowScrollPosition || 0, behavior: 'instant' });
      }, 0);
    }
    if (ctx.apiClient.needRefresh('movies')) {
      this.refreshContent();
    }
  }

  componentWillUnmount() {
    ctx.eventBus.detach('set-search', this.handleEventSetSearch);
    ctx.eventBus.detach('will-navigate', this.handleEventWillNavigate);
  }

  handleEventSetSearch(): void {
    this.forceUpdate();
  }

  handleEventWillNavigate(): void {
    window.history.replaceState({}, '', `#/movies/state/${JSON.stringify({ windowScrollPosition: window.pageYOffset })}`);
  }

  getCreditName(id: number): string {
    const { credits } = this.state;
    for (const credit of credits) {
      if (credit.tmdbid === id) {
        return credit.name;
      }
    }
    return '';
  }

  refreshContent() {
    ctx.apiClient.getMovies().then((movies) => { this.lastOrderBy = undefined; this.setState({ movies }); });
    ctx.apiClient.getCredits().then((credits) => this.setState({ credits }));
  }

  render(): JSX.Element {
    const { orderBy, search } = this.props;
    const { credits } = this.state;
    let { movies } = this.state;
    if (this.lastOrderBy !== orderBy) {
      this.lastOrderBy = orderBy;
      let sortFn: (a: DbMovie, b: DbMovie) => number;
      const { compare } = new Intl.Collator('fr', { usage: 'sort', sensitivity: 'base' });
      switch (orderBy) {
        case OrderBy.addedAsc: sortFn = (a: DbMovie, b: DbMovie) => a.created - b.created; break;
        case OrderBy.titleAsc: sortFn = (a: DbMovie, b: DbMovie) => compare(a.title, b.title); break;
        case OrderBy.titleDesc: sortFn = (a: DbMovie, b: DbMovie) => compare(b.title, a.title); break;
        case OrderBy.yearDesc: sortFn = (a: DbMovie, b: DbMovie) => b.year - a.year; break;
        case OrderBy.yearAsc: sortFn = (a: DbMovie, b: DbMovie) => a.year - b.year; break;
        case OrderBy.filenameAsc: sortFn = (a: DbMovie, b: DbMovie) => compare(a.filename, b.filename); break;
        case OrderBy.filenameDesc: sortFn = (a: DbMovie, b: DbMovie) => compare(b.filename, a.filename); break;
        case OrderBy.addedDesc: /* valeur par défaut */
        default: sortFn = (a: DbMovie, b: DbMovie) => b.created - a.created;
      }
      movies.sort(sortFn);
    }
    if (search && credits.length) {
      movies = movies.filter((m) => {
        if (!m.searchableContent) {
          // eslint-disable-next-line no-param-reassign
          m.searchableContent = cleanString(
            [
              m.filename,
              m.title,
              m.title === m.originalTitle ? '' : m.originalTitle,
              m.genres.join(' '),
              m.countries.join(' '),
              m.cast.map((c) => this.getCreditName(c.tmdbid)).join(' '),
              m.directors.map((d) => this.getCreditName(d)).join(' '),
              m.writers.map((w) => this.getCreditName(w)).join(' '),
            ].join(' '),
          );
        }
        return m.searchableContent.includes(cleanString(search));
      });
    }
    return (
      <div className="d-flex flex-wrap -justify-content-evenly mt-3">
        {
      movies.filter((m) => m.audience <= (ctx.user?.audience || 999))
        .map((movie) => <MovieCard key={movie.tmdbid} movie={movie} onStatusUpdated={() => {}} />)
    }
      </div>
    );
  }
}
