import FTP from "basic-ftp";
import path from "path";
import { Blob } from 'buffer'; 
import { fetch, FormData } from 'undici';
import { DbDownload, SeedboxTorrent, SeedboxFilter, Quota } from "./types";

export type SeedboxOptions = {
  ruTorrentURL: string;
  host: string;
  port: number;
  user: string;
  password: string;
  path: string;
  localPath: string;
}

export function now(): string {
  const d = new Date();
  const z = (n: string | number) => (`0${n}`).slice(-2);
  const zz = (n: string | number) => (`00${n}`).slice(-3);
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

export class Seedbox {
  MIN_FILE_SIZE: number = 28 * 1024 * 1024;
  
  options: SeedboxOptions;
  downloading: boolean;

  constructor(options: SeedboxOptions) {
    this.options = options;
    this.downloading = false;
  }

  async listRecursive(client: FTP.Client, path: string): Promise<DbDownload[]> {
  let list = await client.list();
  let result: DbDownload[] = [];
  for (var f in list) {
    let fileInfo = list[f];
    if (fileInfo.type == 1) { // file
      if (fileInfo.size > this.MIN_FILE_SIZE)
        result.push({ path: path + '/' + fileInfo.name, started: -1, finished: -1, progress: 0, size: fileInfo.size, imported: false, ignored: false });
    } else if (fileInfo.type == 2) { // folder
      await client.cd(fileInfo.name);
      result.push.apply(result, await this.listRecursive(client, path + '/' + fileInfo.name));
      await client.cd('..');
    }
  }
  return result;
}

  async downloadNewFiles(downloads: Collection<DbDownload>) {
    if (! this.downloading) {
      console.log(now() + " checking for new files on FTP");
      this.downloading = true;
      // get file list from ftp
      const ftpClient = new FTP.Client();
      let fileList: DbDownload[] = [];
      try {
        const { host, user, password, port } = this.options;
        await ftpClient.access({ host, user, password, port, secure: false });
        await ftpClient.cd(this.options.path);
        fileList = await this.listRecursive(ftpClient, this.options.path);
        let newFileList: DbDownload[] = [];
        for (let download of fileList) {
          if (downloads.find({ path: download.path }).length === 0) {
            newFileList.push(download);
            downloads.insert(download);
          }
        }
        for (let download of newFileList) {
          download.started = Date.now();
          console.log(now() + " downloading " + download.path);
          ftpClient.trackProgress((infos) => {
            download.progress = infos.bytes / download.size * 100;
            downloads.update(download);
            if (process.stdout.clearLine) {
              process.stdout.clearLine(0);
              process.stdout.cursorTo(0);
              process.stdout.write(download.progress.toFixed(2) + '%')
            }
          });
          try {
            await ftpClient.downloadTo(path.join(this.options.localPath, path.basename(download.path)), download.path);
            console.log(now() + " download finished");
            download.finished = Date.now();
            download.progress = 100;
            downloads.update(download);
          } catch (err) {
            console.log(err);
          }
        }
        ftpClient.close();
      }
      catch (err) {
        console.log(err);
      }

      this.downloading = false;
    }
  }
  
  async addTorrent(torrentUrl: string): Promise<void> {
    const url = new URL(this.options.ruTorrentURL);
    url.pathname = url.pathname.replace(/\/$/, '') + '/php/addtorrent.php';
    const form = new URLSearchParams();
    form.append('url', torrentUrl);
    // form.append('torrents_start_stopped', '1');
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.options.user}:${this.options.password}`).toString('base64')}`,
      },
      body: form,
    });
    if (!response.ok) {
      throw new Error("Error posting torrent");
    }
  }

  async addTorrentFile(buffer: Buffer, filename: string, startPaused: boolean = false): Promise<void> {
    const url = new URL(this.options.ruTorrentURL);
    url.pathname = url.pathname.replace(/\/$/, '') + '/php/addtorrent.php';
    const formData = new FormData(); // Create a FormData object for multipart/form-data
    formData.append('torrent_file', new Blob([buffer]), filename); // Append the torrent file to the form
    if (startPaused) {
      formData.append('torrents_start_stopped', '1'); // Add option to start torrents in stopped state if needed
    }
    const response = await fetch(url.toString(), { // Send the request to ruTorrent
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${this.options.user}:${this.options.password}`).toString('base64')}` },
      body: formData,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error posting torrent: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  async getTorrentList(): Promise<SeedboxTorrent[]> {
    const url = new URL(this.options.ruTorrentURL);
    url.pathname = url.pathname.replace(/\/$/, '') + '/plugins/httprpc/action.php';
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.options.user}:${this.options.password}`).toString('base64')}`,
      },
      body: 'mode=list&cmd=d.throttle_name%3D&cmd=d.custom%3Dsch_ignore&cmd=cat%3D%22%24t.multicall%3Dd.hash%3D%2Ct.scrape_complete%3D%2Ccat%3D%7B%23%7D%22&cmd=cat%3D%22%24t.multicall%3Dd.hash%3D%2Ct.scrape_incomplete%3D%2Ccat%3D%7B%23%7D%22&cmd=cat%3D%24d.views%3D&cmd=d.custom%3Dseedingtime&cmd=d.custom%3Daddtime',
    });
    if (!response.ok) {
      throw new Error("Error getting torrent list");
    }
    const list: any = await response.json();
    const torrents: SeedboxTorrent[] = [];
    for (const key in list.t) {
      torrents.push({
        hash: key,
        name: list.t[key][4],
        size: parseFloat(list.t[key][5]),
        downloaded: parseFloat(list.t[key][8]),
        uploaded: parseFloat(list.t[key][9]),
        ratio: parseFloat(list.t[key][10]) / 1000,
        finished: parseFloat(list.t[key][21]),
      });
    }
    return torrents;
  }

  async getTorrentFilters(): Promise<SeedboxFilter[]> {
    const url = new URL(this.options.ruTorrentURL);
    url.pathname = url.pathname.replace(/\/$/, '') + '/plugins/rss/action.php';
    const response = await fetch(url.toString() + "?mode=getfilters", {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.options.user}:${this.options.password}`).toString('base64')}`,
      },
    });
    if (!response.ok) {
      throw new Error("Error getting seedbox rss filters");
    }
    const list: any = await response.json();
    const filters: SeedboxFilter[] = [];
    for (const f of list) {
      filters.push({
        name: f.name,
        pattern: f.pattern,
        enabled: f.enabled,
      });
    }
    return filters;
  }

  async getQuota(): Promise<Quota> {
    const url = new URL(this.options.ruTorrentURL);
    url.pathname = url.pathname.replace(/\/$/, '') + '/plugins/diskspace/action.php';
    url.searchParams.append('_', Date.now().toString());
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.options.user}:${this.options.password}`).toString('base64')}`,
      }
    });
    if (!response.ok) {
      throw new Error("Error posting torrent");
    }
    const quota = await response.json();
    return quota as Quota;
  }

  async removeTorrent(hash: string): Promise<void> {
    const url = new URL(this.options.ruTorrentURL);
    url.pathname = url.pathname.replace(/\/$/, '') + '/plugins/httprpc/action.php';
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.options.user}:${this.options.password}`).toString('base64')}`,
      },
      body: `<?xml version="1.0" encoding="UTF-8"?><methodCall><methodName>system.multicall</methodName><params><param><value><array><data><value><struct><member><name>methodName</name><value><string>d.custom5.set</string></value></member><member><name>params</name><value><array><data><value><string>${hash}</string></value><value><string>1</string></value></data></array></value></member></struct></value><value><struct><member><name>methodName</name><value><string>d.delete_tied</string></value></member><member><name>params</name><value><array><data><value><string>${hash}</string></value></data></array></value></member></struct></value><value><struct><member><name>methodName</name><value><string>d.erase</string></value></member><member><name>params</name><value><array><data><value><string>${hash}</string></value></data></array></value></member></struct></value></data></array></value></param></params></methodCall>`,
    });
    if (!response.ok) {
      throw new Error("Error removing torrent");
    }
  }
}
