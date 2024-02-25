import React from 'react';

import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import { TvResult, TvResultsResponse } from 'moviedb-promise/dist/request-types';

import { ctx } from './common';
import Rating from './rating';

type TmdbTvshowRecommandationsProps = {
  tvshowId: number;
  hidden: boolean;
};
type TmdbTvshowRecommandationsState = {
  recommandations: TvResult[];
  tvshowIds: Set<number>;
  loading: boolean;
  pageLoaded?: number;
  pageCount: number;
};

export default class TmdbTvshowRecommandations extends React.Component<TmdbTvshowRecommandationsProps, TmdbTvshowRecommandationsState> {
  constructor(props: TmdbTvshowRecommandationsProps) {
    super(props);
    const tvshowIds = new Set<number>();
    this.state = {
      recommandations: [],
      tvshowIds,
      loading: false,
      pageLoaded: undefined,
      pageCount: 1,
    };
    ctx.apiClient.getTvshows().then((tvshows) => {
      tvshows.forEach((tvshow) => tvshowIds.add(tvshow.tmdbid));
      this.setState({ tvshowIds });
    });
  }

  async componentDidUpdate(prevProps: TmdbTvshowRecommandationsProps) {
    const { tvshowId, hidden } = this.props;
    const { pageLoaded } = this.state;
    if (prevProps.tvshowId !== tvshowId) {
      this.setState({ pageLoaded: undefined });
    }
    if (pageLoaded === undefined && !hidden) {
      this.setState({
        recommandations: [],
        loading: false,
        pageLoaded: 0,
        pageCount: 1,
      }, this.loadNextPage.bind(this));
    }
  }

  handleClick(id: number | undefined, evt: React.MouseEvent): void {
    evt.preventDefault();
    if (this.isOwned(id)) {
      ctx.router.navigateTo(`#/tvshow/${id}/state/${JSON.stringify({ tabKey: 'cast' })}`);
    } else {
      ctx.router.navigateTo(`#/tmdb/tvshow/${id}/state/${JSON.stringify({ tabKey: 'cast' })}`);
    }
  }

  async loadNextPage() {
    const { pageLoaded, pageCount, recommandations } = this.state;
    const { tvshowId } = this.props;
    if (pageLoaded !== undefined) {
      this.setState({ loading: true });
      const pages = pageLoaded === 0 ? [1, 2] : [pageLoaded + 1];
      const response: TvResultsResponse | undefined = await ctx.tmdbClient?.getTvshowRecommandations(tvshowId, pages);
      this.setState({
        loading: false,
        recommandations: recommandations.concat(response?.results || []),
        pageCount: response?.total_pages || pageCount,
        pageLoaded: pages[pages.length - 1],
      });
    }
  }

  isOwned(id: number | undefined): boolean {
    const { tvshowIds: movieIds } = this.state;
    return id ? movieIds.has(id) : false;
  }

  renderList(movies: TvResult[]): JSX.Element {
    return (
      <div className="d-flex flex-wrap mt-3">
        {
          movies.map((movie) => (
            <div key={movie.id} className="media-card movie" onClick={this.handleClick.bind(this, movie.id)}>
              <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w342${movie.poster_path})` }} />
              <div>
                {movie.vote_average ? <Rating value={movie.vote_average} /> : undefined}
                <div>
                  <span className="title">{movie.name}</span>
                  <span className="infos d-flex justify-content-between">
                    <span className="year">{movie.first_air_date?.substring(0, 4)}</span>
                  </span>
                </div>
              </div>
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
    const owned: TvResult[] = [];
    const notOwned: TvResult[] = [];
    const ids: Set<number> = new Set<number>();
    recommandations.forEach((r) => {
      if (r.id !== undefined && !ids.has(r.id)) {
        ids.add(r.id);
        if (this.isOwned(r.id)) { owned.push(r); } else { notOwned.push(r); }
      }
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
        {pageLoaded !== undefined && pageLoaded < pageCount
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
