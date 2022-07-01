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

    // /catalog/user/list
    server.get('/catalog/users', catalog.getUsers.bind(catalog));
    // /catalog/config
    server.get('/catalog/config', catalog.getConfig.bind(catalog));
    // /catalog/movies/*
    server.get('/catalog/movies/list', catalog.getMovies.bind(catalog));
    server.get('/catalog/movies/:movieId', catalog.getMovie.bind(catalog));
    // /catalog/credits/*
    server.get('/catalog/credits/list', catalog.getCredits.bind(catalog));
    // /catalog/set_status
    server.post('/catalog/set_status', catalog.setStatus.bind(catalog));
    // /catalog/set_audience
    server.post('/catalog/set_audience', catalog.setAudience.bind(catalog));
    // /catalog/set_position
    server.post('/catalog/set_position', catalog.setPosition.bind(catalog));


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

