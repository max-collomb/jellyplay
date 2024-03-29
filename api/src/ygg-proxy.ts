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

  cloudFlareActive = false;

  private async fetchFlare(href: string, isJson: boolean = false): Promise<any> {
    if (!this.cloudFlareActive) {
      let response = await fetch(href);
      console.log("response.status", response.status);
      if (response.status == 403)
        this.cloudFlareActive = true;
      else if (isJson)
        return await response.json();
      else
        return response.text();
    }
    console.log("CloudFlare is active");
    let fsResponse = await fetch(global.config.flareSolverrUrl, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "sessions.list" }),
    });
    const sessionList: any = await fsResponse.json();
    // console.log("A) session.list", sessionList);
    let session = "session_" + Date.now();
    if (sessionList.sessions.length) {
      session = sessionList.sessions[0];
    } else {
      await fetch(global.config.flareSolverrUrl, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "sessions.create", session }),
      });
      fsResponse = await fetch(global.config.flareSolverrUrl, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "sessions.list" }),
      });
      // console.log("B) session.list", await fsResponse.json());
    }
    fsResponse = await fetch(global.config.flareSolverrUrl, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "request.get", session, url: href, maxTimeout: 60000, session_ttl_minutes: 10 }),
    });
    const responseJson: any = await fsResponse.json();
    // console.log('responseJson: ', responseJson);
    if (responseJson.status == 'ok' && responseJson.solution) {
      if (isJson) {
        let json = responseJson.solution.response
          .replace(`<html><head><meta name="color-scheme" content="light dark"></head><body><pre style="word-wrap: break-word; white-space: pre-wrap;">`, "")
          .replace(`</pre></body></html>`, "")
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&amp;/g, '&');
        return JSON.parse(json);
      } else {
        return responseJson.solution.response.replace('\\n', '\n').replace('\\t', '\t');
      }
    }
    return "";
  }

  async isCloudFlareActive(_request: FastifyRequest, reply: FastifyReply) {
    reply.type('text/json').send({ isActive: this.cloudFlareActive });
  }

  async top(request: FastifyRequest, reply: FastifyReply) {
    const url = (request.query as any).url;
    try {
      const content = await this.fetchFlare(url, true);
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
      const html = await this.fetchFlare(url);

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
      const html = await this.fetchFlare(url);

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