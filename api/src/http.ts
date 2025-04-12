import path from 'path';
import fs from 'fs';
import util from 'util';

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyFavicon from 'fastify-favicon';
import fastifyMultipart from '@fastify/multipart';
import fastifyBasicAuth from 'fastify-basic-auth';
import geoip from 'geoip-lite';

import { Catalog } from './catalog';

const stat = util.promisify(fs.stat);
export const server: FastifyInstance = Fastify({});

export const startHttp = async (rootPath: string, catalog: Catalog) => {
  console.log("startHttp begin");
  try {

    server.register(fastifyBasicAuth, {
      validate: function (username, password, _req, _reply, done) {
        const users = catalog.tables.users?.find();
        if (users) {
          for (var user of users) {
            if (username === user.name && password === global.config.auth) {
              done();
              return;
            }
          }
        }
        done(new Error('Unauthorized'));
      },
      authenticate: true
    });

    server.after(() => {
      // GeoBlocking
      server.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => {
        const ip = request.ip; // Get client IP address
        // Allow localhost and local network IPs
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('fe80:') /* link-local IPv6 addresses*/) {
          return done(); // Allow the request to continue
        }
        const geo = geoip.lookup(ip); // Look up geography information for the IP
        if (!geo || geo.country !== 'FR') { // If geo lookup failed or country doesn't match allowed country, reject the request
          return reply.code(403).send({ error: 'Access denied', message: 'Access denied' });
        }
        done(); // Continue with the request if country is allowed
      });
      server.addHook('onRequest', server.basicAuth);
    });

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

    // route /jellyplay-client => ressources statiques
    server.register(fastifyStatic, {
      root: process.platform == 'win32' ? 'X:\\media\\jellyplay-client' : '/volume1/share/media/jellyplay-client',
      prefix: '/jellyplay-client',
      decorateReply: false
    });

    // /favicon.ico
    server.register(fastifyFavicon, { path: path.join(rootPath, 'dist'), name: 'favicon.ico' });
    
    // Register content type parser for raw bodies (fallback for binary files)
    server.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => { done(null, body); });

    // Register multipart content parser with options to accept torrent files
    server.register(fastifyMultipart, { limits: { fileSize: 50 * 1024 * 1024 /* 50MB limit */ }, });

    server.get('/files/:type/*', async (request: FastifyRequest, reply: FastifyReply) => {
      const type: string = (request.params as any).type;
      const filename: string = (request.params as any)['*'];
      // Input validation
      if (typeof type !== 'string' || (type !== 'movie' && type !== 'tvshow')) {
        console.error(`Invalid type parameter received: ${type}`);
        return reply.status(400).send('Invalid');
      }
      if (filename.includes('\0') || filename.includes('/../') || filename.includes('\\..\\')) {
        console.error(`Invalid filename parameter received: ${filename}`);
        return reply.status(400).send('Invalid');
      }
      if (!['.avi', '.mkv', '.mp4', '.mpg', '.mpeg', '.wmv'].includes(path.extname(filename).toLowerCase())) {
        console.error(`Invalid filename extension received: ${filename}`);
        return reply.status(400).send('Invalid');
      }
      const basePath = type == 'movie' ? global.config.moviesLocalPath : global.config.tvshowsLocalPath;
      const filePath = path.resolve(path.join(basePath, filename));
      if (!filePath.startsWith(basePath + path.sep)) {
        console.error(`Security Error: Resolved path "${filePath}" is outside of base path "${basePath}" (request filename : ${filename})`);
        return reply.status(400).send('Invalid');
      }

      // Input validated => sending file part
      try {
        // Get file info
        const stats = await stat(filePath);
        const fileSize = stats.size;

        // Parse Range header
        const range = request.headers.range;

        if (!range) {
          // No range requested, send entire file
          reply.type('application/octet-stream');
          return reply.sendFile(filename);
        }

        // Parse the range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        // console.log("range request : " + start + " - " + end);
        
        // Validate range
        if (start >= fileSize || end >= fileSize || start > end) {
          // Return 416 Range Not Satisfiable
          reply.code(416);
          reply.header('Content-Range', `bytes */${fileSize}`);
          return reply.send();
        }

        const chunkSize = (end - start) + 1;

        // Set headers
        reply.code(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        reply.header('Accept-Ranges', 'bytes');
        reply.header('Content-Length', chunkSize);
        reply.type('application/octet-stream');

        // Create read stream for the requested range
        const stream = fs.createReadStream(filePath, { start, end });

        // Send the stream
        return reply.send(stream);
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          reply.code(404);
          return reply.send({ error: 'File not found' });
        }

        request.log.error(err);
        reply.code(500);
        return reply.send({ error: 'Internal server error' });
      }
    });

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

