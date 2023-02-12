import React from 'react';

import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import { MovieResult, MovieRecommendationsResponse } from 'moviedb-promise/dist/request-types';

import { ctx } from './common';

type TmdbMovieRecommandationsProps = {
  movieId: number;
  hidden: boolean;
};
type TmdbMovieRecommandationsState = {
  recommandations: MovieResult[];
  movieIds: Set<number>;
  loading: boolean;
  pageLoaded: number;
  pageCount: number;
};

export default class TmdbMovieRecommandations extends React.Component<TmdbMovieRecommandationsProps, TmdbMovieRecommandationsState> {
  constructor(props: TmdbMovieRecommandationsProps) {
    super(props);
    const movieIds = new Set<number>();
    this.state = {
      recommandations: [],
      movieIds,
      loading: false,
      pageLoaded: 0,
      pageCount: 1,
    };
    ctx.apiClient.getMovies().then((movies) => {
      movies.forEach((movie) => movieIds.add(movie.tmdbid));
      this.setState({ movieIds });
    });
  }

  async componentDidUpdate(prevProps: TmdbMovieRecommandationsProps) {
    const { movieId, hidden } = this.props;
    const { pageLoaded } = this.state;
    if (prevProps.movieId !== movieId) {
      this.setState({ pageLoaded: 0 });
    }
    if (pageLoaded === 0 && !hidden) {
      this.setState({
        recommandations: [],
        loading: false,
        pageLoaded: 1,
        pageCount: 1,
      }, this.loadNextPage.bind(this));
    }
  }

  handleClick(id: number | undefined, evt: React.MouseEvent): void {
    evt.preventDefault();
    if (this.isOwned(id)) {
      ctx.router.navigateTo(`#/movie/${id}/state/${JSON.stringify({ tabKey: 'cast' })}`);
    } else {
      ctx.router.navigateTo(`#/tmdb/movie/${id}/state/${JSON.stringify({ tabKey: 'cast' })}`);
    }
  }

  async loadNextPage() {
    const { pageLoaded, pageCount, recommandations } = this.state;
    const { movieId } = this.props;
    this.setState({ loading: true });
    const pages = pageLoaded === 0 ? [1, 2] : [pageLoaded + 1];
    const response: MovieRecommendationsResponse | undefined = await ctx.tmdbClient?.getMovieRecommandations(movieId, pages);
    this.setState({
      loading: false,
      recommandations: recommandations.concat(response?.results || []),
      pageCount: response?.total_pages || pageCount,
      pageLoaded: pages[pages.length - 1],
    });
  }

  isOwned(id: number | undefined): boolean {
    const { movieIds } = this.state;
    return id ? movieIds.has(id) : false;
  }

  renderList(movies: MovieResult[]): JSX.Element {
    return (
      <div className="d-flex flex-wrap mt-3">
        {
          movies.map((movie) => (
            <div key={movie.id} className="media-card movie" onClick={this.handleClick.bind(this, movie.id)}>
              <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w342${movie.poster_path})` }} />
              <span className="title">{movie.title}</span>
              <span className="infos d-flex justify-content-between">
                <span className="year">{movie.release_date?.substring(0, 4)}</span>
              </span>
            </div>
          ))
        }
      </div>
    );
  }

  render(): JSX.Element {
    const {
      recommandations, loading, pageLoaded, pageCount,
    } = this.state;
    const owned: MovieResult[] = [];
    const notOwned: MovieResult[] = [];
    recommandations.forEach((r) => {
      if (this.isOwned(r.id)) { owned.push(r); } else { notOwned.push(r); }
    });
    return (
      <div style={{ minHeight: '800px' }}>
        { owned.length ? (
          <>
            { this.renderList(owned) }
            <hr />
          </>
        ) : null }
        { this.renderList(notOwned) }
        { loading
          ? <div className="text-center"><Spinner animation="border" variant="light" /></div>
          : null }
        { pageLoaded < pageCount
          ? (
            <div className="mt-3 text-center">
              <Button variant="outline-secondary" onClick={this.loadNextPage.bind(this)}>Plus</Button>
            </div>
          )
          : null }
      </div>
    );
  }
}
