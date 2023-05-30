import { FastifyRequest, FastifyReply } from 'fastify';
import * as cheerio from 'cheerio';

declare var fetch: typeof import('undici').fetch;
export class YggProxy {
  async top(request: FastifyRequest, reply: FastifyReply) {
  const url = (request.query as any).url;
  try {
    const response = await fetch(url);
    const content = await response.json();
    reply.type('text/json').send(content);
  } catch (error) {
    reply.status(500).send('Error fetching URL');
  }
}

async details(request: FastifyRequest, reply: FastifyReply) {
  const url = (request.query as any).url;
  const urlObject = new URL(url);
  const scheme = urlObject.protocol.replace(':', '');
  const host = urlObject.host;
  try {
    const response = await fetch(url);
    const html = await response.text();

    const $ = cheerio.load(html);
    $('head').prepend(`<base href="${scheme}://${host}/"/>`);
    $('#top_panel, header, #top, #cat, footer, .infos-torrent > tbody > tr:first, #viewFiles, .description-header').remove();
    reply.type('text/html').send($.html());
  } catch (error) {
    reply.status(500).send('Error fetching URL');
  }
}
}

export const yggProxy = new YggProxy();