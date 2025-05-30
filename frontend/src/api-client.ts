import {
  AutoId, Config, DbUser, DbMovie, DbCredit, DbTvshow, Episode, HomeLists, ParsedFilenameResponse, ScanStatus,
  UserEpisodeStatus, UserMovieStatus, UserTvshowStatus, DbWish, DbDownload, SeedboxTorrent, SeedboxFilter, Quotas,
} from '../../api/src/types';
import { SeenStatus, MediaType } from '../../api/src/enums';
import { eventBus } from './event-bus';

const cache = {
  config: null,
  users: null,
  homeLists: null,
  homeListsTs: 0,
  movies: null,
  moviesTs: 0,
  tvshows: null,
  tvshowsTs: 0,
  credits: null,
  creditsTs: 0,
  wishes: null,
  wishesTs: 0,
  downloads: null,
  downloadsTs: 0,
  lastUpdate: 0,
};

export class ApiClient {
  clearCache() {
    cache.homeLists = null;
    cache.homeListsTs = 0;
    cache.movies = null;
    cache.moviesTs = 0;
    cache.tvshows = null;
    cache.tvshowsTs = 0;
    cache.credits = null;
    cache.creditsTs = 0;
    cache.wishes = null;
    cache.wishesTs = 0;
    cache.downloads = null;
    cache.downloadsTs = 0;
  }

  needRefresh(category: string): boolean {
    switch (category) {
      case 'home':
        return cache.homeListsTs === 0 || cache.homeListsTs < cache.lastUpdate;
      case 'movies':
        return cache.moviesTs === 0 || cache.moviesTs < cache.lastUpdate;
      case 'tvshows':
        return cache.tvshowsTs === 0 || cache.tvshowsTs < cache.lastUpdate;
      case 'credits':
        return cache.creditsTs === 0 || cache.creditsTs < cache.lastUpdate;
      case 'wishes':
        return cache.wishesTs === 0 || cache.wishesTs < cache.lastUpdate;
      case 'downloads':
        return cache.downloadsTs === 0 || cache.downloadsTs < cache.lastUpdate;
      default:
        return false;
    }
  }

  async getConfig(): Promise<{ config: Config, userName: string }> {
    return new Promise((resolve) => {
      if (cache.config) {
        resolve(cache.config);
      } else {
        fetch('/catalog/config')
          .then(async (response) => {
            const json = await response.json();
            cache.config = json.config;
            resolve(json);
          });
      }
    });
  }

  async getLastUpdate(): Promise<number> {
    return new Promise((resolve) => {
      fetch('/catalog/lastupdate')
        .then(async (response) => {
          const json = await response.json();
          cache.lastUpdate = json.lastUpdate;
          resolve(json.lastUpdate);
        });
    });
  }

  async getUsers(): Promise<DbUser[]> {
    return new Promise((resolve) => {
      if (cache.users) {
        resolve(cache.users);
      } else {
        fetch('/catalog/users')
          .then(async (response) => {
            const json = await response.json();
            cache.users = json.list;
            resolve(json.list);
          });
      }
    });
  }

  async getMovies(): Promise<DbMovie[]> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      if (cache.movies) {
        if (cache.moviesTs >= cache.lastUpdate) {
          cache.lastUpdate = await this.getLastUpdate();
        }
        if (cache.moviesTs < cache.lastUpdate) {
          cache.movies = null;
        }
      }
      if (cache.movies) {
        resolve(cache.movies);
      } else {
        fetch('/catalog/movies/list')
          .then(async (response) => {
            const json = await response.json();
            cache.movies = json.list;
            cache.moviesTs = json.lastUpdate;
            resolve(json.list);
          });
      }
    });
  }

  async getTvshows(): Promise<DbTvshow[]> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      if (cache.tvshows) {
        if (cache.tvshowsTs >= cache.lastUpdate) {
          cache.lastUpdate = await this.getLastUpdate();
        }
        if (cache.tvshowsTs < cache.lastUpdate) {
          cache.tvshows = null;
        }
      }
      if (cache.tvshows) {
        resolve(cache.tvshows);
      } else {
        fetch('/catalog/tvshows/list')
          .then(async (response) => {
            const json = await response.json();
            cache.tvshows = json.list;
            cache.tvshowsTs = json.lastUpdate;
            resolve(json.list);
          });
      }
    });
  }

  async getCredits(): Promise<DbCredit[]> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      if (cache.credits) {
        if (cache.creditsTs >= cache.lastUpdate) {
          cache.lastUpdate = await this.getLastUpdate();
        }
        if (cache.creditsTs < cache.lastUpdate) {
          cache.credits = null;
        }
      }
      if (cache.credits) {
        resolve(cache.credits);
      } else {
        fetch('/catalog/credits/list')
          .then(async (response) => {
            const json = await response.json();
            cache.credits = json.list;
            cache.creditsTs = json.lastUpdate;
            resolve(json.list);
          });
      }
    });
  }

  async getHome(userName: string): Promise<HomeLists> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      if (cache.homeLists) {
        if (cache.homeListsTs >= cache.lastUpdate) {
          cache.lastUpdate = await this.getLastUpdate();
        }
        if (cache.homeListsTs < cache.lastUpdate) {
          cache.homeLists = null;
        }
      }
      if (cache.homeLists) {
        resolve(cache.homeLists);
      } else {
        fetch(`/catalog/home/${userName}`)
          .then(async (response) => {
            const json = await response.json();
            cache.homeLists = json.list;
            cache.homeListsTs = json.lastUpdate;
            resolve(json.lists);
          });
      }
    });
  }

  async scanNow(): Promise<ScanStatus> {
    return new Promise((resolve) => {
      fetch('/catalog/scan_now')
        .then(async (response) => {
          const json = await response.json();
          resolve(json);
        });
    });
  }

  async getScanProgress(offset: number): Promise<ScanStatus> {
    return new Promise((resolve) => {
      fetch(`/catalog/get_scan_progress/${offset}`)
        .then(async (response) => {
          const json = await response.json();
          resolve(json);
        });
    });
  }

  setMoviePosition(filename: string, userName: string, position: number): void {
    if (window._positions[filename] === position) return;
    window._positions[filename] = position;
    fetch('/catalog/movie/set_position', {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ filename, userName, position }),
    }).then(async (response) => {
      const json = await response.json();
      eventBus.emit('movie-position-changed', { filename, userStatus: json.userStatus });
    });
  }

  setEpisodePosition(foldername: string, filename: string, userName: string, position: number): void {
    if (window._positions[filename] === position) return;
    window._positions[filename] = position;
    fetch('/catalog/tvshow/set_position', {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        foldername, filename, userName, position,
      }),
    }).then(async (response) => {
      const json = await response.json();
      eventBus.emit('episode-position-changed', { foldername, filename, userStatus: json.userStatus });
    });
  }

  async setMovieStatus(movie: DbMovie, userName: string | undefined, status: SeenStatus): Promise<UserMovieStatus[]> {
    return new Promise((resolve) => {
      fetch('/catalog/movie/set_status', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ filename: movie.filename, userName, status }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.userStatus);
      });
    });
  }

  async setTvshowStatus(tvshow: DbTvshow, userName: string | undefined, status: SeenStatus): Promise<UserTvshowStatus[]> {
    return new Promise((resolve) => {
      fetch('/catalog/tvshow/set_status', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ foldername: tvshow.foldername, userName, status }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.userStatus);
      });
    });
  }

  async setEpisodeStatus(tvshow: DbTvshow, episode: Episode, userName: string | undefined, status: SeenStatus): Promise<UserEpisodeStatus[]> {
    return new Promise((resolve) => {
      fetch('/catalog/tvshow/set_episode_status', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          foldername: tvshow.foldername, filename: episode.filename, userName, status,
        }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.userStatus);
      });
    });
  }

  async setMovieAudience(movie: DbMovie, audience: number): Promise<number> {
    return new Promise((resolve) => {
      fetch('/catalog/movie/set_audience', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ filename: movie.filename, audience }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.audience);
      });
    });
  }

  async setTvshowAudience(tvshow: DbTvshow, audience: number): Promise<number> {
    return new Promise((resolve) => {
      fetch('/catalog/tvshow/set_audience', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ foldername: tvshow.foldername, audience }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.audience);
      });
    });
  }

  async parseFilename(filename: string): Promise<ParsedFilenameResponse> {
    return new Promise((resolve) => {
      fetch('/catalog/parse_filename', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ filename }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.parsedFilename);
      });
    });
  }

  async reloadMovieMetadata(filename: string): Promise<DbMovie> {
    return new Promise((resolve) => {
      fetch('/catalog/movie/reload_metadata', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ filename }),
      }).then(async (response) => {
        const json = await response.json();
        // eslint-disable-next-line no-console
        if (json.log) { console.log(json.log); }
        resolve(json.movie);
      });
    });
  }

  async fixMovieMetadata(filename: string, tmdbId: number): Promise<DbMovie> {
    return new Promise((resolve) => {
      fetch('/catalog/movie/fix_metadata', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ filename, tmdbId }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.movie);
      });
    });
  }

  async reloadTvshowMetadata(foldername: string): Promise<DbTvshow> {
    return new Promise((resolve) => {
      fetch('/catalog/tvshow/reload_metadata', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ foldername }),
      }).then(async (response) => {
        const json = await response.json();
        // eslint-disable-next-line no-console
        if (json.log) { console.log(json.log); }
        resolve(json.tvshow);
      });
    });
  }

  async fixTvshowMetadata(foldername: string, tmdbId: number): Promise<DbTvshow> {
    return new Promise((resolve) => {
      fetch('/catalog/tvshow/fix_metadata', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ foldername, tmdbId }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.tvshow);
      });
    });
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<string> {
    return new Promise((resolve) => {
      fetch('/catalog/rename_file', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ oldFilename, newFilename }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.newFilename);
      });
    });
  }

  async deleteFile(filename: string): Promise<void> {
    return new Promise((resolve) => {
      fetch('/catalog/delete_file', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ filename }),
      }).then(async () => {
        resolve();
      });
    });
  }

  async getWishes(): Promise<DbWish[]> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      if (cache.wishes) {
        if (cache.wishesTs >= cache.lastUpdate) {
          cache.lastUpdate = await this.getLastUpdate();
        }
        if (cache.wishesTs < cache.lastUpdate) {
          cache.wishes = null;
        }
      }
      if (cache.wishes) {
        resolve(cache.wishes);
      } else {
        fetch('/catalog/wishes/list')
          .then(async (response) => {
            const json = await response.json();
            cache.wishes = json.list;
            cache.wishesTs = json.lastUpdate;
            resolve(json.list);
          });
      }
    });
  }

  async addToWishList(tmdbid: number, title: string, type: MediaType, posterPath: string, year: number, userName: string): Promise<DbWish | undefined> {
    return new Promise((resolve) => {
      fetch('/catalog/wish/add', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          tmdbid, title, type, userName, posterPath, year,
        }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.wish);
        eventBus.emit('wishes-changed');
      });
    });
  }

  async removeFromWishList(tmdbid: number, userName: string): Promise<DbWish | undefined> {
    return new Promise((resolve) => {
      fetch('/catalog/wish/remove', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          tmdbid,
          userName,
          title: '',
          type: MediaType.unknown,
          posterPath: '',
          year: 0,
        }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.wish);
        eventBus.emit('wishes-changed');
      });
    });
  }

  async checkSeedbox(): Promise<void> {
    return new Promise((resolve) => {
      fetch('/catalog/downloads/check_seedbox')
        .then(async (response) => {
          await response.json();
          resolve();
        });
    });
  }

  async getDownloads(): Promise<DbDownload[]> {
    return new Promise((resolve) => {
      fetch('/catalog/downloads/list')
        .then(async (response) => {
          const json = await response.json();
          cache.downloads = json.list;
          cache.downloadsTs = json.lastUpdate;
          resolve(json.list);
          eventBus.emit('downloads-fetched', { downloads: json.list });
        });
    });
  }

  async getSeedboxQuota(): Promise<Quotas> {
    return new Promise((resolve) => {
      fetch('/catalog/downloads/quotas')
        .then(async (response) => {
          const json = await response.json();
          resolve(json.quotas);
          // eventBus.emit('seedbox-downloads-fetched', { torrents: json.list });
        });
    });
  }

  async getSeedboxDownloads(): Promise<SeedboxTorrent[]> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/downloads/seedbox_list')
        .then(async (response) => {
          const json = await response.json();
          if (json.list) {
            json.list.reverse();
            resolve(json.list);
          } else {
            reject();
          }
          // eventBus.emit('seedbox-downloads-fetched', { torrents: json.list });
        });
    });
  }

  async getSeedboxFilters(): Promise<SeedboxFilter[]> {
    return new Promise((resolve) => {
      fetch('/catalog/downloads/seedbox_filters')
        .then(async (response) => {
          const json = await response.json();
          resolve(json.list);
          // eventBus.emit('seedbox-filters-fetched', { filters: json.list });
        });
    });
  }

  async removeSeedboxTorrent(hash: string): Promise<SeedboxTorrent[]> {
    return new Promise((resolve) => {
      fetch('/catalog/downloads/seedbox_remove', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ hash }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.list);
      });
    });
  }

  async ignoreDownload(path: string): Promise<DbDownload[]> {
    return new Promise((resolve) => {
      fetch('/catalog/download/ignore', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ path }),
      }).then(async (response) => {
        const json = await response.json();
        resolve([json.download]);
        eventBus.emit('downloads-changed');
      });
    });
  }

  async deleteDownload(path: string): Promise<DbDownload[]> {
    return new Promise((resolve) => {
      fetch('/catalog/download/delete', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ path }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.list);
        eventBus.emit('downloads-changed');
      });
    });
  }

  async setAutoId(path: string, autoId: AutoId): Promise<DbDownload> {
    return new Promise((resolve) => {
      fetch('/catalog/downloads/set_auto_id', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ path, autoId }),
      }).then(async (response) => {
        const json = await response.json();
        resolve(json.download);
        eventBus.emit('downloads-changed');
      });
    });
  }

  async importMovieDownload(path: string, tmdbId: number, year: number, filename: string, audience?: number): Promise<DbMovie> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/download/import_movie', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          path, tmdbId, year, filename, audience,
        }),
      }).then(async (response) => {
        const json = await response.json();
        if (json.newMovie) { resolve(json.newMovie); } else { reject(json.error); }
      });
    });
  }

  async importTvshowDownload(path: string, tmdbId: number, foldername: string, audience?: number): Promise<DbMovie> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/download/import_tvshow', {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          path, tmdbId, foldername, audience,
        }),
      }).then(async (response) => {
        const json = await response.json();
        if (json.newTvshow) { resolve(json.newTvshow); } else { reject(json.error); }
      });
    });
  }
}

export const apiClient: ApiClient = new ApiClient();
export default apiClient;
