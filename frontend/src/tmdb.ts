import { MovieDb } from 'moviedb-promise';
import { MovieResult, TvResult, MovieRecommendationsResponse, MovieResponse } from 'moviedb-promise/dist/request-types';

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

  public async getMovieRecommandations(movieId: number, pages: number[]): Promise<MovieRecommendationsResponse|undefined> {
    await this.initMovieDb();
    let response;
    let recommandations;
    for(let p of pages) {
      if (! response || (response.total_pages || 0) >= p) {
        recommandations = await this.movieDb?.movieRecommendations({
          language: this.lang,
          id: movieId,
          page: p.toString(),
        });
        if (! response?.results)
          response = recommandations;
        else {
          response.results = response.results.concat(recommandations?.results || []);
        }
      }
    }
    return response;
  }

  public async getMovieCredits(movieId: number): Promise<CreditsResponse|undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.movieCredits({
      id: movieId,
      language: this.lang,
    });
    return response;
  }

  public async getMovie(movieId: number): Promise<MovieResponse|undefined> {
    await this.initMovieDb();
    const response = await this.movieDb?.movieInfo({
      id: movieId,
      language: this.lang,
      append_to_response: 'casts,trailers,release_dates',
    });
    return response;
    // this.log("movieInfo", movieInfo);
/*    if (movieInfo.release_date) {
      movie.year = parseFloat(movieInfo.release_date);
    }
    movie.tmdbid = movieInfo.id || -1;
    movie.title = movieInfo.title || "";
    movie.originalTitle = movieInfo.original_title || "";
    movie.synopsys = movieInfo.overview || "";
    if (movieInfo.id) {
      const credit = await this.movieDb.movieCredits({
        id: movieInfo.id,
        language: this.lang,
      });
      if (credit.crew) {
        for (const crew of credit.crew) {
          if ((crew.job == "Director" || crew.job == "Writer") && crew.id && crew.name) {
            if (crew.job == "Director") {
              if (movie.directors.length >= 5) continue;
              movie.directors.push(crew.id);
            } else if (crew.job == "Writer") {
              if (movie.writers.length >= 5) continue;
              movie.writers.push(crew.id);
            }
            credits.push({
              tmdbid: crew.id,
              name: crew.name,
              profilePath: crew.profile_path || "",
            })
          }
        };
      }
      if (credit.cast) {
        for (const cast of credit.cast) {
          if (cast.name && cast.id) {
            movie.cast.push({ tmdbid: cast.id, character: cast.character || "" });
            credits.push({
              tmdbid: cast.id,
              name: cast.name,
              profilePath: cast.profile_path || "",
            });
            if (movie.cast.length >= 20)
              break;
          }
        }
      }
    }
    if (movieInfo.genres) {
      for (const genre of movieInfo.genres) {
        if (genre.name)
          movie.genres.push(genre.name);
      }
    }
    if (movieInfo.production_countries) {
      for (const country of movieInfo.production_countries) {
        if (country.name) {
          movie.countries.push(country.name);
        }
      }
    }
    const audiences = [];
    if ((movieInfo as any).release_dates?.results) {
      for (const country of (movieInfo as any).release_dates.results) {
        if (country.iso_3166_1 == "US") {
          for (const date of country.release_dates) {
            switch (date.certification) {
              case "NR"   : break;                     // "No rating information."
              case "G"    : audiences.push( 0); break; // "All ages admitted. There is no content that would be objectionable to most parents. This is one of only two ratings dating back to 1968 that still exists today."
              case "PG"   : audiences.push(10); break; // "Some material may not be suitable for children under 10. These films may contain some mild language, crude/suggestive humor, scary moments and/or violence. No drug content is present. There are a few exceptions to this rule. A few racial insults may also be heard."
              case "PG-13": audiences.push(12); break; // "Some material may be inappropriate for children under 13. Films given this rating may contain sexual content, brief or partial nudity, some strong language and innuendo, humor, mature themes, political themes, terror and/or intense action violence. However, bloodshed is rarely present. This is the minimum rating at which drug content is present."
              case "R"    : audiences.push(16); break; // "Under 17 requires accompanying parent or adult guardian 21 or older. The parent/guardian is required to stay with the child under 17 through the entire movie, even if the parent gives the child/teenager permission to see the film alone. These films may contain strong profanity, graphic sexuality, nudity, strong violence, horror, gore, and strong drug use. A movie rated R for profanity often has more severe or frequent language than the PG-13 rating would permit. An R-rated movie may have more blood, gore, drug use, nudity, or graphic sexuality than a PG-13 movie would admit."
              case "NC-17": audiences.push(18); break; // "These films contain excessive graphic violence, intense or explicit sex, depraved, abhorrent behavior, explicit drug abuse, strong language, explicit nudity, or any other elements which, at present, most parents would consider too strong and therefore off-limits for viewing by their children and teens. NC-17 does not necessarily mean obscene or pornographic in the oft-accepted or legal meaning of those words."
            }
          };
        } else if (country.iso_3166_1 == "FR") {
          for (const date of country.release_dates) {
            switch (date.certification) {
              case "U" : audiences.push( 0); break; // "(Tous publics) valid for all audiences."
              case "10": audiences.push(10); break; // "(Déconseillé aux moins de 10 ans) unsuitable for children younger than 10 (this rating is only used for TV); equivalent in theatres : \"avertissement\" (warning), some scenes may be disturbing to young children and sensitive people; equivalent on video : \"accord parental\" (parental guidance)."
              case "12": audiences.push(12); break; // "(Interdit aux moins de 12 ans) unsuitable for children younger than 12 or forbidden in cinemas for under 12."
              case "16": audiences.push(16); break; // "(Interdit aux moins de 16 ans) unsuitable for children younger than 16 or forbidden in cinemas for under 16."
              case "18": audiences.push(18); break; // "(Interdit aux mineurs) unsuitable for children younger than 18 or forbidden in cinemas for under 18."
            }
          };
        }
      }
    }
    movie.audience = (audiences.length) ? Math.max.apply(null, audiences) : 999;
    if (movieInfo.backdrop_path) {
      this.log(`[+] downloading movie backdrop w1280${movieInfo.backdrop_path}`);
      await downloadImage(
        `${this.baseUrl}w1280${movieInfo.backdrop_path}`,
        path.join(this.imagePath, 'backdrops_w1280', movieInfo.backdrop_path)
      );
      movie.backdropPath = movieInfo.backdrop_path;
    }
    if (movieInfo.poster_path) {
      this.log(`[+] downloading movie poster w780${movieInfo.poster_path}`);
      await downloadImage(
        `${this.baseUrl}w780${movieInfo.poster_path}`,
        path.join(this.imagePath, 'posters_w780', movieInfo.poster_path)
      );
      this.log(`[+] downloading movie poster w342${movieInfo.poster_path}`);
      await downloadImage(
        `${this.baseUrl}w342${movieInfo.poster_path}`,
        path.join(this.imagePath, 'posters_w342', movieInfo.poster_path)
      );
      movie.posterPath = movieInfo.poster_path;
    }
    return credits;*/
  }

}