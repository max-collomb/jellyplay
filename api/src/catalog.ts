import path from 'path';
import fs from 'fs';

import { FastifyRequest, FastifyReply } from 'fastify';
import Loki from 'lokijs';
const { LokiFsAdapter } = Loki;

import { DbUser, DbMovie, DbTvshow, DbCredit, DataTables, Episode, ExtractedMovieInfos, HomeLists, Season, UserEpisodeStatus, UserMovieStatus, UserTvshowStatus } from './types';
import { SeenStatus } from './enums';
import { TmdbClient, mediaInfo, extractMovieTitle } from './tmdb';

type CatalogOptions = {
  moviesPath: string;
  tvshowsPath: string;
  rootPath: string;
};

type SetPositionMessage = {
  foldername?: string;
  filename: string;
  userName: string;
  position: number;
};

type SetStatusMessage = {
  foldername?: string;
  filename: string;
  userName: string;
  status: SeenStatus;
};

type SetMovieAudienceMessage = {
  filename: string;
  audience: number;  
};

type SetTvshowAudienceMessage = {
  foldername: string;
  audience: number;  
};

type FilenameMessage = {
  filename: string;
};

type FixMovieMetadataMessage = {
  filename: string;
  tmdbId: number;
};

type FixTvshowMetadataMessage = {
  foldername: string;
  tmdbId: number;
};

type RenameFileMessage = {
  oldFilename: string;
  newFilename: string;
};

const videoExts = ['.avi', '.mkv', '.mp4', '.mpg', '.mpeg', '.wmv'];

const pathExists = async (path: string) => !!(await fs.promises.stat(path).catch(e => false));

export class Catalog {
  moviesPath: string;
  tvshowsPath: string;
  rootPath: string;
  dbReady: Promise<void>;
  db: Loki;
  tmdbClient: TmdbClient;
  tables: DataTables = {};
  scanning: boolean = false;
  scanLogs: string = "";
  lastUpdate: number = Date.now();

  constructor(options: CatalogOptions) {
    this.moviesPath = options.moviesPath;
    this.tvshowsPath = options.tvshowsPath;
    this.rootPath = options.rootPath;
    const dbFilename = this.moviesPath.slice(-32) // 32 derniers caractères du chemin
                           .replace(/[\W]+/g,"_") // remplace tous les caractères autre que [a-zA-Z0-9] en _
                           .replace(/_+/g, "_");  // remplace plusieurs _ consécutifs par un seul
    let dbLoaded: () => void;
    this.dbReady = new Promise((resolve, _reject) => {
      dbLoaded = resolve;
    });
    this.db = new Loki(
      // __dirname alternative : https://bobbyhadz.com/blog/javascript-dirname-is-not-defined-in-es-module-scope
      path.join(this.rootPath, 'db', dbFilename),
      {
        adapter: new LokiFsAdapter(),
        autoload: true,
        autoloadCallback : () => {
          this.initSchemas();
          dbLoaded();
        },
        autosave: true, 
        autosaveInterval: 60_000
      }
    );
    this.tmdbClient = new TmdbClient(global.config.tmdbApiKey, 'fr-FR', path.join(this.rootPath, 'db', 'images'), this.log.bind(this));
  }

  private initSchemas(): void {
    this.db.removeCollection('users');
    // this.db.removeCollection('movies');
    // this.db.removeCollection('tvshows');
    // this.db.removeCollection('credits');

    this.tables.users = this.db.getCollection('users');
    if (! this.tables.users) {
      this.tables.users = this.db.addCollection(
        'users',
        {
          unique: ['name'],
          autoupdate: true,
          indices: ['name'],
        }
       );
      this.tables.users.insert({ name: 'max',    audience: 999, admin: true,  created: 1650837600000 /* UTC 2022-04-25 00:00:00.000 */ }); 
      this.tables.users.insert({ name: 'flo',    audience: 999, admin: false, created: 1659304800000 /* UTC 2022-08-01 00:00:00.000 */ }); 
      this.tables.users.insert({ name: 'amélie', audience: 16,  admin: false, created: 1659304800000 /* UTC 2022-08-01 00:00:00.000 */ }); 
      this.tables.users.insert({ name: 'thomas', audience: 12,  admin: false, created: 1659304800000 /* UTC 2022-08-01 00:00:00.000 */ }); 
    }

    this.tables.movies = this.db.getCollection('movies');
    if (! this.tables.movies) {
      this.tables.movies = this.db.addCollection(
        'movies',
        {
          unique: ['filename'],
          autoupdate: true,
          indices: ['filename', 'tmdbid'],
        }
      );
    }

    this.tables.tvshows = this.db.getCollection('tvshows');
    if (! this.tables.tvshows) {
      this.tables.tvshows = this.db.addCollection(
        'tvshows',
        {
          unique: ['foldername'],
          autoupdate: true,
          indices: ['foldername', 'tmdbid'],
        }
      );
    }

    this.tables.credits = this.db.getCollection('credits');
    if (! this.tables.credits) {
      this.tables.credits = this.db.addCollection(
        'credits',
        {
          unique: ['tmdbid'],
          autoupdate: true,
          indices: ['tmdbid'],
        }
      );
    }
  }

  private log(message: string): void {
    console.log(message);
    this.scanLogs += message + "\n";
  }

  public async load(): Promise<void> {
    this.scanning = true;
    this.scanLogs = "";
    console.log("begin catalog_load");
    await this.dbReady;
    const creditSet: Set<number> = new Set<number>();
    //await new Promise(resolve => setTimeout(resolve, 1_000));
    await this.scanMovies(creditSet);
    //await new Promise(resolve => setTimeout(resolve, 1_000));
    await this.scanTvshows(creditSet);
    if (this.tables.credits) {
      for (const credit of this.tables.credits.find()) {
        if (! creditSet.has(credit.tmdbid)) {
          this.log(`[-] credit unreferenced ${credit.name}`);
          await this.tmdbClient.unlinkProfileImage(credit);
          this.tables.credits.remove(credit);
        }
      }
    }
    console.log("end catalog_load");
    this.scanning = false;
  }

  private async recursiveReaddir(rootPath: string): Promise<string[]> {
    const pathes: string[] = [];
    const readdir = async function (folderPath: string, list: string[]): Promise<void> {
      const filenames = await fs.promises.readdir(path.join(rootPath, folderPath));
      for (const filename of filenames) {
        const stat = await fs.promises.lstat(path.join(rootPath, folderPath, filename));
        if (stat.isDirectory()) {
          if (! filename.startsWith(".")) {
            await readdir(path.join(folderPath, filename), list);
          }
        } else if (videoExts.indexOf(path.extname(filename).toLowerCase()) > -1) {
          list.push(path.join(folderPath, filename));
        }
      }
    }
    await readdir("", pathes);
    return pathes;
  }

  private async readDirectories(rootPath: string): Promise<string[]> {
    const pathes: string[] = [];
    const filenames = await fs.promises.readdir(rootPath);
    for (const filename of filenames) {
      const stat = await fs.promises.lstat(path.join(rootPath, filename));
      if (stat.isDirectory() && ! filename.startsWith(".")) {
        pathes.push(filename)
      }
    }
    return pathes;
  }

  private async scanMovies(creditSet: Set<number>) {
    this.log("begin scan_movies");
    // scanne le dossier pour détecter changements
    const filenames: string[] = await this.recursiveReaddir(this.moviesPath);
    const filenameSet: Set<string> = new Set<string>();
    for (const filename of filenames) {
      filenameSet.add(filename);
      const filepath: string = path.join(this.moviesPath, filename);
      if (this.tables.movies?.find({ filename }).length === 0) {
        this.log(`[+] file added ${filename}`);
        try {
          const newMovie: DbMovie = {
            filename,
            tmdbid: -1,
            title: "",
            originalTitle: "",
            year: -1,
            duration: -1,
            directors: [],
            writers: [],
            cast: [],
            genres: [],
            countries: [],
            audience: 999,
            synopsys: "",
            backdropPath: "",
            posterPath: "",
            created: 0,
            filesize: -1,
            video: { width: -1, height: -1, codec: "" },
            audio: [],
            subtitles: [],
            userStatus: [],
            searchableContent: "",
          };
          const credits: DbCredit[] = await this.tmdbClient.autoIdentifyMovie(newMovie);
          await mediaInfo(newMovie, path.join(this.moviesPath, newMovie.filename), this.log.bind(this));
          this.tables.movies.insert(newMovie);
          for (const credit of credits) {
            if (this.tables.credits?.find({ tmdbid: credit.tmdbid }).length === 0) {
              await this.tmdbClient.downloadProfileImage(credit);
              this.tables.credits.insert(credit);
            }
          }
        } catch (e) {
          console.error(e);
          this.log((e instanceof Error) ? `[error] ${e.message}` : '[error] Unknown Error');
        }
      }
    }
    if (this.tables.movies) {
      for (const movie of this.tables.movies.find()) {
        if (filenameSet.has(movie.filename)) {
          movie.cast.forEach(c => creditSet.add(c.tmdbid));
          movie.writers.forEach(id => creditSet.add(id));
          movie.directors.forEach(id => creditSet.add(id));
        } else {
          this.log(`[-] file deleted ${movie.filename}`);
          await this.tmdbClient.unlinkMovieImages(movie);
          this.tables.movies.remove(movie);
        }
      }
    }
    this.log("end scan_movies");
  }

  private async scanTvshows(creditSet: Set<number>) {
    this.log("begin scan_tvshows");
    // scanne le dossier pour détecter changements
    const foldernames: string[] = await this.readDirectories(this.tvshowsPath);
    const foldernameSet: Set<string> = new Set<string>();
    for (const foldername of foldernames) {
      foldernameSet.add(foldername);
      const folderpath: string = path.join(this.tvshowsPath, foldername);
      let result = this.tables.tvshows?.findOne({ foldername });
      let tvshow: DbTvshow|undefined = undefined;
      if (result) {
        tvshow = result;
      } else {
        try {
          this.log(`[+] folder added ${foldername}`);
          tvshow = {
            foldername,
            isSaga: foldername.toLowerCase().indexOf('[saga]') > -1,
            tmdbid: -1,
            title: "",
            originalTitle: "",
            synopsys: "",
            genres: [],
            countries: [],
            audience: 999,
            backdropPath: "",
            posterPath: "",
            userStatus: [],
            searchableContent: "",
            seasons: [],
            episodes: [],
            createdMin: 0,
            createdMax: 0,
            airDateMin: "",
            airDateMax: "",
          };
          await this.tmdbClient.autoIdentifyTvshow(tvshow);
          this.tables.tvshows?.insert(tvshow);
        } catch (e) {
          console.error(e);
          this.log((e instanceof Error) ? `[error] ${e.message}` : '[error] Unknown Error');
        }
      }

      if (tvshow) {
        try {
          const filenames: string[] = await this.recursiveReaddir(folderpath);
          const filenameSet: Set<string> = new Set<string>();
          for (const filename of filenames) {
            filenameSet.add(filename);
            const filepath: string = path.join(folderpath, filename);
            if (tvshow.episodes.filter(e => e.filename == filename).length === 0) {
              this.log(`[+] file added ${filename}`);
              const episode: Episode = {
                filename,
                seasonNumber: -1,
                episodeNumbers: [],
                tmdbid: -1,
                title: "",
                airDate: "",
                duration: -1,
                synopsys: "",
                stillPath: "",
                created: 0,
                filesize: -1,
                video: { width: -1, height: -1, codec: "" },
                audio: [],
                subtitles: [],
                userStatus: [],
              };
              // episode
              if (tvshow.isSaga) {
                await this.tmdbClient.addCollectionEpisode(tvshow, episode);
              } else {
                await this.tmdbClient.addTvshowEpisode(tvshow, episode);
              }
              await mediaInfo(episode, path.join(folderpath, episode.filename), this.log.bind(this));
              // season
              if (episode.seasonNumber > 0 && tvshow.seasons.filter(s => s.seasonNumber == episode.seasonNumber).length === 0) {
                const credits: DbCredit[] = await this.tmdbClient.addTvshowSeason(tvshow, episode.seasonNumber);
                for (const credit of credits) {
                  if (this.tables.credits?.find({ tmdbid: credit.tmdbid }).length === 0) {
                    await this.tmdbClient.downloadProfileImage(credit);
                    this.tables.credits.insert(credit);
                  }
                }
              }
              tvshow.episodes.push(episode);
            }
          }

          // nettoyage des épisodes
          const seasonNumberSet: Set<number> = new Set<number>();
          for (const episode of tvshow.episodes) {
            if (filenameSet.has(episode.filename)) {
              seasonNumberSet.add(episode.seasonNumber);
            } else {
              this.log(`[-] file deleted ${episode.filename}`);
              await this.tmdbClient.unlinkEpisodeImages(episode);
              episode.filename = "";
            }
          }
          tvshow.episodes = tvshow.episodes.filter(e => e.filename !== "");

          // nettoyage des saisons
          for (const season of tvshow.seasons) {
            if (seasonNumberSet.has(season.seasonNumber)) {
              season.cast.forEach(c => creditSet.add(c.tmdbid));
            } else {
              this.log(`[-] season unreferenced ${season.seasonNumber}`);
              await this.tmdbClient.unlinkSeasonImages(season);
            }
          }
          tvshow.seasons = tvshow.seasons.filter(s => seasonNumberSet.has(s.seasonNumber));
          tvshow.createdMin = tvshow.episodes.map(e => e.created).sort().shift() || 0;
          tvshow.createdMax = tvshow.episodes.map(e => e.created).sort().pop() || 0;
          tvshow.airDateMin = tvshow.episodes.map(e => e.airDate).sort().shift() || "";
          tvshow.airDateMax = tvshow.episodes.map(e => e.airDate).sort().pop() || "";

          this.tables.tvshows?.update(tvshow);
        } catch (e) {
          console.error(e);
          this.log((e instanceof Error) ? `[error] ${e.message}` : '[error] Unknown Error');
        }
      }

    }
    if (this.tables.tvshows) {
      for (const tvshow of this.tables.tvshows.find()) {
        if (foldernameSet.has(tvshow.foldername)) {
          tvshow.seasons.forEach(s => s.cast.forEach(c => creditSet.add(c.tmdbid)));
        } else {
          this.log(`[-] folder deleted ${tvshow.foldername}`);
          await this.tmdbClient.unlinkTvshowImages(tvshow);
          tvshow.episodes.forEach(async episode => await this.tmdbClient.unlinkEpisodeImages(episode));
          tvshow.seasons.forEach(async season => await this.tmdbClient.unlinkSeasonImages(season));
          this.tables.tvshows.remove(tvshow);
        }
      }
    }
    // nettoyer tvshow.episodes et tvshow.seasons et les images
    this.log("end scan_tvshows");
  }

  public getConfig(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ config: global.config });
  }

  public getLastUpdate(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ lastUpdate: this.lastUpdate });
  }

  public getUsers(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.users?.find() });
  }

  public getMovies(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.movies?.find(), lastUpdate: this.lastUpdate });
  }

  public getMovie(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ movie: this.tables.movies?.find({ tmdbid: (request.params as any).movieId }) });
  }

  public getTvshows(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.tvshows?.find(), lastUpdate: this.lastUpdate });
  }

  public getCredits(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.credits?.find(), lastUpdate: this.lastUpdate });
  }

  public getHome(request: FastifyRequest, reply: FastifyReply) {
    const RECENT_LENGTH_MAX = 20;
    const user = this.tables.users?.findOne({ name: (request.params as any).userName });
    const lists: HomeLists = {
      inProgress: [],
      recentMovies: [],
      recentTvshows: [],
    };
    if (user) {
      if (this.tables.movies) {
        movieLoop:
        for (const movie of this.tables.movies.find().sort((a: DbMovie, b: DbMovie) => (b.created < a.created) ? -1 : (b.created > a.created) ? 1 : 0)) {
          let userStatus : UserMovieStatus|undefined = undefined;
          for (const us of movie.userStatus) {
            if (us.userName == user.name) {
              userStatus = us;
            }
          }
          if (userStatus && userStatus.position > 0) {
            lists.inProgress.push(movie);
            continue movieLoop;
          } else if (lists.recentMovies.length < RECENT_LENGTH_MAX && movie.created > user.created) {
            if (userStatus === undefined ||
                userStatus.currentStatus == SeenStatus.toSee ||
                (userStatus.currentStatus == SeenStatus.unknown && ! userStatus.seenTs.length)) {
              lists.recentMovies.push(movie);
              continue movieLoop;
            }
          }
        }
      }
      if (this.tables.tvshows) {
        tvshowLoop:
        for (const tvshow of this.tables.tvshows.find().sort((a: DbTvshow, b: DbTvshow) => (b.createdMax < a.createdMax) ? -1 : (b.createdMax > a.createdMax) ? 1 : 0)) {
          for (let us of tvshow.userStatus) {
            if (us.userName == user.name && us.currentStatus == SeenStatus.wontSee) {
              continue tvshowLoop;
            }
          }
          let inProgressCount = 0;
          let seenCount = 0;
          let notSeenCount = 0;
          for(const episode of tvshow.episodes) {
            let userStatus : UserEpisodeStatus|undefined = undefined;
            for (let us of episode.userStatus) {
              if (us.userName == user.name) {
                userStatus = us;
              }
            }
            if (userStatus && userStatus.position > 0) {
              inProgressCount++;
            } else if (userStatus && (userStatus.seenTs.length || userStatus.currentStatus == SeenStatus.seen)) {
              seenCount++;
            } else if (! userStatus || ((userStatus.seenTs.length == 0) && (userStatus.currentStatus != SeenStatus.wontSee))) {
              notSeenCount++;
            } 
          }
          if (inProgressCount > 0 || (seenCount > 0 && notSeenCount > 0)) {
            lists.inProgress.push(tvshow);
          } else {
            if (lists.recentTvshows.length < RECENT_LENGTH_MAX && tvshow.createdMax > user.created && notSeenCount > 0) {
              lists.recentTvshows.push(tvshow);
              continue tvshowLoop;
            }
          }
        }
      }
    }
    reply.send({ lists, lastUpdate: this.lastUpdate });
  }

  public setMoviePosition(request: FastifyRequest, reply: FastifyReply) {
    let body: SetPositionMessage = request.body as SetPositionMessage;
    console.log("set_position ", body.filename, body.userName, body.position);
    let movie = this.tables.movies?.findOne({ filename: body.filename });
    if (movie) {
      let userStatus: UserMovieStatus | undefined = undefined;
      for (let us of movie.userStatus) {
        if (us.userName == body.userName) {
          userStatus = us;
          break;
        }
      }
      if (! userStatus) {
        userStatus = { userName: body.userName, position: 0, seenTs: [], currentStatus: SeenStatus.unknown };
        movie.userStatus.push(userStatus);
      }
      userStatus.position = body.position;
      if (body.position > movie.duration * 0.9) {
        console.log("> 90 %");
        userStatus.position = 0;
        userStatus.currentStatus = SeenStatus.seen;
        let timestamp: number = Date.now();
        if (! userStatus.seenTs.length || timestamp - userStatus.seenTs[userStatus.seenTs.length - 1] > 24 * 60 * 60 * 1_000) {
          console.log("adding TS to seen array");
          this.lastUpdate = timestamp;
          userStatus.seenTs.push(timestamp);
        }
      }
      this.tables.movies?.update(movie);
      reply.send({ userStatus: movie.userStatus });
    }
    reply.send({});
  }

  public setEpisodePosition(request: FastifyRequest, reply: FastifyReply) {
    let body: SetPositionMessage = request.body as SetPositionMessage;
    console.log("set_position ", body.foldername, body.filename, body.userName, body.position);
    let tvshow = this.tables.tvshows?.findOne({ foldername: body.foldername });
    if (tvshow) {
      let episode = tvshow.episodes.filter(e => e.filename == body.filename).pop();
      if (episode) {
        let userStatus: UserEpisodeStatus | undefined = undefined;
        for (let us of episode.userStatus) {
          if (us.userName == body.userName) {
            userStatus = us;
            break;
          }
        }
        if (! userStatus) {
          userStatus = { userName: body.userName, position: 0, seenTs: [], currentStatus: SeenStatus.unknown };
          episode.userStatus.push(userStatus);
        }
        userStatus.position = body.position;
        if (body.position > episode.duration * 0.9) {
          console.log("> 90 %");
          userStatus.position = 0;
          userStatus.currentStatus = SeenStatus.seen;
          let timestamp: number = Date.now();
          if (! userStatus.seenTs.length || timestamp - userStatus.seenTs[userStatus.seenTs.length - 1] > 24 * 60 * 60 * 1_000) {
            console.log("adding TS to seen array");
            this.lastUpdate = timestamp;
            userStatus.seenTs.push(timestamp);
          }
        }
        this.tables.tvshows?.update(tvshow);
        reply.send({ userStatus: episode.userStatus });
      }
    }
    reply.send({});
  }

  public scanNow(request: FastifyRequest, reply: FastifyReply) {
    if (! this.scanning) {
      this.load();
    }
    reply.send({ logs: this.scanLogs, finished: ! this.scanning });
  }

  public getScanProgress(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ logs: this.scanLogs.substring(parseFloat((request.params as any).offset)), finished: ! this.scanning });
  }

  public setMovieStatus(request: FastifyRequest, reply: FastifyReply) {
    let body: SetStatusMessage = request.body as SetStatusMessage;
    let movie = this.tables.movies?.findOne({ filename: body.filename });
    if (movie) {
      let userStatus: UserMovieStatus | undefined = undefined;
      for (let us of movie.userStatus) {
        if (us.userName == body.userName) {
          userStatus = us;
          break;
        }
      }
      if (! userStatus) {
        userStatus = { userName: body.userName, position: 0, seenTs: [], currentStatus: SeenStatus.unknown };
        movie.userStatus.push(userStatus);
      }
      userStatus.currentStatus = body.status;
      this.tables.movies?.update(movie);
      this.lastUpdate = Date.now();
      reply.send({ userStatus: movie.userStatus });
    }
    reply.send({});
  }

  public setTvshowStatus(request: FastifyRequest, reply: FastifyReply) {
    let body: SetStatusMessage = request.body as SetStatusMessage;
    let tvshow = this.tables.tvshows?.findOne({ foldername: body.foldername });
    if (tvshow) {
      let userStatus: UserTvshowStatus | undefined = undefined;
      for (let us of tvshow.userStatus) {
        if (us.userName == body.userName) {
          userStatus = us;
          break;
        }
      }
      if (! userStatus) {
        userStatus = { userName: body.userName, currentStatus: SeenStatus.unknown };
        tvshow.userStatus.push(userStatus);
      }
      userStatus.currentStatus = body.status as SeenStatus;
      this.tables.tvshows?.update(tvshow);
      this.lastUpdate = Date.now();
      reply.send({ userStatus: tvshow.userStatus });
    }
    reply.send({});
  }

  public setEpisodeStatus(request: FastifyRequest, reply: FastifyReply) {
    let body: SetStatusMessage = request.body as SetStatusMessage;
    let tvshow = this.tables.tvshows?.findOne({ foldername: body.foldername });
    if (tvshow) {
      let episode = tvshow.episodes.filter(e => e.filename == body.filename).pop();
      if (episode) {
        let userStatus: UserEpisodeStatus | undefined = undefined;
        for (let us of episode.userStatus) {
          if (us.userName == body.userName) {
            userStatus = us;
            break;
          }
        }
        if (! userStatus) {
          userStatus = { userName: body.userName, position: 0, seenTs: [], currentStatus: SeenStatus.unknown };
          episode.userStatus.push(userStatus);
        }
        userStatus.currentStatus = body.status as SeenStatus;
        this.tables.tvshows?.update(tvshow);
        this.lastUpdate = Date.now();
        reply.send({ userStatus: episode.userStatus });
      }
    }
    reply.send({});
  }

  public setMovieAudience(request: FastifyRequest, reply: FastifyReply) {
    let body: SetMovieAudienceMessage = request.body as SetMovieAudienceMessage;
    let movie = this.tables.movies?.findOne({ filename: body.filename });
    if (movie) {
      movie.audience = body.audience;
      this.tables.movies?.update(movie);
      this.lastUpdate = Date.now();
      reply.send({ audience: movie.audience });
    }
    reply.send({});
  }

  public setTvshowAudience(request: FastifyRequest, reply: FastifyReply) {
    let body: SetTvshowAudienceMessage = request.body as SetTvshowAudienceMessage;
    let tvshow = this.tables.tvshows?.findOne({ foldername: body.foldername });
    if (tvshow) {
      tvshow.audience = body.audience;
      this.tables.tvshows?.update(tvshow);
      this.lastUpdate = Date.now();
      reply.send({ audience: tvshow.audience });
    }
    reply.send({});
  }

  public parseFilename(request: FastifyRequest, reply: FastifyReply) {
    let body: FilenameMessage = request.body as FilenameMessage;
    reply.send({ parsedFilename: extractMovieTitle(body.filename)});
  }

  public async fixMovieMetadata(request: FastifyRequest, reply: FastifyReply) {
    let body: FixMovieMetadataMessage = request.body as FixMovieMetadataMessage;
    let movie = this.tables.movies?.findOne({ filename: body.filename });
    if (movie) {
      movie.tmdbid = body.tmdbId;
      movie.directors = [];
      movie.writers = [];
      movie.cast = [];
      movie.genres = [];
      movie.countries = [];

      await this.tmdbClient.getMovieData(movie);
      this.lastUpdate = Date.now();
    }
    reply.send({ movie });
  }

  public async fixTvshowMetadata(request: FastifyRequest, reply: FastifyReply) {
    let body: FixTvshowMetadataMessage = request.body as FixTvshowMetadataMessage;
    let tvshow = this.tables.tvshows?.findOne({ foldername: body.foldername });
    if (tvshow) {
      tvshow.tmdbid = body.tmdbId;
      tvshow.episodes = [];
      tvshow.seasons = [];
      tvshow.genres = [];
      tvshow.countries = [];

      await this.tmdbClient.getTvshowData(tvshow);
      await this.scanTvshows(new Set<number>());
      this.lastUpdate = Date.now();
      // pas de ménage des données de l'ancienne série => sera fait lors du prochain scan complet
    }
    reply.send({ tvshow });
  }

  public async renameFile(request: FastifyRequest, reply: FastifyReply) {
    let newFilename = "";
    let body: RenameFileMessage = request.body as RenameFileMessage;
    let movie = this.tables.movies?.findOne({ filename: body.oldFilename });
    if (movie) {
      try {
        if (! await pathExists(path.join(this.moviesPath, body.newFilename))) { // vérifie que le newFilename n'existe pas encore
          await fs.promises.rename(path.join(this.moviesPath, body.oldFilename), path.join(this.moviesPath, body.newFilename));
          movie.filename = body.newFilename;
          this.tables.movies?.update(movie);
          this.lastUpdate = Date.now();
        }
      } catch (error) {
        console.log(error);
      }
      newFilename = movie.filename;
    }
    reply.send({ newFilename });
  }

  public async deleteFile(request: FastifyRequest, reply: FastifyReply) {
    let newFilename = "";
    let body: FilenameMessage = request.body as FilenameMessage;
    let movie = this.tables.movies?.findOne({ filename: body.filename });
    if (movie) {
      try {
        await fs.promises.rename(
          path.join(this.moviesPath, movie.filename),
          path.join(this.moviesPath, ".trash", movie.filename.split(path.sep).pop() || movie.filename)
        );
        this.tables.movies?.remove(movie);
        this.lastUpdate = Date.now();
      } catch (error) {
        console.log(error);
      }
    }
    reply.send({});
  }

}

