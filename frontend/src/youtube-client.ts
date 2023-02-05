export class YoutubeClient {
  apiKey: string = '';

  baseUrl: string = 'https://youtube.googleapis.com/youtube/v3/';

  init(key: string) {
    this.apiKey = key;
  }

  public async search(title: string): Promise<any> {
    const query = `${title} bande annonce`;
    const response = await fetch(`${this.baseUrl}search?key=${this.apiKey}&part=snippet&regionCode=fr&type=video&maxResults=25&q=${encodeURIComponent(query)}`);
    return response.json();
  }
}

export const youtubeClient: YoutubeClient = new YoutubeClient();
