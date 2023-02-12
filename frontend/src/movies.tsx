import React from 'react';

import { DbMovie } from '../../api/src/types';
import { OrderBy } from '../../api/src/enums';

import { ctx } from './common';
import MovieCard from './movie-card';

type MoviesProps = {
  orderBy: OrderBy;
};
type MoviesState = {
  movies: DbMovie[];
  selection?: DbMovie;
};

export default class Movies extends React.Component<MoviesProps, MoviesState> {
  lastOrderBy?: OrderBy;

  constructor(props: MoviesProps) {
    super(props);
    this.state = {
      movies: [],
    };
    this.refreshContent();
    ctx.eventBus.replace('will-navigate', ctx.router.saveScrollPosition.bind(ctx.router));
  }

  componentDidUpdate(_prevProps: MoviesProps, prevState: MoviesState) {
    const { movies } = this.state;
    if (prevState.movies.length === 0 && movies.length > 0) {
      ctx.router.restoreScrollPosition();
    }
    if (ctx.apiClient.needRefresh('movies')) {
      this.refreshContent();
    }
  }

  refreshContent() {
    ctx.apiClient.getMovies().then((movies) => { this.lastOrderBy = undefined; this.setState({ movies }); });
  }

  render(): JSX.Element {
    const { orderBy } = this.props;
    const { movies } = this.state;
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
