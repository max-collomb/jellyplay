import { statSync, existsSync } from 'fs'; 
import * as path from 'path';
import { FastifyRequest, FastifyReply } from 'fastify';
import * as cheerio from 'cheerio';
// import { fetch } from 'undici';
import util from 'util';
import { exec } from 'child_process';
const execPromise = util.promisify(exec);

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

export class YggProxy {

  cloudFlareActive = false;
  // cookies: Cookie[] = [];
  // cookiesTs: number = 0;

  // private async fetchFlare(href: string, isJson: boolean = false): Promise<any> {
  //   if (!this.cloudFlareActive) {
  //     let response = await fetch(href);
  //     console.log("response.status", response.status);
  //     if (response.status == 403)
  //       this.cloudFlareActive = true;
  //     else if (isJson)
  //       return await response.json();
  //     else
  //       return response.text();
  //   }
  //   console.log("CloudFlare is active");
  //   let fsResponse = await fetch(global.config.flareSolverrUrl, {
  //     method: 'POST',
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ cmd: "sessions.list" }),
  //   });
  //   const sessionList: any = await fsResponse.json();
  //   // console.log("A) session.list", sessionList);
  //   let session = "session_" + Date.now();
  //   if (sessionList.sessions.length) {
  //     session = sessionList.sessions[0];
  //   } else {
  //     await fetch(global.config.flareSolverrUrl, {
  //       method: 'POST',
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ cmd: "sessions.create", session }),
  //     });
  //     fsResponse = await fetch(global.config.flareSolverrUrl, {
  //       method: 'POST',
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ cmd: "sessions.list" }),
  //     });
  //     // console.log("B) session.list", await fsResponse.json());
  //   }
  //   fsResponse = await fetch(global.config.flareSolverrUrl, {
  //     method: 'POST',
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ cmd: "request.get", session, url: href, maxTimeout: 60000, session_ttl_minutes: 10 }),
  //   });
  //   const responseJson: any = await fsResponse.json();
  //   // console.log('responseJson: ', responseJson);
  //   if (responseJson.status == 'ok' && responseJson.solution) {
  //     if (isJson) {
  //       let json = responseJson.solution.response
  //         .replace(`<html><head><meta name="color-scheme" content="light dark"></head><body><pre style="word-wrap: break-word; white-space: pre-wrap;">`, "")
  //         .replace(`</pre></body></html>`, "")
  //         .replace(/&gt;/g, '>')
  //         .replace(/&lt;/g, '<')
  //         .replace(/&amp;/g, '&');
  //       return JSON.parse(json);
  //     } else {
  //       return responseJson.solution.response.replace('\\n', '\n').replace('\\t', '\t');
  //     }
  //   }
  //   return "";
  // }

  private async fetch(href: string, isJson: boolean = false): Promise<any> {
    // let response;
    // if ((this.cookies.length == 0) || (Date.now() - this.cookiesTs > 29 * 60 * 1000)) {
    //   const loginUrl = global.config.yggUrl + '/auth/process_login';
    //   this.cookies = [];
    //   this.cookiesTs = Date.now();
    //   const form = new FormData();
    //   form.append('id', 'macol');
    //   form.append('pass', '6hD4EZLEWJrx');
    //   try {
    //     response = await fetch(loginUrl, { method: 'POST', body: form, redirect: 'manual' });
    //     this.cookies = getSetCookies(response.headers);
    //   } catch (error) {
    //     console.log(error);
    //   }
    // }
    // const headers = new Headers()
    // setCookie(headers, { name: 'undici', value: 'setCookie' })
    // this.cookies.forEach(cookie => setCookie(headers, cookie));
    // response = await fetch(href, { headers, redirect: 'manual' });
    // const txt = await response.text();
    // return isJson ? JSON.parse(txt) : txt;
    const cookiePath = path.join(global.config.tmpPath, "cookie.txt");
    if (!existsSync(cookiePath) || (Date.now() - statSync(cookiePath).mtime.getTime() > 29 * 60 * 1000)) {
      await execPromise(`curl -F "id=${global.config.yggUser}" -F "pass=${global.config.yggPwd}" -c "${cookiePath}" ${global.config.yggUrl}/auth/process_login`);
    }
    const { stdout } = await execPromise(`curl -b "${cookiePath}" "${href}"`);
    return isJson ? JSON.parse(stdout) : stdout;
  }

  async isCloudFlareActive(_request: FastifyRequest, reply: FastifyReply) {
    reply.type('text/json').send({ isActive: this.cloudFlareActive });
  }

  async top(request: FastifyRequest, reply: FastifyReply) {
    const url = (request.query as any).url;
    try {
      const content = await this.fetch(url, true);
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
      const html = await this.fetch(url);

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
      const html = await this.fetch(url);

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
          // downloadUrl: `${scheme}://${host}/rss/download?id=${id}&passkey=`,
          downloadUrl: `${global.config.yggProxyUrl}?action=get-torrent&id=${id}`,
          name: $anchor.text(),
          age: getNextText($(this).find('td:nth-child(5) > span')),
          size: $(this).find('td:nth-child(6)').text(),
          seeds,
          rank: seeds,
        });
      });
      reply.type('text/json').send(results);
    } catch (error) {
      console.log('error: ', error);
      reply.status(500).send('Error fetching URL');
    }

    
  }

  async setYggUrl() {
    const { stdout } = await execPromise(`curl "${global.config.yggProxyUrl}?action=get-ygg-url"`);
    if (stdout !== global.config.yggUrl) {
      await execPromise(`curl "${global.config.yggProxyUrl}?action=set-ygg-url&url=${encodeURIComponent(global.config.yggUrl)}"`);
    }
  }
}

export const yggProxy = new YggProxy();