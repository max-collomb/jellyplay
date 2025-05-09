import React from 'react';

import uFuzzy from '@leeoniya/ufuzzy';
import {
  MovieResult, TvResult, PersonResult,
} from 'moviedb-promise/dist/request-types';

import { DbMovie, DbTvshow, DbCredit } from '../../api/src/types';
import { ctx } from './common';
import { tmdbClient } from './tmdb-client';
import Rating from './rating';

type SearchResultsProps = {
  query: string;
  onClose: () => void;
};
type SearchResultsState = {
  movies: DbMovie[];
  tvshows: DbTvshow[];
  credits: DbCredit[];
  movieHaystack: string[];
  movieGenres: { [key: string]: number[] };
  tvshowHaystack: string[];
  tvshowGenres: { [key: string]: number[] };
  creditHaystack: string[];
  movieIds: Set<number>;
  tvshowIds: Set<number>;
  creditIds: Set<number>;
  fuzzyIndex: uFuzzy;
  tmdbResults: Array<MovieResult | TvResult | PersonResult>;
};

export default class SearchResults extends React.Component<SearchResultsProps, SearchResultsState> {
  constructor(props: SearchResultsProps) {
    super(props);
    this.state = {
      movies: [],
      tvshows: [],
      credits: [],
      movieHaystack: [],
      movieGenres: {},
      tvshowHaystack: [],
      tvshowGenres: {},
      creditHaystack: [],
      movieIds: new Set<number>(),
      tvshowIds: new Set<number>(),
      creditIds: new Set<number>(),
      fuzzyIndex: new uFuzzy({}), // eslint-disable-line new-cap
      tmdbResults: [],
    };
    ctx.apiClient.getMovies().then((movies) => {
      const movieHaystack: string[] = uFuzzy.latinize(movies.map((movie) => movie.title + (movie.originalTitle && movie.originalTitle !== movie.title ? ` ${movie.originalTitle}` : '')));
      const { movieIds, movieGenres } = this.state;
      movies.forEach((movie, idx) => {
        movie.genres.forEach((genre) => {
          const latinizedGenre = uFuzzy.latinize([genre])[0].toLowerCase();
          if (!movieGenres[latinizedGenre]) movieGenres[latinizedGenre] = [];
          movieGenres[latinizedGenre].push(idx);
        });
        movieIds.add(movie.tmdbid);
      });
      this.setState({ movies, movieHaystack, movieIds });
    });
    ctx.apiClient.getTvshows().then((tvshows) => {
      const tvshowHaystack: string[] = uFuzzy.latinize(tvshows.map((tvshow) => tvshow.title + (tvshow.originalTitle && tvshow.originalTitle !== tvshow.title ? ` ${tvshow.originalTitle}` : '')));
      const { tvshowIds, tvshowGenres } = this.state;
      tvshows.forEach((tvshow, idx) => {
        tvshow.genres.forEach((genre) => {
          const latinizedGenre = uFuzzy.latinize([genre])[0].toLowerCase();
          if (!tvshowGenres[latinizedGenre]) tvshowGenres[latinizedGenre] = [];
          tvshowGenres[latinizedGenre].push(idx);
        });
        tvshowIds.add(tvshow.tmdbid);
      });
      this.setState({ tvshows, tvshowHaystack, tvshowIds });
    });
    ctx.apiClient.getCredits().then((credits) => {
      const creditHaystack: string[] = uFuzzy.latinize(credits.map((credit) => (credit.profilePath === '' ? '' : credit.name)));
      const { creditIds } = this.state;
      credits.forEach((credit) => creditIds.add(credit.tmdbid));
      this.setState({ credits, creditHaystack });
    });
    ctx.eventBus.replace('will-navigate', ctx.router.saveScrollPosition.bind(ctx.router));
    this.refreshTmdbResults();
  }

  componentDidUpdate(prevProps: Readonly<SearchResultsProps>, prevState: Readonly<SearchResultsState>): void {
    const { movieHaystack, tvshowHaystack, creditHaystack } = this.state;
    if ((prevState.movieHaystack.length === 0 && movieHaystack.length > 0)
      || (prevState.tvshowHaystack.length === 0 && tvshowHaystack.length > 0)
      || (prevState.creditHaystack.length === 0 && creditHaystack.length > 0)) {
      ctx.router.restoreScrollPosition();
    }
    const { query } = this.props;
    if (prevProps.query !== query) {
      this.refreshTmdbResults();
    }
  }

  handleCardClick(type: string, id: number): void {
    if (type === 'movie') {
      const { movieIds } = this.state;
      if (movieIds.has(id)) {
        ctx.router.navigateTo(`#/movie/${id}/state/${JSON.stringify({ tabKey: 'cast' })}`);
      } else {
        ctx.router.navigateTo(`#/tmdb/movie/${id}/state/${JSON.stringify({ tabKey: 'cast' })}`);
      }
    } else if (type === 'tvshow') {
      const { movieIds } = this.state;
      if (movieIds.has(id)) {
        ctx.router.navigateTo(`#/tvshow/${id}/state/${JSON.stringify({ tabKey: 'cast' })}`);
      } else {
        ctx.router.navigateTo(`#/tmdb/tvshow/${id}/state/${JSON.stringify({ tabKey: 'cast' })}`);
      }
    } else if (type === 'credit') {
      ctx.router.navigateTo(`#/tmdb/person/${id}`);
    }
  }

  async refreshTmdbResults(): Promise<void> {
    const { query } = this.props;
    if (query && !query.toLowerCase().startsWith('genre:')) {
      const tmdbResults = await tmdbClient.searchMulti(query);
      this.setState({ tmdbResults: tmdbResults || [] });
    } else {
      setTimeout(() => this.setState({ tmdbResults: [] }), 0);
    }
  }

  render(): JSX.Element {
    const { query: originalQuery, onClose } = this.props;
    const query = uFuzzy.latinize([originalQuery])[0];
    const {
      movies, tvshows, credits, movieHaystack, movieGenres, tvshowHaystack, tvshowGenres, creditHaystack, fuzzyIndex, tmdbResults, movieIds, tvshowIds, creditIds,
    } = this.state;
    let movieResults: DbMovie[] = [];
    let tvshowResults: DbTvshow[] = [];
    let creditResults: DbCredit[] = [];
    const tmdbMovieResults: MovieResult[] = [];
    const tmdbTvshowResults: TvResult[] = [];
    const tmdbPersonResults: PersonResult[] = [];

    if (query) {
      const movieIndexes = (query.toLowerCase().startsWith('genre:'))
        ? (movieGenres[query.substring(6).toLowerCase()] || [])
        : fuzzyIndex.filter(movieHaystack, query);
      movieResults = movieIndexes?.map((idx) => movies[idx]) || [];
      const tvshowIndexes = (query.toLowerCase().startsWith('genre:'))
        ? (tvshowGenres[query.substring(6).toLowerCase()] || [])
        : fuzzyIndex.filter(tvshowHaystack, query);
      tvshowResults = tvshowIndexes?.map((idx) => tvshows[idx]) || [];
      const creditIndexes = (query.toLowerCase().startsWith('genre:'))
        ? []
        : fuzzyIndex.filter(creditHaystack, query);
      creditResults = creditIndexes?.map((idx) => credits[idx]) || [];
      if (tmdbResults) {
        tmdbResults.forEach((result) => {
          const type: string = (result as any).media_type;
          if (type === 'movie' && result.id && (result as MovieResult).poster_path && !movieIds.has(result.id)) {
            tmdbMovieResults.push(result as MovieResult);
          } else if (type === 'tv' && result.id && (result as TvResult).poster_path && !tvshowIds.has(result.id)) {
            tmdbTvshowResults.push(result as TvResult);
          } else if (type === 'person' && result.id && (result as PersonResult).profile_path && !creditIds.has(result.id)) {
            tmdbPersonResults.push(result as PersonResult);
          }
        });
      }
    }

    return (
      <div>
        <div className="position-fixed" style={{ top: '65px', right: '1rem' }}>
          <a href="#" className="link-light" style={{ zIndex: 1 }} onClick={(evt) => { evt.preventDefault(); onClose(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-x-lg" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
            </svg>
          </a>
        </div>
        <h4 className={`${movieResults.length + tmdbMovieResults.length > 0 ? '' : 'd-none'} section-title`}>Films</h4>
        <div className={`${movieResults.length + tmdbMovieResults.length > 0 ? 'd-flex' : 'd-none'} flex-wrap mt-3`}>
          {
            movieResults.map((movie) => (
              <div key={movie.tmdbid} className="media-card movie" onClick={this.handleCardClick.bind(this, 'movie', movie.tmdbid)}>
                <span className="poster" style={{ backgroundImage: `url(/images/posters_w342${movie.posterPath})` }} />
                <div>
                  {movie.rating ? <Rating value={movie.rating} /> : undefined}
                  <div>
                    <span className="title">{movie.title}</span>
                    <span className="infos d-flex justify-content-between">
                      <span className="year">{movie.year}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))
          }
          {
            tmdbMovieResults.map((movie) => (
              <div key={movie.id} className="media-card movie muted" onClick={this.handleCardClick.bind(this, 'movie', movie.id || 0)}>
                <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w342${movie.poster_path})` }} />
                <div>
                  {movie.vote_average ? <Rating value={movie.vote_average} /> : undefined}
                  <div>
                    <span className="title">{movie.title}</span>
                    <span className="infos d-flex justify-content-between">
                      <span className="year">{movie.release_date?.substring(0, 4)}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        <h4 className={`${tvshowResults.length + tmdbTvshowResults.length > 0 ? '' : 'd-none'} section-title`}>Séries</h4>
        <div className={`${tvshowResults.length + tmdbTvshowResults.length > 0 ? 'd-flex' : 'd-none'} flex-wrap mt-3`}>
          {
            tvshowResults.map((tvshow) => (
              <div key={tvshow.tmdbid} className="media-card tvshow" onClick={this.handleCardClick.bind(this, 'tvshow', tvshow.tmdbid)}>
                <span className="poster" style={{ backgroundImage: `url(/images/posters_w342${tvshow.posterPath})` }} />
                <span className="title">{tvshow.title}</span>
                <span className="infos d-flex justify-content-between">
                  <span className="year">
                    {tvshow.seasons.length}
                    {tvshow.seasons.length > 1 ? ' saisons' : ' saison'}
                    &emsp;
                    {tvshow.episodes.length}
                    {tvshow.episodes.length > 1 ? ' épisodes' : ' épisode'}
                  </span>
                </span>
              </div>
            ))
          }
          {
            tmdbTvshowResults.map((tvshow) => (
              <div key={tvshow.id} className="media-card tvshow muted" onClick={this.handleCardClick.bind(this, 'tvshow', tvshow.id || 0)}>
                <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w342${tvshow.poster_path})` }} />
                <div>
                  {tvshow.vote_average ? <Rating value={tvshow.vote_average} /> : undefined}
                  <div>
                    <span className="title">{tvshow.name}</span>
                    <span className="infos d-flex justify-content-between">
                      <span className="year">{tvshow.first_air_date?.substring(0, 4)}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        <h4 className={`${creditResults.length + tmdbPersonResults.length > 0 ? '' : 'd-none'} section-title`}>Personnalités</h4>
        <div className={`${creditResults.length + tmdbPersonResults.length > 0 ? 'd-flex' : 'd-none'} flex-wrap mt-3`}>
          {
            creditResults.map((credit) => (
              <div key={credit.tmdbid} className="media-card credit" onClick={this.handleCardClick.bind(this, 'credit', credit.tmdbid)}>
                <span className="poster" style={{ backgroundImage: `url(/images/profiles_w185${credit.profilePath})` }} />
                <span className="title">{credit.name}</span>
              </div>
            ))
          }
          {
            tmdbPersonResults.map((person) => (
              <div key={person.id} className="media-card credit muted" onClick={this.handleCardClick.bind(this, 'credit', person.id || 0)}>
                <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w342${person.profile_path})` }} />
                <span className="title">{person.name}</span>
              </div>
            ))
          }
        </div>
      </div>
    );
  }
}
