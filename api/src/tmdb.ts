import path from 'path';
import childProcess from 'child_process';
import { createWriteStream, statSync, existsSync } from 'fs';
import * as https from 'https';


import { filenameParse, ParsedShow } from '@ctrl/video-filename-parser';
import { MovieDb } from 'moviedb-promise';

import { DbMovie, DbTvshow, DbCredit, Episode, ExtractedMovieInfos, Season } from './types';

// https://github.com/grantholle/moviedb-promise pour l'api TMDB

// https://gitlab.com/demsking/image-downloader/-/blob/main/lib/request.js
const downloadImage = async (url: string, dest: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (existsSync(dest)) {
      resolve(dest);
      return;
    }
    https
      .get(url, {}, (res) => {
        if (res.statusCode !== 200) {
          // Consume response data to free up memory
          res.resume();
          reject(new Error('Request Failed.\n' +
                           `Status Code: ${res.statusCode}`));
          return;
        }

        res.pipe(createWriteStream(dest))
          .on('error', reject)
          .once('close', () => resolve(dest));
      })
      .on('timeout', () => reject(new Error("TimeoutError")))
      .on('error', reject);
  });
};

export const extractMovieTitle = function(filename: string): ExtractedMovieInfos {
  filename = filename.split(path.sep).pop() || filename;
  const yearExecArray: RegExpExecArray|null = /\(([0-9]+)\)/.exec(filename);
  const idExecArray: RegExpExecArray|null = /\[.*id([0-9]+).*\]/.exec(filename);
  return {
    title: filename .replace(/\s*\[.*?\]\s*/g, '')
                    .replace(/\s*\(.*?\)\s*/g, '')
                    .replace(/\.(avi|mkv|mp4|m4p|m4v|mpg|mpeg|mp2|mpe|mpv|wmv)/ig, '')
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase(),
    year: (yearExecArray)
            ? yearExecArray[1]
            : null,
    tmdbid: (idExecArray)
              ? parseFloat(idExecArray[1])
              : null,
  };
}

export const mediaInfo = async (movie: DbMovie|Episode, filename: string, log: (msg: string) => void): Promise<any> => {
  return new Promise((resolve, reject) => {
    var mediainfoDir = path.join(global.process.cwd(), 'mediainfo'),
      executable = process.platform == "win32" ? path.join(mediainfoDir, 'MediaInfo.exe') : 'mediainfo';

    // console.log(`${executable} --Inform=file://${mediainfoDir.replace(/\\/g, '/')}/media_json.txt "${filename}"`);
    childProcess.exec(
      `${executable} --Inform=file://${mediainfoDir.replace(/\\/g, '/')}/media_json.txt "${filename}"`,
      function(error, stdout, stderr) {
        if (error) {
          resolve({});
        } else {
          try {
            const json = JSON.parse(stdout);
            // console.log("media info for " + filename, json);
            movie.created = statSync(filename).birthtime.getTime();
            movie.filesize = json.general.size;
            movie.duration = json.general.duration / 1000; // conversion ms => s
            movie.video = json.video[0];
            movie.audio = json.audio;
            movie.subtitles = json.subs || [];
            resolve(json);
          } catch (e) {
            console.error(e);
            log((e instanceof Error) ? `[error] ${e.message}` : '[error] Unknown Error');
            resolve(null);
          }
        }
      }
    );

  });
};

export class TmdbClient {
  movieDb: MovieDb;
  lang: string;
  imagePath: string;
  baseUrl: string = "https://image.tmdb.org/t/p/";
  log: (msg: string) => void = console.log;

  constructor(key: string, language: string, imagePath: string, log: (msg: string) => void) {
    this.movieDb = new MovieDb(key);
    this.lang = language;
    this.imagePath = imagePath;
    this.log = log;
    this.movieDb.configuration().then((config) => {
      // console.log('TMDB configuration', config);
      if (config.images.secure_base_url) {
        this.baseUrl = config.images.secure_base_url;
      }
    });
  }

  public async getMovieData(movie: DbMovie): Promise<DbCredit[]> {
    const credits: DbCredit[] = [];
    const movieInfo = await this.movieDb.movieInfo({
      id: movie.tmdbid,
      language: this.lang,
      append_to_response: 'casts,trailers,release_dates',
    });
    // this.log("movieInfo", movieInfo);
    if (movieInfo.release_date) {
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
    return credits;
  }

  public async autoIdentifyMovie(movie: DbMovie): Promise<DbCredit[]> {
    const data: ExtractedMovieInfos = extractMovieTitle(movie.filename);
    let id: number|null = data.tmdbid;
    if (! id) {
      const response = await this.movieDb.searchMovie({
        language: this.lang,
        query: data.title,
        year: data.year ? parseFloat(data.year) : undefined,
      });
      if (response.results?.length && response.results[0].id) {
        id = response.results[0].id;
      }      
    }
    if (id) {
      movie.tmdbid = id;
      movie.year = (data.year ? parseFloat(data.year) : 0);
      return await this.getMovieData(movie);
    }
    return [];
  }

  public async getTvshowData(tvshow: DbTvshow): Promise<void> {
    const tvshowInfo = await this.movieDb.tvInfo({
      id: tvshow.tmdbid,
      language: this.lang,
      append_to_response: 'content_ratings',
    });
    // console.log("tvshowInfo", tvshowInfo);
    tvshow.tmdbid = tvshowInfo.id || -1;
    tvshow.title = tvshowInfo.name || "";
    tvshow.originalTitle = tvshowInfo.original_name || "";
    tvshow.synopsys = tvshowInfo.overview || "";
    if (tvshowInfo.genres) {
      for (const genre of tvshowInfo.genres) {
        if (genre.name)
          tvshow.genres.push(genre.name);
      }
    }
    if (tvshowInfo.origin_country) {
      for (const country of tvshowInfo.origin_country) {
        tvshow.countries.push(country);
      }
    }
    const audiences = [];
    if ((tvshowInfo as any).content_ratings?.results) {
      for (const country of (tvshowInfo as any).content_ratings.results) {
        if (country.iso_3166_1 == "US") {
          switch (country.rating) {
            case "TV-NR": break;                     // "No rating information."
            case "TV-Y" :                            // "This program is designed to be appropriate for all children."
            case "TV-Y7": audiences.push( 0); break; // "This program is designed for children age 7 and above."
            case "TV-G" :                            // "Most parents would find this program suitable for all ages."
            case "TV-PG": audiences.push(10); break; // "This program contains material that parents may find unsuitable for younger children."
            case "TV-14": audiences.push(12); break; // "This program contains some material that many parents would find unsuitable for children under 14 years of age."
            case "TV-MA": audiences.push(16); break; // "This program is specifically designed to be viewed by adults and therefore may be unsuitable for children under 17."
          }
        } else if (country.iso_3166_1 == "ES") {
          switch (country.rating) {
            case "NR": break;                        // "No rating information."
            case "TP":
            case  "7": audiences.push( 0); break;    // "Suitable for all ages."
            case "10": audiences.push(10); break;    // "Not recommended for children under 10. Not allowed in children's television series."
            case "12":
            case "13": audiences.push(12); break;    // "Not recommended for children under 12. Not allowed air before 10:00 p.m. Some channels and programs are subject to exception."
            case "16": audiences.push(16); break;    // "Not recommended for children under 16. Not allowed air before 10:30 p.m. Some channels and programs are subject to exception."
            case "18": audiences.push(18); break;    // "Not recommended for persons under 18. Allowed between midnight and 5 a.m. and only in some channels, access to these programs is locked by a personal password."
          }
        } else if (country.iso_3166_1 == "FR") {
          switch (country.rating) {
            case "NR": break;                        // "No rating information."
            case "10": audiences.push(10); break;    // "Not recommended for children under 10. Not allowed in children's television series."
            case "12": audiences.push(12); break;    // "Not recommended for children under 12. Not allowed air before 10:00 p.m. Some channels and programs are subject to exception."
            case "16": audiences.push(16); break;    // "Not recommended for children under 16. Not allowed air before 10:30 p.m. Some channels and programs are subject to exception."
            case "18": audiences.push(18); break;    // "Not recommended for persons under 18. Allowed between midnight and 5 a.m. and only in some channels, access to these programs is locked by a personal password."
          }
        }
      }
    }
    tvshow.audience = (audiences.length) ? Math.min.apply(null, audiences) : 999;
    if (tvshowInfo.backdrop_path) {
      this.log(`[+] downloading tvshow backdrop w1280${tvshowInfo.backdrop_path}`);
      await downloadImage(
        `${this.baseUrl}w1280${tvshowInfo.backdrop_path}`,
        path.join(this.imagePath, 'backdrops_w1280', tvshowInfo.backdrop_path)
      );
      this.log(`[+] downloading tvshow backdrop w1780${tvshowInfo.backdrop_path}`);
      await downloadImage(
        `${this.baseUrl}w780${tvshowInfo.backdrop_path}`,
        path.join(this.imagePath, 'backdrops_w780', tvshowInfo.backdrop_path)
      );
      tvshow.backdropPath = tvshowInfo.backdrop_path;
    }
    if (tvshowInfo.poster_path) {
      this.log(`[+] downloading tvshow poster w780${tvshowInfo.poster_path}`);
      await downloadImage(
        `${this.baseUrl}w780${tvshowInfo.poster_path}`,
        path.join(this.imagePath, 'posters_w780', tvshowInfo.poster_path)
      );
      this.log(`[+] downloading tvshow poster w342${tvshowInfo.poster_path}`);
      await downloadImage(
        `${this.baseUrl}w342${tvshowInfo.poster_path}`,
        path.join(this.imagePath, 'posters_w342', tvshowInfo.poster_path)
      );
      tvshow.posterPath = tvshowInfo.poster_path;
    }
  }

  // public async updateTvshowData(tvshow: DbTvshow): Promise<void> {
  //   let filepath: string;
  //   if (tvshow.posterPath) {
  //     filepath = path.join(this.imagePath, 'posters_w342', tvshow.posterPath);
  //     await fs.promises.access(filepath).then(() => {}).catch(async () => {
  //       this.log(`[+] downloading tvshow poster w342${tvshow.posterPath}`);
  //       await downloadImage(
  //         `${this.baseUrl}w342${tvshow.posterPath}`,
  //         filepath
  //       );
  //     });
  //   }
  //   for(const season of tvshow.seasons) {
  //     if (season.posterPath) {
  //       filepath = path.join(this.imagePath, 'posters_w342', season.posterPath);
  //       await fs.promises.access(filepath).then(() => {}).catch(async () => {
  //           this.log(`[+] downloading season poster w342${season.posterPath}`);
  //           await downloadImage(
  //             `${this.baseUrl}w342${season.posterPath}`,
  //             filepath
  //           );
  //       });
  //     }
  //   }
  // }

  public async getCollectionData(tvshow: DbTvshow): Promise<void> {
    const tvshowInfo = await this.movieDb.collectionInfo({
      id: tvshow.tmdbid,
      language: this.lang,
    });
    // console.log("tvshowInfo", tvshowInfo);
    tvshow.tmdbid = tvshowInfo.id || -1;
    tvshow.title = tvshowInfo.name || "";
    tvshow.originalTitle = "";
    tvshow.synopsys = tvshowInfo.overview || "";
    tvshow.audience = 999;
    if (! tvshowInfo.backdrop_path && tvshowInfo.parts?.length && tvshowInfo.parts[0].backdrop_path)
      tvshowInfo.backdrop_path = tvshowInfo.parts[0].backdrop_path;
    if (tvshowInfo.backdrop_path) {
      this.log(`[+] downloading tvshow backdrop w1280${tvshowInfo.backdrop_path}`);
      await downloadImage(
        `${this.baseUrl}w1280${tvshowInfo.backdrop_path}`,
        path.join(this.imagePath, 'backdrops_w1280', tvshowInfo.backdrop_path)
      );
      this.log(`[+] downloading tvshow backdrop w1780${tvshowInfo.backdrop_path}`);
      await downloadImage(
        `${this.baseUrl}w780${tvshowInfo.backdrop_path}`,
        path.join(this.imagePath, 'backdrops_w780', tvshowInfo.backdrop_path)
      );
      tvshow.backdropPath = tvshowInfo.backdrop_path;
    }
    if (tvshowInfo.poster_path) {
      this.log(`[+] downloading tvshow poster w780${tvshowInfo.poster_path}`);
      await downloadImage(
        `${this.baseUrl}w780${tvshowInfo.poster_path}`,
        path.join(this.imagePath, 'posters_w780', tvshowInfo.poster_path)
      );
      tvshow.posterPath = tvshowInfo.poster_path;
    }
  }

  public async autoIdentifyTvshow(tvshow: DbTvshow): Promise<void> {
    const data: ExtractedMovieInfos = extractMovieTitle(tvshow.foldername);
    let id: number|null = data.tmdbid;
    if (! id) {
      if (tvshow.isSaga) {
        const response = await this.movieDb.searchCollection({
          language: this.lang,
          query: data.title,
        });
        if (response.results?.length && response.results[0].id) {
          id = response.results[0].id;
        } else {
          this.log("[error] show not found : " + data.title);
        }      

      } else {
        const response = await this.movieDb.searchTv({
          language: this.lang,
          query: data.title,
        });
        if (response.results?.length && response.results[0].id) {
          id = response.results[0].id;
        } else {
          this.log("[error] show not found : " + data.title);
        }      
      }
    }
    if (id) {
      tvshow.tmdbid = id;
      if (tvshow.isSaga) {
        await this.getCollectionData(tvshow);
      } else {
        await this.getTvshowData(tvshow);
      }
    }
  }

  public async addTvshowEpisode(tvshow: DbTvshow, episode: Episode): Promise<void> {
    const data: ParsedShow = filenameParse(episode.filename.split(path.sep).pop() || episode.filename, true) as ParsedShow;
    if (tvshow.tmdbid > 0 && data.seasons?.length == 1 && data.episodeNumbers?.length > 0) {
      try {
        const response = await this.movieDb.episodeInfo({
          language: this.lang,
          id: tvshow.tmdbid,
          episode_number: data.episodeNumbers[0],
          season_number: data.seasons[0],
        });
        if (response.id) {
          // console.log("episode found", response);
          episode.tmdbid = response.id;
          episode.seasonNumber = data.seasons[0];
          episode.episodeNumbers = data.episodeNumbers;
          episode.title = response.name || "";
          episode.airDate = response.air_date || "";
          episode.synopsys = response.overview || "";
          if (response.still_path) {
            this.log(`[+] downloading episode still w300/${response.still_path}`);
            await downloadImage(
              `${this.baseUrl}w300${response.still_path}`,
              path.join(this.imagePath, 'stills_w300', response.still_path)
            );
            episode.stillPath = response.still_path;
          }
        }
      } catch(e) {}
    }
  }

  public async addCollectionEpisode(tvshow: DbTvshow, episode: Episode): Promise<void> {
    const data: ExtractedMovieInfos = extractMovieTitle(episode.filename);
    try {
      const response = await this.movieDb.searchMovie({
        language: this.lang,
        query: data.title,
        year: data.year ? parseFloat(data.year) : undefined,
      });
      if (response.results?.length && response.results[0].id) {
        const movieInfo = await this.movieDb.movieInfo({
          id: response.results[0].id,
          language: this.lang,
          append_to_response: 'casts,trailers,release_dates',
        });
        // console.log("episode found", response);
        episode.tmdbid = movieInfo.id || -1;
        episode.seasonNumber = -1;
        episode.episodeNumbers = [];
        episode.title = movieInfo.title || "";
        episode.airDate = movieInfo.release_date || "";
        episode.synopsys = movieInfo.overview || "";
        if (movieInfo.poster_path) {
          this.log(`[+] downloading movie backdrop w185${movieInfo.poster_path}`);
          await downloadImage(
            `${this.baseUrl}w185${movieInfo.poster_path}`,
            path.join(this.imagePath, 'stills_w300', movieInfo.poster_path)
          );
          episode.stillPath = movieInfo.poster_path;
        }
      }
    } catch(e) {}
  }

  public async addTvshowSeason(tvshow: DbTvshow, seasonNumber: number): Promise<DbCredit[]> {
    const credits: DbCredit[] = [];
    try {
      const response = await this.movieDb.seasonInfo({
        language: this.lang,
        id: tvshow.tmdbid,
        season_number: seasonNumber,
      });
      if (response.id) {
        // console.log("season found", response);
        const newSeason: Season = {
          tmdbid: response.id,
          seasonNumber,
          episodeCount: response.episodes?.length || -1,
          year: response.air_date ? parseFloat(response.air_date) : 0,
          synopsys: response.overview || "",
          posterPath: "",
          cast: [],
        };
        if (response.poster_path) {
          this.log(`[+] downloading season poster w780${response.poster_path}`);
          await downloadImage(
            `${this.baseUrl}w780${response.poster_path}`,
            path.join(this.imagePath, 'posters_w780', response.poster_path)
          );
          this.log(`[+] downloading season poster w342${response.poster_path}`);
          await downloadImage(
            `${this.baseUrl}w342${response.poster_path}`,
            path.join(this.imagePath, 'posters_w342', response.poster_path)
          );
          newSeason.posterPath = response.poster_path;
        }
        const credit = await this.movieDb.seasonCredits({
          language: this.lang,
          id: tvshow.tmdbid,
          season_number: seasonNumber,
        });
        if (credit.cast) {
          for (const cast of credit.cast) {
            if (cast.name && cast.id) {
              newSeason.cast.push({ tmdbid: cast.id, character: cast.character || "" });
              credits.push({
                tmdbid: cast.id,
                name: cast.name,
                profilePath: cast.profile_path || "",
              });
              if (newSeason.cast.length >= 20)
                break;
            }
          }
        }
        tvshow.seasons.push(newSeason);
      }
    } catch(e) {}
    return credits;
  }

  public async downloadProfileImage(credit: DbCredit) {
    if (credit.profilePath) {
      this.log(`[+] downloading cast profile w185${credit.profilePath}`);
      await downloadImage(
        `${this.baseUrl}w185${credit.profilePath}`,
        path.join(this.imagePath, 'profiles_w185', credit.profilePath)
      );
    }
  }

}