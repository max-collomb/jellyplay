import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { startHttp } from './http';
import { Catalog } from './catalog';

const rootPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

type ConfigFile = {
  moviesLocalPath: string;
  moviesRemotePath: string;
  tvshowsLocalPath: string;
  tvshowsRemotePath: string;
}

declare global {
  var config: ConfigFile;
}

export async function main() {
  console.log("main begin");
  global.config = JSON.parse(fs.readFileSync(path.join(rootPath, 'config.json'), 'utf8'));

  const catalog: Catalog = new Catalog({
    moviesPath: global.config.moviesLocalPath,
    tvshowsPath: global.config.tvshowsLocalPath,
    rootPath,
  });

  await catalog.load();

  await startHttp(rootPath, catalog);

  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log("main end");
}

main();