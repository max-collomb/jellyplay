import { YggResult } from '../../api/src/ygg-proxy';

export interface YggItem {
  id: string;
  category: string;
  detailLink: string;
  downloadLink: string;
  name: string;
  age: string;
  size: number;
  sizeStr: string;
  completed: string;
}

export class YggClient {
  baseUrl: string = '';

  passkey: string = '';

  categories: { [key: string]: string } = { movies: '2183', tvshows: '2184', emissions: '2182' };

  categoryNames: { [key: string]: string } = { movies: 'Film', tvshows: 'Série', emissions: 'Emission' };

  init(url: string, passkey: string) {
    this.baseUrl = url;
    this.passkey = passkey;
  }

  private async getTop(category: string, defaultData: any): Promise<YggItem[]> {
    let list: string[][] = (defaultData.slice(0, -1) as string[][]);
    if ((defaultData[defaultData.length - 1] as number) > defaultData.length - 1) {
      const response = await fetch(`/ygg/top?url=${encodeURIComponent(`${this.baseUrl}/engine/ajax_top_query/day?sub_category=${this.categories[category]}`)}`);
      const list2: string[][] = await response.json();
      list = list.concat(list2);
    }
    list.sort((a: string[], b: string[]) => parseFloat(b[6]) - parseFloat(a[6]));
    return list.map((item: string[]): YggItem => {
      let match = (/<a href="(.*?)">(.*?)<\/a>/gi).exec(item[1]);
      const detailLink = match ? match[1] : '';
      const name = match ? match[2] : '';
      match = (/.*\/torrent\/.*\/.*\/([0-9]+).*/gi).exec(detailLink);
      const id = match ? match[1] : '';
      const downloadLink = `${this.baseUrl}/rss/download?id=${id}&passkey=${this.passkey}`;
      match = (/<div class="hidden">[0-9]+<\/div>(.*)/gi).exec(item[4]);
      const age = match ? match[1] : '';
      match = (/<div class="hidden">([0-9]+)<\/div>(.*)/gi).exec(item[5]);
      const size = match ? parseFloat(match[1]) : 0;
      const sizeStr = match ? match[2] : '';
      const completed = item[6];
      return {
        id,
        category,
        detailLink,
        downloadLink,
        name,
        age,
        size,
        sizeStr,
        completed,
      };
    });
  }

  public async getTops(): Promise<YggItem[]> {
    const response = await fetch(`/ygg/top?url=${encodeURIComponent(`${this.baseUrl}/engine/ajax_top_query/day`)}`);
    const list: { [key: string]: string[][] } = await response.json();

    const movies = await this.getTop('movies', list[this.categories.movies]);
    const emissions = await this.getTop('emissions', list[this.categories.emissions]);
    const tvshows = await this.getTop('tvshows', list[this.categories.tvshows]);

    return movies.concat(tvshows).concat(emissions);
  }

  private getRank(name: string, seeds: number, sizeStr: string): number {
    if (name.includes('4k') || name.includes('2160p')) return 0;
    if (name.includes('xvid') || name.includes('divx')) return 0;
    if (name.includes('vfq') && !name.includes('vff')) return 0;
    if (seeds < 5) return 0;

    let size: number = parseFloat(sizeStr);
    if (sizeStr.includes('Mo')) size /= 1024;
    if (size > 5) return 0; // too big if more than 5Gb

    let rank = 50 - size;
    if (name.includes('h265') || name.includes('hevc')) rank += 1000;
    else if (name.includes('h264')) rank += 500;

    if (name.includes('hdlight')) rank += 1000;
    else if (name.includes('1080p')) rank += 750;
    else if (name.includes('720p')) rank += 250;
    return rank;
  }

  public async search(query: string, category: string): Promise<YggResult[]> {
    const url = `${this.baseUrl}/engine/search?name=${encodeURIComponent(query)}&description=&file=&uploader=&category=2145&sub_category=${category || 'all'}&do=search&order=desc&sort=seed`;
    const response = await fetch(`/ygg/search?url=${encodeURIComponent(url)}`);
    const results: YggResult[] = await response.json();
    results.forEach((result) => {
      /* eslint-disable no-param-reassign */
      result.downloadUrl += this.passkey;
      result.rank = this.getRank(result.name.toLowerCase(), result.seeds, result.size);
      /* eslint-enable no-param-reassign */
    });
    results.sort((a, b) => b.rank - a.rank);
    return results;
  }

  public async download(url: string): Promise<boolean> {
    try {
      await fetch(`/ygg/download?url=${encodeURIComponent(url)}`);
    } catch (e) {
      return false;
    }
    return true;
  }

  public getCategoryNameById(id: number): string {
    for (const cat in this.categories) {
      if (Object.prototype.hasOwnProperty.call(this.categories, cat) && this.categories[cat] === id.toString()) {
        return this.categoryNames[cat];
      }
    }
    return id.toString();
  }
}

export const yggClient: YggClient = new YggClient();
