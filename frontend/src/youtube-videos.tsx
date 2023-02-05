import React from 'react';

import Spinner from 'react-bootstrap/Spinner';

import { ctx, playUrl } from './common';

type YoutubeVideosProps = {
  search: string;
};
type YoutubeVideosState = {
  videos: any[];
  loading: boolean;
};

export default class YoutubeVideos extends React.Component<YoutubeVideosProps, YoutubeVideosState> {
  constructor(props: YoutubeVideosProps) {
    super(props);
    this.state = {
      videos: [],
      loading: false,
    };
  }

  componentDidMount() {
    this.search();
  }

  componentDidUpdate(prevProps: YoutubeVideosProps) {
    const { search } = this.props;
    if (prevProps.search !== search && search !== '') {
      this.search();
    }
  }

  handleClick(url: string, evt: React.MouseEvent): void {
    evt.preventDefault();
    playUrl(url);
  }

  async search() {
    const { search } = this.props;
    if (search?.length) {
      this.setState({ videos: [], loading: true });
      const response = await ctx.youtubeClient.search(search);
      const videos = response.items.map((item: any) => ({
        title: item.snippet.title,
        date: (new Date(item.snippet.publishedAt)).toLocaleDateString(),
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        thumbnail: item.snippet.thumbnails.medium.url,
      }));
      this.setState({
        loading: false,
        videos,
      });
    }
  }

  render(): JSX.Element {
    const { videos, loading } = this.state;
    return (
      <div>
        <div className="d-flex flex-wrap mt-3">
          {
            videos.map((video) => (
              <div key={video.url} className="media-card landscape" onClick={this.handleClick.bind(this, video.url)}>
                <span className="poster" style={{ backgroundImage: `url(${video.thumbnail})` }}>
                  <b>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
                      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                    </svg>
                  </b>
                </span>
                <span className="title" title={video.title}>{video.title}</span>
                <span className="infos d-flex justify-content-between">
                  <span className="year">{video.date}</span>
                </span>
              </div>
            ))
          }
        </div>
        { loading
          ? <div className="text-center"><Spinner animation="border" variant="light" /></div>
          : null }
      </div>
    );
  }
}
