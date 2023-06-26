import { MovieDb } from 'moviedb-promise';
import {
  CreditsResponse, MovieResult, TvResult, TvResultsResponse, MovieRecommendationsResponse, MovieResponse, Person, PersonMovieCreditsResponse, PersonTvCreditsResponse, ShowResponse, PersonResult,
} from 'moviedb-promise/dist/request-types';

// https://github.com/grantholle/moviedb-promise pour l'api TMDB

export interface PersonWithCredits extends Person {
  movie_credits: PersonMovieCreditsResponse;
  tv_credits: PersonTvCreditsResponse;
}

export interface Trending {
  movies: MovieResult[],
  tvshows: TvResult[],
}

interface CachedTrending {
  data: Trending;
  expiration: number;
}

export class TmdbClient {
  apiKey: string = '';

  movieDb: MovieDb | undefined;

  lang: string = '';

  baseUrl: string = 'https://image.tmdb.org/t/p/';

  public init(key: string, language: string) {
    this.apiKey = key;
    this.lang = language;
  }

  private async initMovieDb(): Promise<void> {
    if (!this.movieDb) {
      this.movieDb = new MovieDb(this.apiKey);
      await this.movieDb.configuration().then((config) => {
        if (config.images.secure_base_url) {
          this.baseUrl = config.images.secure_base_url;
        }
      });
    }
  }

  public async getMovieCandidates(title: string, year: string): Promise<MovieResult[]> {
    await this.initMovieDb();
    const response = await this.movieDb?.searchMovie({
      language: this.lang,
      query: title,
      year: year ? parseFloat(year) : undefined,
    });
    return response?.results || [];
  }

  public async getTvCandidates(title: string): Promise<TvResult[]> {
    await this.initMovieDb();
    const response = await this.movieDb?.searchTv({
      language: this.lang,
      query: title,
    });
    return response?.results || [];
  }

  public async getMovieRecommandations(movieId: number, pages: number[]): Promise<MovieRecommendationsResponse | undefined> {
    await this.initMovieDb();
    let response;
    let recommandations;
    for (const p of pages) {
      if (!response || (response.total_pages || 0) >= p) {
        // eslint-disable-next-line no-await-in-loop
        recommandations = await this.movieDb?.movieRecommendations({
          language: this.lang,
          id: movieId,
          page: p.toString(),
        });
        if (!response?.results) { response = recommandations; } else {
          response.results = response.results.concat(recommandations?.results || []);
        }
      }
    }
    return response;
  }

  public async getTvshowRecommandations(tvshowId: number, pages: number[]): Promise<TvResultsResponse | undefined> {
    await this.initMovieDb();
    let response;
    let recommandations;
    for (const p of pages) {
      if (!response || (response.total_pages || 0) >= p) {
        // eslint-disable-next-line no-await-in-loop
        recommandations = await this.movieDb?.tvRecommendations({
          language: this.lang,
          id: tvshowId,
          page: p,
        });
        if (!response?.results) { response = recommandations; } else {
          response.results = response.results.concat(recommandations?.results || []);
        }
      }
    }
    return response;
  }

  public async getMovieCredits(movieId: number): Promise<CreditsResponse | undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.movieCredits({
      id: movieId,
      language: this.lang,
    });
    return response;
  }

  public async getMovie(movieId: number): Promise<MovieResponse | undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.movieInfo({
      id: movieId,
      language: this.lang,
      append_to_response: 'release_dates',
    });
    return response;
  }

  public async getTvshowCredits(tvshowId: number): Promise<CreditsResponse | undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.tvCredits({
      id: tvshowId,
      language: this.lang,
    });
    return response;
  }

  public async getTvshow(tvshowId: number): Promise<ShowResponse | undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.tvInfo({
      id: tvshowId,
      language: this.lang,
      append_to_response: 'content_ratings',
    });
    return response;
  }

  public async getPerson(personId: number): Promise<PersonWithCredits | undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.personInfo({
      id: personId,
      language: this.lang,
      append_to_response: 'movie_credits,tv_credits',
    });
    return (response as PersonWithCredits);
  }

  public async searchMulti(query: string): Promise<Array<MovieResult | TvResult | PersonResult> | undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.searchMulti({
      query,
      language: this.lang,
    });
    return response?.results || [];
  }

  public async getTrending(timeWindow: 'week' | 'day' = 'week'): Promise<Trending> {
    await this.initMovieDb();
    const cached: CachedTrending | null = JSON.parse(localStorage.getItem(`trending_${timeWindow}`) || '{}');
    if (cached && cached.expiration > Date.now()) {
      return cached.data;
    }
    const movieResponse = await this.movieDb?.trending({ language: this.lang, media_type: 'movie', time_window: timeWindow });
    const tvshowResponse = await this.movieDb?.trending({ language: this.lang, media_type: 'tv', time_window: timeWindow });
    const trending: Trending = {
      movies: (movieResponse?.results as MovieResult[]) || [],
      tvshows: (tvshowResponse?.results as TvResult[]) || [],
    };
    localStorage.setItem(`trending_${timeWindow}`, JSON.stringify({
      data: trending,
      expiration: new Date(new Date().setHours(23, 59, 59, 999)).getTime(), // today at 23:59:59
    }));
    return trending;
  }
}

export const tmdbClient: TmdbClient = new TmdbClient();
export default tmdbClient;
