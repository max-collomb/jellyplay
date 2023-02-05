import React from 'react';

import { DbMovie, DbTvshow, HomeLists } from '../../api/src/types';
import { ctx } from './common';
import MovieCard from './movie-card';
import TvshowCard from './tvshow-card';

type ListOptions = {
  title: string;
  id: string;
  mixed: boolean;
  scroll: boolean;
};

type HomeProps = {};
type HomeState = {
  lists: HomeLists;
};

export default class Home extends React.Component<HomeProps, HomeState> {
  constructor(props: HomeProps) {
    super(props);
    this.handleEventWillNavigate = this.handleEventWillNavigate.bind(this);
    this.state = {
      lists: { inProgress: [], recentMovies: [], recentTvshows: [] },
    };
    this.refreshContent(/* undefined */);
  }

  componentDidMount() {
    window._exited = this.refreshContent.bind(this);
    ctx.eventBus.on('will-navigate', this.handleEventWillNavigate);
  }

  componentDidUpdate() {
    if (ctx.router.currentRoute?.state?.windowScrollPosition !== undefined) {
      setTimeout(() => {
        // @ts-ignore en attente d'une correction pour https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1195
        window.scrollTo({ left: 0, top: ctx.router.currentRoute?.state?.windowScrollPosition || 0, behavior: 'instant' });
        // @ts-ignore en attente d'une correction pour https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1195
        document.getElementById('recent-movies').scrollTo({ left: ctx.router.currentRoute?.state?.moviesScrollPosition || 0, top: 0, behavior: 'instant' });
        // @ts-ignore en attente d'une correction pour https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1195
        document.getElementById('recent-tvshows').scrollTo({ left: ctx.router.currentRoute?.state?.tvshowsScrollPosition || 0, top: 0, behavior: 'instant' });
        ctx.router.currentRoute.state = {};
      }, 0);
    }
    if (ctx.apiClient.needRefresh('home')) {
      this.refreshContent();
    }
  }

  componentWillUnmount() {
    window._exited = () => {};
    ctx.eventBus.detach('will-navigate', this.handleEventWillNavigate);
  }

  handleEventWillNavigate(): void {
    window.history.replaceState({}, '', `#/home/state/${JSON.stringify({
      windowScrollPosition: window.pageYOffset,
      moviesScrollPosition: document.getElementById('recent-movies')?.scrollLeft || 0,
      tvshowsScrollPosition: document.getElementById('recent-tvshows')?.scrollLeft || 0,
    })}`);
  }

  refreshContent(): void {
    if (ctx.user) {
      ctx.apiClient.getHome(ctx.user.name).then((lists) => this.setState({ lists }));
    }
  }

  isMovie(item: DbMovie | DbTvshow): boolean {
    return !!(item as DbMovie).filename;
  }

  isTvshow(item: DbMovie | DbTvshow): boolean {
    return !!(item as DbTvshow).foldername;
  }

  scroll(direction: number, containerId: string, evt: React.MouseEvent<HTMLElement>): void {
    const container: HTMLElement | null = document.getElementById(containerId);
    if (container) {
      const margin: number = container.querySelector('.media-card:first-child')?.clientWidth || 0;
      container.scrollBy({ left: direction * (container.clientWidth - margin), behavior: 'smooth' });
    }
    evt.preventDefault();
  }

  renderList(list: (DbMovie | DbTvshow)[], options: ListOptions): JSX.Element {
    return (
      <>
        <h4 className="section-title">
          {options.title}
          <span className={options.scroll ? 'd-block float-end' : 'd-none'}>
            <a href="#" className="link-light" onClick={this.scroll.bind(this, -1, options.id)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-chevron-left" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" />
              </svg>
            </a>
            {' '}
            &nbsp;
            <a href="#" className="link-light" onClick={this.scroll.bind(this, 1, options.id)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-chevron-left" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </a>
          </span>
        </h4>

        <div className={`d-flex overflow-auto${options.mixed ? ' mixed-content' : ''}`} id={options.id}>
          {
            list.filter((item) => item.audience <= (ctx.user?.audience || 999))
              .map((item) => {
                if (this.isMovie(item)) {
                  return (
                    <MovieCard
                      key={(item as DbMovie).tmdbid}
                      movie={item as DbMovie}
                      onStatusUpdated={this.refreshContent.bind(this)}
                    />
                  );
                } if (this.isTvshow(item)) {
                  return (
                    <TvshowCard
                      key={(item as DbTvshow).tmdbid}
                      tvshow={item as DbTvshow}
                      showNext={options.mixed}
                    />
                  );
                }
                return <div>Elément inconnu</div>;
              })
          }
        </div>
      </>
    );
  }

  render(): JSX.Element {
    const { lists } = this.state;
    return (
      <>
        <div className={lists.inProgress.length ? '' : 'd-none'}>
          {this.renderList(lists.inProgress, {
            title: 'Reprendre le visionnage', id: 'in-progress', mixed: true, scroll: false,
          })}
        </div>
        <div className={lists.recentMovies.length ? '' : 'd-none'}>
          {this.renderList(lists.recentMovies, {
            title: 'Films, ajouts récents', id: 'recent-movies', mixed: false, scroll: true,
          })}
        </div>
        <div className={lists.recentTvshows.length ? '' : 'd-none'}>
          {this.renderList(lists.recentTvshows, {
            title: 'Séries, ajouts récents', id: 'recent-tvshows', mixed: false, scroll: true,
          })}
        </div>
      </>
    );
  }
}
