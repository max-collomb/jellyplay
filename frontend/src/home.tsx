import React from 'react';

import { Config, DbMovie, DbTvshow, DbUser, Episode, HomeLists, Season, UserEpisodeStatus, UserTvshowStatus, VideoInfo } from '../../api/src/types';
import { OrderBy, SeenStatus } from '../../api/src/enums';
import apiClient from './api-client';
import MovieCard from './movie-card';
import MovieDetails from './movie-details';
import TvshowCard from './tvshow-card';
import TvshowDetails from './tvshow-details';
import TmdbClient from './tmdb';

type ListOptions = {
  title: string;
  id: string;
  mixed: boolean;
  scroll: boolean;
};

type HomeProps = {
  config: Config;
  user: DbUser;
  tmdbClient?: TmdbClient;
  orderBy: OrderBy;
  search: string;
};
type HomeState = {
  lists: HomeLists;
  selection?: DbMovie|DbTvshow;
};

export default class Home extends React.Component<HomeProps, HomeState> {

  constructor(props: HomeProps) {
    super(props);
    this.state = {
      lists: { inProgress: [], recentMovies: [], recentTvshows: [] },
    };
    this.refreshContent(undefined);
  }

  refreshContent(selection: DbMovie|DbTvshow|undefined): void {
    apiClient.getHome(this.props.user.name).then(lists => this.setState({ lists, selection }));
  }

  isMovie(item: DbMovie|DbTvshow): boolean {
    return !! (item as DbMovie).filename;
  }

  isTvshow(item: DbMovie|DbTvshow): boolean {
    return !! (item as DbTvshow).foldername;
  }

  scroll(direction: number, containerId: string, evt: React.MouseEvent<HTMLElement>): void {
    const container: HTMLElement|null = document.getElementById(containerId);
    if (container) {
      const margin: number = container.querySelector(".media-card:first-child")?.clientWidth || 0;
      container.scrollBy({ left: direction * (container.clientWidth - margin), behavior: "smooth" });
    }
  }

  renderList(list: (DbMovie|DbTvshow)[], options: ListOptions): JSX.Element {
    return <>
      <h4 className="section-title p-2 mt-3">
        {options.title}
        <span className={options.scroll ? "d-block float-end" : "d-none"}>
          <a href="#" className="link-light" onClick={this.scroll.bind(this, -1, options.id)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-chevron-left" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
            </svg>
          </a> &nbsp; 
          <a href="#" className="link-light" onClick={this.scroll.bind(this, 1, options.id)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-chevron-left" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </a>
        </span>
      </h4>

      <div className={"d-flex mt-3 overflow-auto" + (options.mixed ? " mixed-content" : "")} id={options.id}>{
        list.filter(item => item.audience <= this.props.user.audience)
            .map((item, idx) => {
              if (this.isMovie(item)) {
                return <MovieCard key={idx}
                                  movie={item as DbMovie}
                                  config={this.props.config}
                                  user={this.props.user}
                                  onChanged={this.forceUpdate.bind(this)}
                                  onSelected={(movie: DbMovie) => this.setState({ selection: movie })}/>;
              } else if (this.isTvshow(item)) {
                return <TvshowCard  key={idx}
                                    tvshow={item as DbTvshow}
                                    config={this.props.config}
                                    user={this.props.user}
                                    onChanged={this.forceUpdate.bind(this)}
                                    onSelected={(tvshow: DbTvshow) => this.setState({ selection: tvshow })}/>;
              } else {
                return <div key={idx}>Elément inconnu</div>;
              }
            })
        }
      </div>
    </>
  }

  render(): JSX.Element {
    if (this.state.selection) {
      if (this.isMovie(this.state.selection)) {
        return <MovieDetails  {...this.props}
                              movie={this.state.selection as DbMovie}
                              onClosed={() => this.setState({ selection: undefined })}
                              onChanged={this.forceUpdate.bind(this)}
                              onReplaced={this.refreshContent.bind(this)}
                              onDeleted={this.refreshContent.bind(this)}/>;
      } else if (this.isTvshow(this.state.selection)) {
        return <TvshowDetails {...this.props}
                              tvshow={this.state.selection as DbTvshow}
                              onClosed={() => this.setState({ selection: undefined })}
                              onChanged={this.forceUpdate.bind(this)}
                              onReplaced={this.refreshContent.bind(this)}/>;
      }
    }
    return <>
      <div className={this.state.lists.inProgress.length ? "" : "d-none"}>
        {this.renderList(this.state.lists.inProgress, { title: "Reprendre le visionnage", id: "in-progress", mixed: true, scroll: false })}
        <hr/>
      </div>
      <div className={this.state.lists.recentMovies.length ? "" : "d-none"}>
        {this.renderList(this.state.lists.recentMovies, { title: "Films, ajouts récents", id: "recent-movies", mixed: false, scroll: true })}
        <hr/>
      </div>
      <div className={this.state.lists.recentTvshows.length ? "" : "d-none"}>
        {this.renderList(this.state.lists.recentTvshows, { title: "Séries, ajouts récents", id: "recent-tvshows", mixed: false, scroll: true })}
      </div>
    </>;
  }
}
