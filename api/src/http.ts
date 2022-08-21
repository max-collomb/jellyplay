import path from 'path';
import { Server, IncomingMessage, ServerResponse } from 'http';

import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyFavicon from 'fastify-favicon';

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

    // route /images => ressources statiques
    server.register(fastifyStatic, {
      root: path.join(rootPath, 'db', 'images'),
      prefix: '/images',
      decorateReply: false
    });

    // /favicon.ico
    server.register(fastifyFavicon, { path: path.join(rootPath, 'dist'), name: 'favicon.ico' });

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

    server.post('/catalog/movie/set_status', catalog.setMovieStatus.bind(catalog));
    server.post('/catalog/tvshow/set_status', catalog.setTvshowStatus.bind(catalog));
    server.post('/catalog/tvshow/set_episode_status', catalog.setEpisodeStatus.bind(catalog));
    server.post('/catalog/movie/set_audience', catalog.setMovieAudience.bind(catalog));
    server.post('/catalog/tvshow/set_audience', catalog.setTvshowAudience.bind(catalog));
    server.post('/catalog/movie/set_position', catalog.setMoviePosition.bind(catalog));
    server.post('/catalog/tvshow/set_position', catalog.setEpisodePosition.bind(catalog));
    server.post('/catalog/parse_filename', catalog.parseFilename.bind(catalog));
    server.post('/catalog/movie/fix_metadata', catalog.fixMovieMetadata.bind(catalog));
    server.post('/catalog/tvshow/fix_metadata', catalog.fixTvshowMetadata.bind(catalog));
    server.post('/catalog/rename_file', catalog.renameFile.bind(catalog));
    server.post('/catalog/delete_file', catalog.deleteFile.bind(catalog));


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

