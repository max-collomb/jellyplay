import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { startHttp } from './http';
import { Catalog } from './catalog';
import { Config } from './types';

const rootPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

declare global {
  var config: Config;
}

export async function main() {
  console.log("main begin");
  global.config = JSON.parse(fs.readFileSync(path.join(rootPath, 'config.json'), 'utf8'));

  const catalog: Catalog = new Catalog({
    moviesPath: global.config.moviesLocalPath,
    tvshowsPath: global.config.tvshowsLocalPath,
    rootPath,
  });

  await startHttp(rootPath, catalog);

  await catalog.load();

  console.log("main end");
}

main();