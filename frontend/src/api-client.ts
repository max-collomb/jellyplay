import { Config, DbUser, DbMovie, DbCredit, DbTvshow, Episode, HomeLists, ParsedFilename, ScanStatus, UserEpisodeStatus, UserMovieStatus, UserTvshowStatus } from '../../api/src/types';

const cache = {
  config: null,
  users: null,
  movies: null,
  tvshows: null,
  credits: null,
};

class ApiClient {
  async getConfig(): Promise<Config> {
    return new Promise((resolve, reject) => {
      if (cache.config) {
        resolve(cache.config);
      } else {
        fetch('/catalog/config')
        .then(async (response) => {
          let json = await response.json();
          cache.config = json.config;
          resolve(json.config);
        });
      }
    });
  }

  async getUsers(): Promise<DbUser[]> {
    return new Promise((resolve, reject) => {
      if (cache.users) {
        resolve(cache.users);
      } else {
        fetch('/catalog/users')
        .then(async (response) => {
          let json = await response.json();
          cache.users = json.list;
          resolve(json.list);
        });
      }
    });
  }

  async getMovies(): Promise<DbMovie[]> {
    return new Promise((resolve, reject) => {
      if (cache.movies) {
        resolve(cache.movies);
      } else {
        fetch('/catalog/movies/list')
        .then(async (response) => {
          let json = await response.json();
          cache.movies = json.list;
          resolve(json.list);
        });
      }
    });
  }

  async getTvshows(): Promise<DbTvshow[]> {
    return new Promise((resolve, reject) => {
      if (cache.tvshows) {
        resolve(cache.tvshows);
      } else {
        fetch('/catalog/tvshows/list')
        .then(async (response) => {
          let json = await response.json();
          cache.tvshows = json.list;
          resolve(json.list);
        });
      }
    });
  }

  async getCredits(): Promise<DbCredit[]> {
    return new Promise((resolve, reject) => {
      if (cache.credits) {
        resolve(cache.credits);
      } else {
        fetch('/catalog/credits/list')
        .then(async (response) => {
          let json = await response.json();
          cache.credits = json.list;
          resolve(json.list);
        });
      }
    });
  }

  async getHome(userName: string): Promise<HomeLists> {
    return new Promise((resolve, reject) => {
      fetch(`/catalog/home/${userName}`)
      .then(async (response) => {
        let json = await response.json();
        resolve(json.lists);
      });
    });
  }

  async scanNow(): Promise<ScanStatus> {
    return new Promise((resolve, reject) => {
      fetch(`/catalog/scan_now`)
      .then(async (response) => {
        let json = await response.json();
        resolve(json);
      });
    });    
  }

  async getScanProgress(offset: number): Promise<ScanStatus> {
    return new Promise((resolve, reject) => {
      fetch(`/catalog/get_scan_progress/${offset}`)
      .then(async (response) => {
        let json = await response.json();
        resolve(json);
      });
    });    
  }

  setMoviePosition(movie: DbMovie, userName: string, callback: Function, position: number): void {
    fetch('/catalog/movie/set_position', {
      method: "POST",
      headers: new Headers({'content-type': 'application/json'}),
      body: JSON.stringify({ filename: movie.filename, userName, position })
    }).then(async (response) => {
      let json = await response.json();
      movie.userStatus = json.userStatus;
      callback();
    });
  }

  setEpisodePosition(tvshow: DbTvshow, episode: Episode, userName: string, callback: Function, position: number): void {
    fetch('/catalog/tvshow/set_position', {
      method: "POST",
      headers: new Headers({'content-type': 'application/json'}),
      body: JSON.stringify({ foldername: tvshow.foldername, filename: episode.filename, userName, position })
    }).then(async (response) => {
      let json = await response.json();
      episode.userStatus = json.userStatus;
      callback();
    });
  }

  async setMovieStatus(movie: DbMovie, userName: string, status: SeenStatus): Promise<UserMovieStatus[]> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/movie/set_status', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ filename: movie.filename, userName, status })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.userStatus);
      });
    });
  }

  async setTvshowStatus(tvshow: DbTvshow, userName: string, status: SeenStatus): Promise<UserTvshowStatus[]> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/tvshow/set_status', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ foldername: tvshow.foldername, userName, status })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.userStatus);
      });
    });
  }

  async setEpisodeStatus(tvshow: DbTvshow, episode: Episode, userName: string, status: SeenStatus): Promise<UserEpisodeStatus[]> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/tvshow/set_episode_status', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ foldername: tvshow.foldername, filename: episode.filename, userName, status })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.userStatus);
      });
    });
  }

  async setMovieAudience(movie: DbMovie, audience: number): Promise<number> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/movie/set_audience', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ filename: movie.filename, audience })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.audience);
      });
    });
  }

  async setTvshowAudience(tvshow: DbTvshow, audience: number): Promise<number> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/tvshow/set_audience', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ foldername: tvshow.foldername, audience })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.audience);
      });
    });
  }

  async parseFilename(filename: string): Promise<ParsedFilename> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/parse_filename', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ filename })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.parsedFilename);
      });
    });
  }

  async fixMovieMetadata(filename: string, tmdbId: number): Promise<DbMovie> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/movie/fix_metadata', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ filename, tmdbId })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.movie);
      });
    });
  }

  async fixTvshowMetadata(foldername: string, tmdbId: number): Promise<DbTvshow> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/tvshow/fix_metadata', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ foldername, tmdbId })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.tvshow);
      });
    });
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/rename_file', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ oldFilename, newFilename })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.newFilename);
      });
    });
  }

  async deleteFile(filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/delete_file', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ filename })
      }).then(async () => {
        resolve();
      });
    });
  }
}

const apiClient: ApiClient = new ApiClient();
export default apiClient;