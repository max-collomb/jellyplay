import path from 'path';
import fs from 'fs';

import checkDiskSpace from 'check-disk-space';
import { FastifyRequest, FastifyReply } from 'fastify';
import { filenameParse } from '@ctrl/video-filename-parser';
import Loki from 'lokijs';
const { LokiFsAdapter } = Loki;

import { AutoId, DbUser, DbMovie, DbTvshow, DbCredit, DataTables, Episode, HomeLists, UserEpisodeStatus, UserMovieStatus, UserTvshowStatus, UserWish, ParsedFilenameResponse, ParsedShow, FileInfo } from './types';
import { SeenStatus, MediaType } from './enums';
import { TmdbClient, mediaInfo, extractMovieTitle } from './tmdb';
import { Seedbox } from './seedbox';

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

type WishMessage = {
  userName: string;
  tmdbid: number;
  type: MediaType;
  title: string;
  posterPath: string;
  year: number;
};

type DownloadMessage = {
  path: string;
};

type AutoIdMessage = {
  path: string;
  autoId: AutoId;
};

type ImportMovieDownloadMessage = {
  path: string;
  tmdbId: number;
  year: number;
  filename: string;
  audience?: number;
};

type ImportTvshowDownloadMessage = {
  path: string;
  tmdbId: number;
  foldername: string;
  audience?: number;
};

const videoExts = ['.avi', '.mkv', '.mp4', '.mpg', '.mpeg', '.wmv'];

const pathExists = async (path: string) => !!(await fs.promises.stat(path).catch(e => false));

// frontend/src/common.tsx
function getEpisodeUserStatus(episode: Episode, user: DbUser): UserEpisodeStatus|null {
  for (let userStatus of episode.userStatus) {
    if (userStatus.userName == user.name) {
      return userStatus;
    }
  }
  return null;
}

// frontend/src/common.tsx
function selectCurrentEpisode(tvshow: DbTvshow, user: DbUser): Episode|undefined {
  return tvshow.episodes
          .slice(0)
          .filter(e => {
            const us: UserEpisodeStatus|null = getEpisodeUserStatus(e, user);
            return !us || (us && (us.seenTs.length == 0) && (us.currentStatus != SeenStatus.seen));
          })
          .sort((a, b) => {
            if (a.seasonNumber == b.seasonNumber)
              return (a.episodeNumbers[0] || 0) - (b.episodeNumbers[0] || 0);
            else
              return (a.seasonNumber == -1 ? 999 : a.seasonNumber) - (b.seasonNumber == -1 ? 999 : b.seasonNumber);
          })
          .shift();
}


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
  seedbox?: Seedbox;

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
    // this.db.removeCollection('wishes');
    // this.db.removeCollection('downloaded');

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
      this.tables.users.insert({ name: 'max',    audience: 999, admin: true,  simplifiedUI: false, created: 1650837600000 /* UTC 2022-04-25 00:00:00.000 */ }); 
      this.tables.users.insert({ name: 'flo',    audience: 999, admin: true,  simplifiedUI: false, created: 1659304800000 /* UTC 2022-08-01 00:00:00.000 */ }); 
      this.tables.users.insert({ name: 'amélie', audience: 999, admin: false, simplifiedUI: false, created: 1659304800000 /* UTC 2022-08-01 00:00:00.000 */ }); 
      this.tables.users.insert({ name: 'thomas', audience: 999, admin: false, simplifiedUI: false, created: 1659304800000 /* UTC 2022-08-01 00:00:00.000 */ }); 
      this.tables.users.insert({ name: 'mjl',    audience: 999, admin: false, simplifiedUI: true,  created: 2145916800000 /* UTC 2038-01-01 00:00:00.000 */ });
    }

    this.tables.wishes = this.db.getCollection('wishes');
    if (! this.tables.wishes) {
      this.tables.wishes = this.db.addCollection(
        'wishes',
        {
          unique: ['tmdbid'],
          autoupdate: true,
          indices: ['title', 'tmdbid'],
        }
      );
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

    this.tables.downloads = this.db.getCollection('downloads');
    if (! this.tables.downloads) {
      this.tables.downloads = this.db.addCollection(
        'downloads',
        {
          unique: ['path'],
          autoupdate: true,
          indices: ['path'],
        }
      );
    } else {
      for (const download of this.tables.downloads.find()) {
        // if (download.autoId) {
        //   delete download.autoId;
        //   this.tables.downloads.update(download);
        // }
        if (download.started && (new Date(download.started) < new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))) { // si plus vieux que 60 jours
          this.log(`[-] removing download ${download.path} (older than 60 days)`);
          this.tables.downloads.remove(download);
        } else if (!download.ignored && ! download.imported) {
          if (!fs.existsSync(path.join(global.config.tmpPath, path.basename(download.path)))) {
            this.log(`[-] ignoring download ${path.join(global.config.tmpPath, path.basename(download.path))} (file doesn't exist anymore)`);
            download.ignored = true;
            this.tables.downloads.update(download);
          }
        }
      }
    }
  }

  public async updateAll(): Promise<void> {
    for (let movie of (this.tables.movies?.find() || [])) {
      this.log(`updating movie ${movie.filename}`);
      movie.directors = [];
      movie.writers = [];
      movie.cast = [];
      movie.genres = [];
      movie.countries = [];
      
      this.scanLogs = "";
      const credits: DbCredit[] = await this.tmdbClient.getMovieData(movie);
      await mediaInfo(movie, path.join(this.moviesPath, movie.filename), this.log.bind(this));
      await this.insertCredits(credits);
      this.lastUpdate = Date.now();
    }

    for (let tvshow of (this.tables.tvshows?.find() || [])) {
      if (!tvshow.rating && tvshow.isSaga) {
        this.log(`updating tvshow ${tvshow.foldername}`);
        tvshow.seasons = [];
        tvshow.genres = [];
        tvshow.countries = [];

        this.scanLogs = "";
        if (tvshow.isSaga) {
          await this.tmdbClient.getCollectionData(tvshow);
        } else {
          await this.tmdbClient.getTvshowData(tvshow);
        }
        for (let episode of tvshow.episodes) {
          if (tvshow.isSaga) {
            await this.tmdbClient.addCollectionEpisode(tvshow, episode);
          } else {
            await this.tmdbClient.addTvshowEpisode(tvshow, episode);
          }
          await mediaInfo(episode, path.join(this.tvshowsPath, tvshow.foldername, episode.filename), this.log.bind(this));
          if (episode.seasonNumber > 0 && tvshow.seasons.filter(s => s.seasonNumber == episode.seasonNumber).length === 0) {
            const credits: DbCredit[] = await this.tmdbClient.addTvshowSeason(tvshow, episode.seasonNumber);
            await this.insertCredits(credits);
          }
        }
        this.lastUpdate = Date.now();
      }
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
    const imgFilenameSet: Set<string> = new Set<string>();
    //await new Promise(resolve => setTimeout(resolve, 1_000));
    await this.scanMovies(creditSet, imgFilenameSet);
    //await new Promise(resolve => setTimeout(resolve, 1_000));
    await this.scanTvshows(creditSet, imgFilenameSet);
    if (this.tables.credits) {
      for (const credit of this.tables.credits.find()) {
        if (creditSet.has(credit.tmdbid)) {
          imgFilenameSet.add(path.join('profiles_w185', credit.profilePath));
        } else {
          this.log(`[-] credit unreferenced ${credit.name}`);
          this.tables.credits.remove(credit);
        }
      }
    }
    await this.clearUnusedImages(imgFilenameSet);
    console.log("end catalog_load");
    this.scanning = false;
  }

  private async clearUnusedImages(imgFilenameSet: Set<string>) {
    ['backdrops_w1280', 'backdrops_w780', 'posters_w780', 'posters_w342', 'profiles_w185', 'stills_w300']
    .forEach(async foldername => {
      const filenames = await fs.promises.readdir(path.join(this.rootPath, 'db', 'images', foldername));
      for (const filename of filenames) {
        if(! imgFilenameSet.has(path.join(foldername, filename)) && path.extname(filename).toLowerCase() == ".jpg") {
          this.log(`[-] deleting image ${path.join(foldername, filename)}`);
          await fs.promises.unlink(path.join(this.rootPath, 'db', 'images', foldername, filename));
        }
      }
    });
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

  private async scanMovies(creditSet: Set<number>, imgFilenameSet: Set<string>) {
    this.log("begin scan_movies");
    // scanne le dossier pour détecter changements
    const filenames: string[] = await this.recursiveReaddir(this.moviesPath);
    const filenameSet: Set<string> = new Set<string>();
    for (const filename of filenames) {
      filenameSet.add(filename);
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
            rating: 0,
            ratingTs: 0,
          };
          const credits: DbCredit[] = await this.tmdbClient.autoIdentifyMovie(newMovie);
          await mediaInfo(newMovie, path.join(this.moviesPath, newMovie.filename), this.log.bind(this));
          this.tables.movies.insert(newMovie);
          await this.insertCredits(credits);
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
          imgFilenameSet.add(path.join('backdrops_w1280', movie.backdropPath)).add(path.join('backdrops_w780', movie.backdropPath));
          imgFilenameSet.add(path.join('posters_w780', movie.posterPath)).add(path.join('posters_w342', movie.posterPath));
        } else {
          this.log(`[-] file deleted ${movie.filename}`);
          this.tables.movies.remove(movie);
        }
      }
    }
    this.log("end scan_movies");
  }

  private async scanTvshows(creditSet: Set<number>, imgFilenameSet: Set<string>): Promise<void> {
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
            rating: 0,
            ratingTs: 0,
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
                await this.insertCredits(credits);
              }
              tvshow.episodes.push(episode);
            }
          }

          // nettoyage des épisodes
          const seasonNumberSet: Set<number> = new Set<number>();
          for (const episode of tvshow.episodes) {
            if (filenameSet.has(episode.filename)) {
              seasonNumberSet.add(episode.seasonNumber);
              imgFilenameSet.add(path.join('stills_w300', episode.stillPath));
            } else {
              this.log(`[-] file deleted ${episode.filename}`);
              episode.filename = "";
            }
          }
          tvshow.episodes = tvshow.episodes.filter(e => e.filename !== "");

          // nettoyage des saisons
          for (const season of tvshow.seasons) {
            if (seasonNumberSet.has(season.seasonNumber)) {
              season.cast.forEach(c => creditSet.add(c.tmdbid));
              imgFilenameSet.add(path.join('posters_w780', season.posterPath)).add(path.join('posters_w342', season.posterPath));
            } else {
              this.log(`[-] season unreferenced ${season.seasonNumber}`);
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
          imgFilenameSet.add(path.join('backdrops_w1280', tvshow.backdropPath)).add(path.join('backdrops_w780', tvshow.backdropPath));
          imgFilenameSet.add(path.join('posters_w780', tvshow.posterPath)).add(path.join('posters_w342', tvshow.posterPath));
          // await this.tmdbClient.updateTvshowData(tvshow);
        } else {
          this.log(`[-] folder deleted ${tvshow.foldername}`);
          this.tables.tvshows.remove(tvshow);
        }
      }
    }
    // nettoyer tvshow.episodes et tvshow.seasons et les images
    this.log("end scan_tvshows");
  }

  public async getConfig(request: FastifyRequest, reply: FastifyReply) {
    let userName: string = request.headers.authorization?.split(' ')[1] || "";
    userName = Buffer.from(userName, 'base64').toString('utf8').split(':')[0];
    reply.send({
      userName,
      config: {
        auth: "",
        moviesLocalPath: "",
        tvshowsLocalPath: "",
        tmpPath: "",
        tmdbApiKey: global.config.tmdbApiKey,
        youtubeApiKey: global.config.youtubeApiKey,
        ruTorrentURL: "",
        seedboxHost: "",
        seedboxPort: 0,
        seedboxUser: "",
        seedboxPassword: "",
        seedboxPath: "",
        yggUrl: global.config.yggUrl,
        yggUser: global.config.yggUser,
        yggPwd: global.config.yggPwd,
      }
    });
  }

  public async getLastUpdate(_request: FastifyRequest, reply: FastifyReply) {
    reply.send({ lastUpdate: this.lastUpdate });
  }

  public async getUsers(_request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.users?.find() });
  }

  public async getMovies(_request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.movies?.find(), lastUpdate: this.lastUpdate });
  }

  public async getMovie(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ movie: this.tables.movies?.find({ tmdbid: (request.params as any).movieId }) });
  }

  public async getTvshows(_request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.tvshows?.find(), lastUpdate: this.lastUpdate });
  }

  public async getCredits(_request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.credits?.find(), lastUpdate: this.lastUpdate });
  }

  public async getHome(request: FastifyRequest, reply: FastifyReply) {
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
          } else if (userStatus && userStatus.currentStatus == SeenStatus.toSee) {
            lists.recentMovies.push(movie);
            continue movieLoop;
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
          let userStatus: UserTvshowStatus|undefined = undefined;
          for (const us of tvshow.userStatus) {
            if (us.userName == user.name) {
              userStatus = us;
            }
          }
          let currentEpisode: Episode|undefined = selectCurrentEpisode(tvshow, user);
          if (inProgressCount > 0 || (seenCount > 0 && notSeenCount > 0 && (currentEpisode?.episodeNumbers[0] || 0) > 1)) {
            lists.inProgress.push(tvshow);
            continue tvshowLoop;
          } else if (lists.recentTvshows.length < RECENT_LENGTH_MAX && tvshow.createdMax > user.created && notSeenCount > 0) {
            lists.recentTvshows.push(tvshow);
            continue tvshowLoop;
          } else if (userStatus && userStatus.currentStatus == SeenStatus.toSee) {
            lists.recentTvshows.push(tvshow);
            continue tvshowLoop;
          }
        }
      }
    }
    reply.send({ lists, lastUpdate: this.lastUpdate });
  }

  public async setMoviePosition(request: FastifyRequest, reply: FastifyReply) {
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
      return reply.send({ userStatus: movie.userStatus });
    }
    reply.send({});
  }

  public async setEpisodePosition(request: FastifyRequest, reply: FastifyReply) {
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
        return reply.send({ userStatus: episode.userStatus });
      }
    }
    reply.send({});
  }

  public async scanNow(_request: FastifyRequest, reply: FastifyReply) {
    if (! this.scanning) {
      this.load();
    }
    reply.send({ logs: this.scanLogs, finished: ! this.scanning });
  }

  public async getScanProgress(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ logs: this.scanLogs.substring(parseFloat((request.params as any).offset)), finished: ! this.scanning });
  }

  public async setMovieStatus(request: FastifyRequest, reply: FastifyReply) {
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
      if (userStatus.currentStatus == SeenStatus.seen && userStatus.position > 0) {
        userStatus.position = 0;
      }
      this.tables.movies?.update(movie);
      this.lastUpdate = Date.now();
      return reply.send({ userStatus: movie.userStatus });
    }
    reply.send({});
  }

  public async setTvshowStatus(request: FastifyRequest, reply: FastifyReply) {
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
      return reply.send({ userStatus: tvshow.userStatus });
    }
    reply.send({});
  }

  public async setEpisodeStatus(request: FastifyRequest, reply: FastifyReply) {
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
        if (userStatus.currentStatus == SeenStatus.seen && userStatus.position > 0) {
          userStatus.position = 0;
        }
        this.tables.tvshows?.update(tvshow);
        this.lastUpdate = Date.now();
        return reply.send({ userStatus: episode.userStatus });
      }
    }
    reply.send({});
  }

  public async setMovieAudience(request: FastifyRequest, reply: FastifyReply) {
    let body: SetMovieAudienceMessage = request.body as SetMovieAudienceMessage;
    let movie = this.tables.movies?.findOne({ filename: body.filename });
    if (movie) {
      movie.audience = body.audience;
      this.tables.movies?.update(movie);
      this.lastUpdate = Date.now();
      return reply.send({ audience: movie.audience });
    }
    reply.send({});
  }

  public async setTvshowAudience(request: FastifyRequest, reply: FastifyReply) {
    let body: SetTvshowAudienceMessage = request.body as SetTvshowAudienceMessage;
    let tvshow = this.tables.tvshows?.findOne({ foldername: body.foldername });
    if (tvshow) {
      tvshow.audience = body.audience;
      this.tables.tvshows?.update(tvshow);
      this.lastUpdate = Date.now();
      return reply.send({ audience: tvshow.audience });
    }
    reply.send({});
  }

  public async parseFilename(request: FastifyRequest, reply: FastifyReply) {
    let body: FilenameMessage = request.body as FilenameMessage;
    const existingTvshows: { [key: string]: string } = {};
    this.tables.tvshows?.find().forEach(tvshow => {
      existingTvshows[`id${tvshow.tmdbid}`] = tvshow.foldername;
    })
    const parsedFilename: ParsedFilenameResponse = { existingTvshows, ...extractMovieTitle(body.filename) };

    if (fs.existsSync(path.join(global.config.tmpPath, path.basename(body.filename)))) {
      parsedFilename.asMovie = filenameParse(path.basename(body.filename).replace("[FR-EN]", "")); // supprime manuellement [FR-EN] qui est mal géré par la librairie
      parsedFilename.asTvshow = filenameParse(path.basename(body.filename), true) as ParsedShow;
      let fileInfo: FileInfo = {
        created: 0,
        filesize: -1,
        video: { width: -1, height: -1, codec: "" },
        audio: [],
        subtitles: [],
        duration: -1,            
      }
      fileInfo.rawData = await mediaInfo(fileInfo, path.join(global.config.tmpPath, path.basename(body.filename)), console.log);
      parsedFilename.fileInfo = fileInfo;
    }
    reply.send({ parsedFilename });
  }

  private async insertCredits(credits: DbCredit[]): Promise<void> {
    if (this.tables.credits) {
      for (const credit of credits) {
        const existingCredits: DbCredit[] | undefined = this.tables.credits?.find({ tmdbid: credit.tmdbid });
        if (existingCredits.length === 0) {
          await this.tmdbClient.downloadProfileImage(credit);
          this.tables.credits.insert(credit);
        } else if (existingCredits[0].profilePath != credit.profilePath) {
          existingCredits[0].profilePath = credit.profilePath;
          await this.tmdbClient.downloadProfileImage(credit);
          this.tables.credits.update(existingCredits[0]);
        }
      }
    }
  }

  public async reloadMovieMetadata(request: FastifyRequest, reply: FastifyReply) {
    let body: FilenameMessage = request.body as FilenameMessage;
    let movie = this.tables.movies?.findOne({ filename: body.filename });
    if (movie) {
      movie.directors = [];
      movie.writers = [];
      movie.cast = [];
      movie.genres = [];
      movie.countries = [];

      this.scanLogs = "";
      const credits: DbCredit[] = await this.tmdbClient.getMovieData(movie);
      await mediaInfo(movie, path.join(this.moviesPath, movie.filename), this.log.bind(this));
      await this.insertCredits(credits);
      this.lastUpdate = Date.now();
    }
    reply.send({ movie, log: this.scanLogs });
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

      const credits: DbCredit[] = await this.tmdbClient.getMovieData(movie);
      this.lastUpdate = Date.now();
    }
    reply.send({ movie });
  }

  public async reloadTvshowMetadata(request: FastifyRequest, reply: FastifyReply) {
    let body: FixTvshowMetadataMessage = request.body as FixTvshowMetadataMessage;
    let tvshow = this.tables.tvshows?.findOne({ foldername: body.foldername });
    if (tvshow) {
      // tvshow.episodes = []; on ne veut pas perdre les seenStatus
      tvshow.seasons = [];
      tvshow.genres = [];
      tvshow.countries = [];

      this.scanLogs = "";
      if (tvshow.isSaga) {
        await this.tmdbClient.getCollectionData(tvshow);
      } else {
        await this.tmdbClient.getTvshowData(tvshow);
      }
      for(let episode of tvshow.episodes) {
        if (tvshow.isSaga) {
          await this.tmdbClient.addCollectionEpisode(tvshow, episode);
        } else {
          await this.tmdbClient.addTvshowEpisode(tvshow, episode);
        }
        await mediaInfo(episode, path.join(this.tvshowsPath, tvshow.foldername, episode.filename), this.log.bind(this));
        if (episode.seasonNumber > 0 && tvshow.seasons.filter(s => s.seasonNumber == episode.seasonNumber).length === 0) {
          const credits: DbCredit[] = await this.tmdbClient.addTvshowSeason(tvshow, episode.seasonNumber);
          await this.insertCredits(credits);
        }
      }
      this.lastUpdate = Date.now();
    }
    reply.send({ tvshow, log: this.scanLogs });
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
      await this.scanTvshows(new Set<number>(), new Set<string>());
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

  public async getWishes(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.wishes?.find(), lastUpdate: this.lastUpdate });
  }

  public async addWish(request: FastifyRequest, reply: FastifyReply) {
    let body: WishMessage = request.body as WishMessage;
    let wish = this.tables.wishes?.findOne({ tmdbid: body.tmdbid });
    if (wish) {
      let userWish: UserWish | undefined = undefined;
      for (let uw of wish.users) {
        if (uw.userName == body.userName) {
          userWish = uw;
          break;
        }
      }
      if (!userWish) {
        userWish = { userName: body.userName, added: (new Date()).toUTCString() };
        wish.users.push(userWish);
      }
      this.tables.wishes?.update(wish);
    } else {
      this.tables.wishes?.insert({
        tmdbid: body.tmdbid,
        type: body.type,
        title: body.title,
        posterPath: body.posterPath,
        year: body.year,
        users: [{ userName: body.userName, added: (new Date()).toUTCString() }],
      });
    }
    this.lastUpdate = Date.now();
    reply.send({ wish });
  }

  public async removeWish(request: FastifyRequest, reply: FastifyReply) {
    let body: WishMessage = request.body as WishMessage;
    let wish = this.tables.wishes?.findOne({ tmdbid: body.tmdbid });
    if (wish) {
      wish.users = wish.users.filter((w) => w.userName != body.userName);
      if (wish.users.length) {
        this.tables.wishes?.update(wish);
      } else {
        this.tables.wishes?.remove(wish);
        wish = undefined;
      }
      this.lastUpdate = Date.now();
    }
    reply.send({ wish });
  }

  public async getDownloads(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.downloads?.find(), lastUpdate: this.lastUpdate });
  }

  public async checkSeedbox(request: FastifyRequest, reply: FastifyReply) {
    if (this.seedbox && this.tables.downloads)
      this.seedbox.downloadNewFiles(this.tables.downloads);
    reply.send({});
  }

  public async addTorrentFileToSeedbox(request: FastifyRequest, reply: FastifyReply) {
    // Check if request has multipart content
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request is not multipart' });
    }

    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const chunks: Buffer[] = []; // Convert the stream to a buffer to ensure it's properly sent
      for await (const chunk of data.file) {
        chunks.push(Buffer.from(chunk));
      }

      this.seedbox?.addTorrentFile(Buffer.concat(chunks), data.filename, false);
      reply.send({});
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Error uploading file' });
    }
  }
  
  public async getTorrentList(request: FastifyRequest, reply: FastifyReply) {
    try {
      const list = await this.seedbox?.getTorrentList();
      reply.send({ list })
    } catch (error) {
      reply.status(500).send({ error });
    }
  }

  public async getTorrentFilters(request: FastifyRequest, reply: FastifyReply) {
    try {
      const list = await this.seedbox?.getTorrentFilters();
      reply.send({ list })
    } catch (error) {
      reply.status(500).send({ error });
    }
  }

  public async getQuotas(request: FastifyRequest, reply: FastifyReply) {
    try {
      const seedboxQuota = await this.seedbox?.getQuota();
      const diskspace = await checkDiskSpace(global.config.tmpPath);
      const nasQuota = { free: diskspace.free, total: diskspace.size };
      reply.send({ quotas: { seedbox: seedboxQuota, nas: nasQuota }})
    } catch (error) {
      reply.status(500).send({ error });
    }
  }

  public async removeTorrent(request: FastifyRequest, reply: FastifyReply) {
    const hash = (request.body as any).hash;
    try {
      const list = await this.seedbox?.removeTorrent(hash);
      reply.send({})
    } catch (error) {
      reply.status(500).send({ error });
    }
  }

  public async ignoreDownload(request: FastifyRequest, reply: FastifyReply) {
    let body: DownloadMessage = request.body as DownloadMessage;
    let download = this.tables.downloads?.findOne({ path: body.path });
    if (download) {
      download.ignored = !download.ignored;
      this.lastUpdate = Date.now();
    }
    reply.send({ download });
  }

  public async deleteDownload(request: FastifyRequest, reply: FastifyReply) {
    let body: DownloadMessage = request.body as DownloadMessage;
    let download = this.tables.downloads?.findOne({ path: body.path });
    if (this.tables.downloads && download) {
      this.tables.downloads.remove(download);
      this.lastUpdate = Date.now();
    }
    reply.send({ list: this.tables.downloads?.find(), lastUpdate: this.lastUpdate });
  }

  public async setAutoId(request: FastifyRequest, reply: FastifyReply) {
    let body: AutoIdMessage = request.body as AutoIdMessage;
    const download = this.tables.downloads?.findOne({ path: body.path });
    if (!download) {
      reply.status(404);
      return reply.send({ error: "download not found" });
    }
    if (!download.autoId || download.autoId.username === body.autoId.username) {
      download.autoId = body.autoId;
      this.tables.downloads?.update(download);
    }
    return reply.send({ download });
  }

  public async importMovieDownload(request: FastifyRequest, reply: FastifyReply) {
    let body: ImportMovieDownloadMessage = request.body as ImportMovieDownloadMessage;
    const download = this.tables.downloads?.findOne({ path: body.path });
    if (!download) {
      reply.status(404);
      return reply.send({ error: "download not found" });
    }
    const filename: string = path.basename(body.filename);
    const filepath: string = path.join(this.moviesPath, filename);
    //const filepath: string = path.join(global.config.tmpPath, path.basename(body.path));
    if (this.tables.movies?.find({ filename }).length === 0) {
      try {
        await fs.promises.rename(path.join(global.config.tmpPath, path.basename(body.path)), filepath);
        this.lastUpdate = Date.now();
      } catch (error) {
        console.log(error);
        reply.status(500);
        return reply.send({ error });
      }
      console.log(`[+] file added ${filename}`);
      try {
        const newMovie: DbMovie = {
          filename,
          tmdbid: body.tmdbId,
          title: "",
          originalTitle: "",
          year: body.year,
          duration: -1,
          directors: [],
          writers: [],
          cast: [],
          genres: [],
          countries: [],
          audience: body.audience === undefined ? 999 : body.audience,
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
          rating: 0,
          ratingTs: 0,
        };
        const credits: DbCredit[] = await this.tmdbClient.getMovieData(newMovie);
        await mediaInfo(newMovie, filepath, this.log.bind(this));
        this.tables.movies.insert(newMovie);
        await this.insertCredits(credits);
        download.imported = true;
        this.tables.downloads?.update(download);
        return reply.send({ newMovie });
      } catch (e) {
        console.error(e);
        console.log((e instanceof Error) ? `[error] ${e.message}` : '[error] Unknown Error');
      }
    }
    reply.status(500);
    return reply.send({ error: "File already exists" });
  }

  public async importTvshowDownload(request: FastifyRequest, reply: FastifyReply) {
    let body: ImportTvshowDownloadMessage = request.body as ImportTvshowDownloadMessage;
    const download = this.tables.downloads?.findOne({ path: body.path });
    if (!download) {
      reply.status(404);
      return reply.send({ error: "download not found" });
    }
    const foldername: string = path.basename(body.foldername);
    let folderpath: string = path.join(this.tvshowsPath, foldername);
    const newTvshow: DbTvshow = {
      foldername,
      tmdbid: body.tmdbId,
      title: "",
      originalTitle: "",
      genres: [],
      countries: [],
      audience: body.audience === undefined ? 999 : body.audience,
      synopsys: "",
      backdropPath: "",
      posterPath: "",
      userStatus: [],
      searchableContent: "",
      episodes: [],
      seasons: [],
      isSaga: false,
      createdMin: 0,
      createdMax: 0,
      airDateMin: "",
      airDateMax: "",
      rating: 0,
      ratingTs: 0,
    };
    try {
      if (!fs.existsSync(folderpath)) {
        await fs.promises.mkdir(folderpath);
        try {
          await this.tmdbClient.getTvshowData(newTvshow);
          this.tables.tvshows?.insert(newTvshow);
        } catch (e) {
          console.error(e);
          console.log((e instanceof Error) ? `[error] ${e.message}` : '[error] Unknown Error');
        }
      } else if (fs.existsSync(path.join(folderpath, path.basename(body.path)))) {
        reply.status(500);
        return reply.send({ error: "File already exists" });
      }
      await fs.promises.rename(path.join(global.config.tmpPath, path.basename(body.path)), path.join(folderpath, path.basename(body.path)));
      this.lastUpdate = Date.now();
    } catch (error) {
      console.log(error);
      reply.status(500);
      return reply.send({ error });
    }
    console.log(`[+] file added ${path.join(folderpath, path.basename(body.path))}`);
    await this.scanTvshows(new Set<number>(), new Set<string>());

    download.imported = true;
    this.tables.downloads?.update(download);
    return reply.send({ newTvshow });
  }
}

