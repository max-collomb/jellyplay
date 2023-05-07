import FTP from "basic-ftp";
import path from "path";
import { DbDownload } from "./types";

export type SeedboxOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  path: string;
  localPath: string;
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
    if (fileInfo.type == 1) {// file
      if (fileInfo.size > this.MIN_FILE_SIZE)
        result.push({ path: path + '/' + fileInfo.name, started: -1, finished: -1, progress: 0, size: fileInfo.size, imported: false });
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
      this.downloading = true;
      // get file list from ftp
      const ftpClient = new FTP.Client();
      let fileList: DbDownload[] = [];
      try {
        const { host, user, password, port } = this.options;
        await ftpClient.access({ host, user, password, port, secure: false });
        await ftpClient.cd(this.options.path);
        fileList = await this.listRecursive(ftpClient, this.options.path);
        for (let download of fileList) {
          if (downloads.find({ path: download.path, progress: 100 }).length === 0) {
            download.started = Date.now();
            downloads.insert(download);
            console.log("downloading " + download.path);
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
              download.finished = Date.now();
              download.progress = 100;
              downloads.update(download);
            } catch (err) {
              console.log(err);
            }
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
  
}