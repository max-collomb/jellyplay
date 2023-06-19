import { FastifyRequest, FastifyReply } from 'fastify';
import * as cheerio from 'cheerio';

export type YggResult = {
  id: string;
  category: number;
  url: string;
  downloadUrl: string;
  name: string;
  age: string;
  size: string;
  seeds: number;
  rank: number;
}

const getNextText = (element: any) => {
  if (!element.nodeName) { // If it's a Cheerio object...
    element = element[0];
  }
  const next = element.nextSibling;
  return next?.nodeType === 3 ? next.nodeValue.trim() : "";
};

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

  async search(request: FastifyRequest, reply: FastifyReply) {
    const url = (request.query as any).url;
    const urlObject = new URL(url);
    const scheme = urlObject.protocol.replace(':', '');
    const host = urlObject.host;
    try {
      const response = await fetch(url);
      const html = await response.text();

      const $ = cheerio.load(html);
      const results: YggResult[] = [];
      $('div.table-responsive.results > table > tbody > tr').each(function() {
        const $anchor = $(this).find('td:nth-child(2) > a');
        const match = (/.*\/torrent\/.*\/.*\/([0-9]+).*/gi).exec($anchor.attr('href') || '');
        const id = match ? match[1] : '';
        const seeds = parseFloat($(this).find('td:nth-child(8)').text());
        results.push({
          id,
          category: parseFloat($(this).find('td:nth-child(1) > div.hidden').text()),
          url: $anchor.attr('href') || '',
          downloadUrl: `${scheme}://${host}/rss/download?id=${id}&passkey=`,
          name: $anchor.text(),
          age: getNextText($(this).find('td:nth-child(5) > span')),
          size: $(this).find('td:nth-child(6)').text(),
          seeds,
          rank: seeds,
        });
      });
      reply.type('text/json').send(results);
    } catch (error) {
      reply.status(500).send('Error fetching URL');
    }

    
  }
}

export const yggProxy = new YggProxy();