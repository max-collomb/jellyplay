import path from 'path';

import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyFavicon from 'fastify-favicon';
import fastifyMultipart from '@fastify/multipart';

import { Catalog } from './catalog';

export const server: FastifyInstance = Fastify({});

export const startHttp = async (rootPath: string, catalog: Catalog) => {
  console.log("startHttp begin");
  try {

    // route /frontend => ressources statiques
    server.register(fastifyStatic, {
      root: path.join(rootPath, '..', 'frontend', 'dist'),
      prefix: '/frontend',
      decorateReply: false
    });

    server.register(fastifyStatic, {
      root: path.join(rootPath, '..', 'frontend', 'static'),
      prefix: '/static',
      decorateReply: false
    });

    // route /images => ressources statiques
    server.register(fastifyStatic, {
      root: path.join(rootPath, 'db', 'images'),
      prefix: '/images',
      decorateReply: false
    });

    // /favicon.ico
    server.register(fastifyFavicon, { path: path.join(rootPath, 'dist'), name: 'favicon.ico' });
    
    // Register content type parser for raw bodies (fallback for binary files)
    server.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => { done(null, body); });

    // Register multipart content parser with options to accept torrent files
    server.register(fastifyMultipart, { limits: { fileSize: 50 * 1024 * 1024 /* 50MB limit */ }, });

    server.get('/catalog/lastupdate', catalog.getLastUpdate.bind(catalog));
    server.get('/catalog/users', catalog.getUsers.bind(catalog));
    server.get('/catalog/config', catalog.getConfig.bind(catalog));
    server.get('/catalog/movies/list', catalog.getMovies.bind(catalog));
    server.get('/catalog/tvshows/list', catalog.getTvshows.bind(catalog));
    server.get('/catalog/movies/:movieId', catalog.getMovie.bind(catalog));
    server.get('/catalog/credits/list', catalog.getCredits.bind(catalog));
    server.get('/catalog/home/:userName', catalog.getHome.bind(catalog));
    server.get('/catalog/scan_now', catalog.scanNow.bind(catalog));
    server.get('/catalog/get_scan_progress/:offset', catalog.getScanProgress.bind(catalog));
    server.get('/catalog/wishes/list', catalog.getWishes.bind(catalog));
    server.get('/catalog/downloads/list', catalog.getDownloads.bind(catalog));
    server.get('/catalog/downloads/check_seedbox', catalog.checkSeedbox.bind(catalog));
    server.get('/catalog/downloads/seedbox_list', catalog.getTorrentList.bind(catalog));
    server.get('/catalog/downloads/seedbox_filters', catalog.getTorrentFilters.bind(catalog));
    server.get('/catalog/downloads/quotas', catalog.getQuotas.bind(catalog));
    
    server.post('/ygg/download', catalog.addTorrentFileToSeedbox.bind(catalog));

    server.post('/catalog/movie/set_status', catalog.setMovieStatus.bind(catalog));
    server.post('/catalog/tvshow/set_status', catalog.setTvshowStatus.bind(catalog));
    server.post('/catalog/tvshow/set_episode_status', catalog.setEpisodeStatus.bind(catalog));
    server.post('/catalog/movie/set_audience', catalog.setMovieAudience.bind(catalog));
    server.post('/catalog/tvshow/set_audience', catalog.setTvshowAudience.bind(catalog));
    server.post('/catalog/movie/set_position', catalog.setMoviePosition.bind(catalog));
    server.post('/catalog/tvshow/set_position', catalog.setEpisodePosition.bind(catalog));
    server.post('/catalog/parse_filename', catalog.parseFilename.bind(catalog));
    server.post('/catalog/movie/reload_metadata', catalog.reloadMovieMetadata.bind(catalog));
    server.post('/catalog/movie/fix_metadata', catalog.fixMovieMetadata.bind(catalog));
    server.post('/catalog/tvshow/reload_metadata', catalog.reloadTvshowMetadata.bind(catalog));
    server.post('/catalog/tvshow/fix_metadata', catalog.fixTvshowMetadata.bind(catalog));
    server.post('/catalog/rename_file', catalog.renameFile.bind(catalog));
    server.post('/catalog/delete_file', catalog.deleteFile.bind(catalog));
    server.post('/catalog/wish/add', catalog.addWish.bind(catalog));
    server.post('/catalog/wish/remove', catalog.removeWish.bind(catalog));
    server.post('/catalog/download/ignore', catalog.ignoreDownload.bind(catalog));
    server.post('/catalog/download/delete', catalog.deleteDownload.bind(catalog));
    server.post('/catalog/downloads/set_auto_id', catalog.setAutoId.bind(catalog));
    server.post('/catalog/download/import_movie', catalog.importMovieDownload.bind(catalog));
    server.post('/catalog/download/import_tvshow', catalog.importTvshowDownload.bind(catalog));
    server.post('/catalog/downloads/seedbox_remove', catalog.removeTorrent.bind(catalog));

    await server.listen(3000, '0.0.0.0');
    const address = server.server.address();
    const port = typeof address === 'string' ? address : address?.port;
  } catch (err) {
    console.log("error", err);
    server.log.error(err);
    process.exit(1);
  }
  console.log("startHttp end");
}

