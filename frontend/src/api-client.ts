import { DbMovie, DbCredit } from '../../api/src/types';

const cache = {
  movies: null,
  credits: null,
};

class ApiClient {
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
}

const apiClient: ApiClient = new ApiClient();
export default apiClient;