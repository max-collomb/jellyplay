import path from 'path';
import { fileURLToPath } from 'url';

import { startHttp } from './http';
import { Catalog } from './catalog';

const rootPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function main() {
  console.log("main begin");
  const moviesPath: string = path.join(rootPath, '..', 'sample-library', 'movies');
  const moviesClientPath: string = 'C:\\dev\\git\\jellyplay\\sample-library\\movies';
  const tvshowsPath: string = path.join(rootPath, '..', 'sample-library', 'tvshows');
  const tvshowsClientPath: string = 'C:\\dev\\git\\jellyplay\\sample-library\\tvshows';

  const catalog: Catalog = new Catalog({ moviesPath, tvshowsPath, rootPath });

  await catalog.load();

  await startHttp(rootPath, catalog);

  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log("main end");
}

main();