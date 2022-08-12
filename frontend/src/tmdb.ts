import { MovieDb } from 'moviedb-promise';
import { MovieResult, TvResult } from 'moviedb-promise/dist/request-types';

import { DbMovie, DbTvshow, DbCredit, ParsedFilename } from '../../api/src/types';

// https://github.com/grantholle/moviedb-promise pour l'api TMDB

export default class TmdbClient {
  tmdbApiKey: string;
  movieDb: MovieDb | undefined;
  lang: string;
  baseUrl: string = "https://image.tmdb.org/t/p/";

  constructor(key: string, language: string) {
    this.tmdbApiKey = key;
    this.lang = language;
  }

  private async initMovieDb(): Promise<void> {
    if (! this.movieDb) {
      this.movieDb = new MovieDb(this.tmdbApiKey);
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

}