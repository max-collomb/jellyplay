import path from 'path';
import { createWriteStream, statSync, existsSync, promises as fsPromises } from 'fs';
import * as https from 'https';


import { filenameParse, ParsedShow } from '@ctrl/video-filename-parser';
import { MovieDb } from 'moviedb-promise';
import MediaInfoFactory from 'mediainfo.js';
import type { MediaInfo, ReadChunkFunc, Result as MediaInfoResult } from 'mediainfo.js'

import { DbMovie, DbTvshow, DbCredit, Episode, FileInfo, ExtractedMovieInfos, Season } from './types';
import { getMovieAudiences, getTvshowAudiences } from './audience';

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

export const mediaInfo = async (media: DbMovie | Episode | FileInfo, filename: string, log: (msg: string) => void): Promise<MediaInfoResult> => {
  let fileHandle: fsPromises.FileHandle | undefined;
  let fileSize: number;
  let mediainfo: MediaInfo | undefined;
  let mediaInfoResult: MediaInfoResult;

  const readChunk: ReadChunkFunc = async (size, offset) => {
    const buffer = new Uint8Array(size);
    await (fileHandle as fsPromises.FileHandle).read(buffer, 0, size, offset);
    return buffer;
  }

  try {
    fileHandle = await fsPromises.open(filename, 'r');
    fileSize = (await fileHandle.stat()).size;
    mediainfo = await MediaInfoFactory({ format: "JSON", coverData: false, full: false });
    if (mediainfo === undefined) {
      log('Failed to initialize MediaInfo');
    }
    mediaInfoResult = JSON.parse(await mediainfo.analyzeData(() => fileSize, readChunk) as string);
    media.created = statSync(filename).birthtime.getTime();
    media.audio = [];
    media.subtitles = [];
    if ((mediaInfoResult as any).media?.track?.length) {
      for (let track of (mediaInfoResult as any).media.track) {
        switch (track['@type']) {
          case 'General':
            media.filesize = track.FileSize;
            media.duration = parseFloat(track.Duration);
            break;
          case 'Video':
            media.video = {
              width: track.Width,
              height: track.Height,
              codec: track.Format || track.CodecId || track.Encoded_Library_Name || "",
            };
            break;
          case 'Audio':
            media.audio.push({
              ch: track.Channels || track.Channel || "",
              codec: track.Title || track.Format || "",
              lang: track.Language || "",
            });
            break;
          case 'Text':
            if (track.Language) {
              media.subtitles.push(track.Language);
            }
            break;
        }
      }
    }
  } finally {
    fileHandle && (await fileHandle.close());
    mediainfo && mediainfo.close();
  }

  return mediaInfoResult;
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
    const audiences = getMovieAudiences((movieInfo as any).release_dates?.results);
    if (movie.audience === 999 && audiences.length) movie.audience = Math.max.apply(null, audiences);
    if (movieInfo.vote_count! > 0 && movieInfo.vote_average !== undefined) {
      movie.rating = movieInfo.vote_average;
      movie.ratingTs = (new Date()).getTime();
    }
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
    const audiences = getTvshowAudiences((tvshowInfo as any).content_ratings?.results);
    if (tvshow.audience === 999 && audiences.length) tvshow.audience = (audiences.length) ? Math.min.apply(null, audiences) : 999;
    if (tvshowInfo.vote_count! > 0 && tvshowInfo.vote_average !== undefined) {
      tvshow.rating = tvshowInfo.vote_average;
      tvshow.ratingTs = (new Date()).getTime();
    }
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
    tvshow.audience = 12;
    tvshow.rating = 0;
    tvshow.ratingTs = 0;
    
    if (! tvshowInfo.backdrop_path && tvshowInfo.parts?.length && tvshowInfo.parts[0].backdrop_path)
      tvshowInfo.backdrop_path = tvshowInfo.parts[0].backdrop_path;
    if (tvshowInfo.backdrop_path) {
      this.log(`[+] downloading tvshow backdrop w1280${tvshowInfo.backdrop_path}`);
      await downloadImage(
        `${this.baseUrl}w1280${tvshowInfo.backdrop_path}`,
        path.join(this.imagePath, 'backdrops_w1280', tvshowInfo.backdrop_path)
      );
      this.log(`[+] downloading tvshow backdrop w780${tvshowInfo.backdrop_path}`);
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
            this.log(`[+] downloading episode still w300${response.still_path}`);
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