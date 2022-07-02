import { Config, DbUser, DbMovie, DbCredit, ParsedFilename, UserMovieStatus } from '../../api/src/types';

const cache = {
  config: null,
  users: null,
  movies: null,
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

  setPosition(movie: DbMovie, userName: string, callback: Function, position: number): void {
    fetch('/catalog/set_position', {
      method: "POST",
      headers: new Headers({'content-type': 'application/json'}),
      body: JSON.stringify({ filename: movie.filename, userName, position })
    }).then(async (response) => {
      let json = await response.json();
      movie.userStatus = json.userStatus;
      callback();
    });
  }

  setStatus(movie: DbMovie, userName: string, field: string, value: any): Promise<UserMovieStatus[]> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/set_status', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ filename: movie.filename, userName, field, value })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.userStatus);
      });
    });
  }

  setAudience(movie: DbMovie, audience: number): Promise<number> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/set_audience', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ filename: movie.filename, audience })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.audience);
      });
    });
  }

  parseFilename(filename: string): Promise<ParsedFilename> {
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

  fixMetadata(filename: string, tmdbId: number): Promise<DbMovie> {
    return new Promise((resolve, reject) => {
      fetch('/catalog/fix_metadata', {
        method: "POST",
        headers: new Headers({'content-type': 'application/json'}),
        body: JSON.stringify({ filename, tmdbId })
      }).then(async (response) => {
        let json = await response.json();
        resolve(json.movie);
      });
    });
  }
}

const apiClient: ApiClient = new ApiClient();
export default apiClient;