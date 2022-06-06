import path from 'path';
import fs from 'fs';

import { FastifyRequest, FastifyReply } from 'fastify';
import Loki from 'lokijs';
const { LokiFsAdapter } = Loki;

import { DbUser, DbMovie, DbTvshow, DbCredit, DataTables } from './types';
import { TmdbClient, mediaInfo } from './tmdb';

type CatalogOptions = {
  moviesPath: string;
  tvshowsPath: string;
  rootPath: string;
}

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
      this.tables.users.insert({ name: 'max' });
      this.tables.users.insert({ name: 'flo' });
      this.tables.users.insert({ name: 'amélie' });
      this.tables.users.insert({ name: 'thomas' });
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

  private async scanMovies(delay: number) {
    console.log("scanMovies begin");
    await new Promise(resolve => setTimeout(resolve, delay));
    // scanner dossier pour détecter changements
    const filenames: string[] = await fs.promises.readdir(this.moviesPath);
    for (const filename of filenames) {
      if (videoExts.indexOf(path.extname(filename).toLowerCase()) < 0) {
        continue;
      }
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
    console.log("scanMovies end");
  }

  private async scanTvshows(delay: number) {
    await new Promise(resolve => setTimeout(resolve, delay));
    // scanner dossier pour détecter changements
  }

  public getMovies(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.movies?.data });
  }

  public getMovie(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ movie: this.tables.movies?.find() });
  }

  public getCredits(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ list: this.tables.credits?.data });
  }

}

