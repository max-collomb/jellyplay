import { MovieDb } from 'moviedb-promise';
import {
  CreditsResponse, MovieResult, TvResult, MovieRecommendationsResponse, MovieResponse, Person,
} from 'moviedb-promise/dist/request-types';

// https://github.com/grantholle/moviedb-promise pour l'api TMDB

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
      append_to_response: 'casts,trailers,release_dates',
    });
    return response;
  }

  public async getPerson(personId: number): Promise<Person | undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.personInfo({
      id: personId,
      language: this.lang,
      append_to_response: 'movie_credits,tv_credits',
    });
    return response;
  }
}

export const tmdbClient: TmdbClient = new TmdbClient();
export default tmdbClient;
