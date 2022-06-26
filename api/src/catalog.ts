import path from 'path';
import fs from 'fs';

import { FastifyRequest, FastifyReply } from 'fastify';
import Loki from 'lokijs';
const { LokiFsAdapter } = Loki;

import { DbUser, DbMovie, DbTvshow, DbCredit, DataTables, UserMovieStatus } from './types';
import { TmdbClient, mediaInfo } from './tmdb';

type CatalogOptions = {
  moviesPath: string;
  tvshowsPath: string;
  rootPath: string;
};

type setPositionMessage = {
  filename: string;
  userName: string;
  position: number;
};

type setMovieStatusMessage = {
  filename: string;
  userName: string;
  field: string;
  value: any;  
};

const videoExts = ['.avi', '.mkv', '.mp4', '.mpg', '.mpeg', '.wmv'];

export class Catalog {
  moviesPath: string;
  tvshowsPath: string;
  rootPath: string;
  dbReady: Promise<void>;
  db: Loki;
  tmdbClient: TmdbClient;
  tables: DataTables = {};

  constructor(options: CatalogOptions) {
    this.moviesPath = options.moviesPath;
    this.tvshowsPath = options.tvshowsPath;
    this.rootPath = options.rootPath;
    const dbFilename = this.moviesPath.slice(-32) // 32 derniers caractères du chemin
                           .replace(/[\W]+/g,"_") // remplace tous les caractères autre que [a-zA-Z0-9] en _
                           .replace(/_+/g, "_");  // remplace plusieurs _ consécutifs par un seul
    let dbLoaded: () => void;
    this.dbReady = new Promise((resolve, relject) => {
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
    this.tmdbClient = new TmdbClient('3b46e3ee8f7f66bf1449b4c85c0b2819', 'fr-FR', path.join(this.rootPath, 'db', 'images'));
  }

  private initSchemas(): void {
    this.tables.users = this.db.getCollection('users');
    if (this.tables.users === null) {
      this.tables.users = this.db.addCollection(
        'users',
        {
          unique: ['name'],
          autoupdate: true,
          indices: ['name'],
        }
       );
      this.tables.users.insert({ name: 'max',    audience: 999, admin: true  });
      this.tables.users.insert({ name: 'flo',    audience: 999, admin: false });
      this.tables.users.insert({ name: 'amélie', audience: 12,  admin: false });
      this.tables.users.insert({ name: 'thomas', audience: 12,  admin: false });
    }

    this.tables.movies = this.db.getCollection('movies');
    if (this.tables.movies === null) {
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
    if (this.tables.tvshows === null) {
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
    if (this.tables.credits === null) {
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

  public async load(): Promise<void> {
    console.log("catalog_load begin");
    await this.dbReady;
    this.scanMovies(1_000); // TODO 10_000
    this.scanTvshows(2_000); // TODO 20_000
    console.log("catalog_load end");
  }

  private async recursiveReaddir(rootPath: string): Promise<string[]> {
    const pathes: string[] = [];
    const readdir = async function (folderPath: string, list: string[]): Promise<void> {
      const filenames = await fs.promises.readdir(path.join(rootPath, folderPath));
      for (const filename of filenames) {
        const stat = await fs.promises.lstat(path.join(rootPath, folderPath, filename));
        if (stat.isDirectory()) {
          await readdir(path.join(folderPath, filename), list);
        } else if (videoExts.indexOf(path.extname(filename).toLowerCase()) > -1) {
          list.push(path.join(folderPath, filename));
        }
      }
    }
    await readdir("", pathes);
    return pathes;
  }

  private async scanMovies(delay: number) {
    console.log("scanMovies begin");
    await new Promise(resolve => setTimeout(resolve, delay));
    // scanner dossier pour détecter changements
    const filenames: string[] = await this.recursiveReaddir(this.moviesPath);
    const filenameSet: Set<string> = new Set<string>();
    for (const filename of filenames) {
      filenameSet.add(filename);
      const filepath: string = path.join(this.moviesPath, filename);
      if (this.tables.movies?.find({ filename }).length === 0) {
        console.log(`new file detected ${filename}`);
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
          created: "",
          filesize: -1,
          video: { width: -1, height: -1, codec: "" },
          audio: [],
          subtitles: [],
          userStatus: [],
        };
        const credits: DbCredit[] = await this.tmdbClient.autoIdentifyMovie(newMovie);
        await mediaInfo(newMovie, path.join(this.moviesPath, newMovie.filename));
        this.tables.movies.insert(newMovie);
        for (const credit of credits) {
          if (this.tables.credits?.find({ tmdbid: credit.tmdbid }).length === 0) {
            await this.tmdbClient.downloadProfileImage(credit);
            this.tables.credits.insert(credit);
          }
        }
      }
    }
    const creditSet: Set<number> = new Set<number>();
    if (this.tables.movies) {
      for (const movie of this.tables.movies.find()) {
        if (filenameSet.has(movie.filename)) {
          movie.cast.forEach(c => creditSet.add(c.tmdbid));
          movie.writers.forEach(id => creditSet.add(id));
          movie.directors.forEach(id => creditSet.add(id));
        } else {
          console.log(`file doesn't exist anymore ${movie.filename}`);
          await this.tmdbClient.unlinkMovieImages(movie);
          this.tables.movies.remove(movie);
        }
        if (! movie.userStatus) {
          movie.userStatus = [];
          this.tables.movies.update(movie);
        }
      }
    }
    if (this.tables.credits) {
      for (const credit of this.tables.credits.find()) {
        if (! creditSet.has(credit.tmdbid)) {
          console.log(`credit has no reference anymore ${credit.name}`);
          await this.tmdbClient.unlinkProfileImage(credit);
          this.tables.credits.remove(credit);
        }
      }
    }
    console.log("scanMovies end");
  }

  private async scanTvshows(delay: number) {
    await new Promise(resolve => setTimeout(resolve, delay));
    // scanner dossier pour détecter changements
  }

  public getConfig(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ config: global.config });
  }  

  public getUsers(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.users?.find() });
  }

  public getMovies(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.movies?.find() });
  }

  public getMovie(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ movie: this.tables.movies?.find({ tmdbid: (request.params as any).movieId }) });
  }

  public getCredits(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.credits?.find() });
  }

  public setPosition(request: FastifyRequest, reply: FastifyReply) {
    let body: setPositionMessage = request.body as setPositionMessage;
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
        userStatus = { userName: body.userName, position: 0, seen: [], toSee: false, notInterested: false };
        movie.userStatus.push(userStatus);
      }
      userStatus.position = body.position;
      if (body.position > movie.duration * 0.9) {
        console.log("> 90 %");
        userStatus.position = 0;
        userStatus.toSee = false;
        let timestamp: number = Date.now();
        if (! userStatus.seen.length || timestamp - userStatus.seen[userStatus.seen.length - 1] > 24 * 60 * 60 * 1_000) {
          console.log("adding TS to seen array");
          userStatus.seen.push(timestamp);
        }
      }
      this.tables.movies?.update(movie);
      reply.send({ userStatus: movie.userStatus });
    }
    reply.send({});
  }

  public setStatus(request: FastifyRequest, reply: FastifyReply) {
    let body: setMovieStatusMessage = request.body as setMovieStatusMessage;
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
        userStatus = { userName: body.userName, position: 0, seen: [], toSee: false, notInterested: false };
        movie.userStatus.push(userStatus);
      }
      if (body.field == "toSee")
        userStatus.toSee = body.value as boolean;
      else if (body.field == "notInterested")
        userStatus.notInterested = body.value as boolean;
      this.tables.movies?.update(movie);
      reply.send({ userStatus: movie.userStatus });
    }
    reply.send({});
  }

}

