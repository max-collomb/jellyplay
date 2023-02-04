import React from 'react';

import Button from 'react-bootstrap/Button';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Spinner from 'react-bootstrap/Spinner';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { MovieResult, MovieRecommendationsResponse } from 'moviedb-promise/dist/request-types';

import { Cast, Config, DbMovie, DbTvshow, DbUser, Episode, Season, UserEpisodeStatus, UserTvshowStatus } from '../../api/src/types';
import { OrderBy, SeenStatus } from '../../api/src/enums';
import { MoreToggle, MultiItem, getEpisodeUserStatus, getTvshowUserStatus, playTvshow, getEpisodeProgress, getEpisodeDuration, renderFileSize, renderVideoInfos, renderAudioInfos, getEpisodeCount, getSeasonCount, selectCurrentSeason } from './common';
import apiClient from './api-client';
import eventBus from './event-bus';
import TmdbClient from './tmdb';
import { router } from './router';

import FixTvshowMetadataForm from './fix-tvshow-metadata-form';

type TmdbRecommandationsProps = {
  movieId: number;
  hidden?: boolean;
  tmdbClient?: TmdbClient;
};
type TmdbRecommandationsState = {
  recommandations: MovieResult[];
  movieIds: Set<number>;
  loading: boolean;
  pageLoaded: number;
  pageCount: number;
};

export default class TmdbRecommandations extends React.Component<TmdbRecommandationsProps, TmdbRecommandationsState> {

  constructor(props: TmdbRecommandationsProps) {
    super(props);
    const movieIds = new Set<number>();
    this.state = {
      recommandations: [],
      movieIds,
      loading: false,
      pageLoaded: 0,
      pageCount: 1,
    };
    apiClient.getMovies().then(movies => {
      movies.forEach(movie => movieIds.add(movie.tmdbid));
      this.setState({ movieIds });
    });
  }

  async componentDidUpdate(prevProps: TmdbRecommandationsProps, _prevState: TmdbRecommandationsState) {
    if (prevProps.movieId != this.props.movieId) {
      this.setState({ pageLoaded: 0 });
    }
    if (this.state.pageLoaded == 0 && !this.props.hidden) {
      this.setState({
        recommandations: [],
        loading: false,
        pageLoaded: 1,
        pageCount: 1,
      }, this.loadNextPage.bind(this));
    }
  }

  async loadNextPage() {
    this.setState({ loading: true });
    const pages = this.state.pageLoaded == 0 ? [1, 2] : [this.state.pageLoaded + 1];
    const response: MovieRecommendationsResponse|undefined = await this.props.tmdbClient?.getMovieRecommandations(this.props.movieId, pages);
    this.setState({
      loading: false,
      recommandations: this.state.recommandations.concat(response?.results || []),
      pageCount: response?.total_pages || this.state.pageCount,
      pageLoaded: pages[pages.length - 1],
    });
  }

  isOwned(id: number|undefined): boolean {
    return id ? this.state.movieIds.has(id) : false;
  }

  handleClick(id: number|undefined, evt: React.MouseEvent): void {
    evt.preventDefault();
    if (this.isOwned(id)) {
      router.navigateTo(`#/movie/${id}/state/` + JSON.stringify({ tabKey: "cast" }));
    } else {
      router.navigateTo(`#/tmdb/movie/${id}/state/` + JSON.stringify({ tabKey: "cast" }));
    }
  }

  renderList(movies: MovieResult[]): JSX.Element {
    return <div className="d-flex flex-wrap mt-3">{
      movies.map((movie, idx) => {
        return <div key={idx} className="media-card movie" onClick={this.handleClick.bind(this, movie.id)}>
          <span className="poster" style={{ backgroundImage: `url(${this.props.tmdbClient?.baseUrl}w342${movie.poster_path})` }}></span>
          <span className="title">{movie.title}</span>
          <span className="infos d-flex justify-content-between">
            <span className="year">{movie.release_date?.substring(0, 4)}</span>
          </span>
        </div>;
      })}
    </div>;
  }

  render(): JSX.Element {
    const owned: MovieResult[] = [];
    const notOwned: MovieResult[] = [];
    this.state.recommandations.forEach(r => {
      if (this.isOwned(r.id))
        owned.push(r);
      else
        notOwned.push(r);
    });
    return <div>
    { owned.length ? <>{ this.renderList(owned) }<hr/></> : null }
    { this.renderList(notOwned) }
    { this.state.loading
        ? <div className="text-center"><Spinner animation="border" variant="light" /></div>
        : null }
    { this.state.pageLoaded < this.state.pageCount
        ? <div className="mt-3 text-center">
            <Button variant="outline-secondary" onClick={this.loadNextPage.bind(this)}>Plus</Button>
          </div>
        : null }
    </div>;
  }
}
