import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

import { startHttp } from './http';
import { Catalog } from './catalog';
import { Config } from './types';
import { Seedbox } from './seedbox';

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

  if (global.config.seedboxHost && global.config.seedboxPort) {
    const seedbox: Seedbox = new Seedbox({
      host: global.config.seedboxHost,
      port: global.config.seedboxPort,
      user: global.config.seedboxUser,
      password: global.config.seedboxPassword,
      path: global.config.seedboxPath,
      localPath: global.config.tmpPath,
    });
    catalog.seedbox = seedbox;
    if (catalog.tables.downloads)
      seedbox.downloadNewFiles(catalog.tables.downloads);
    cron.schedule(
      '*/5 * * * *',
      () => {
        if (catalog.tables.downloads)
          seedbox.downloadNewFiles(catalog.tables.downloads);
      });
  }

  console.log("main end");
}

main();