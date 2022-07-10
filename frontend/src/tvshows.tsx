import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Dropdown from 'react-bootstrap/Dropdown';

import { AudioInfo, Config, DbCredit, DbTvshow, DbUser, Episode, OrderBy, Season, UserEpisodeStatus, UserTvshowStatus, VideoInfo } from '../../api/src/types';
import { ItemAction, CustomToggleProps, MoreToggle, MultiItem, cleanString } from './common';
import apiClient from './api-client';
import TmdbClient from './tmdb';
// import FixMetadataForm from './fix-metadata-form';
// import RenamingForm from './renaming-form';

type TvShowsProps = {
  config: Config;
  user: DbUser;
  tmdbClient?: TmdbClient;
  orderBy: OrderBy;
  search: string;
};
type TvShowsState = {
  tvshows: DbTvshow[];
  credits: DbCredit[];
  selection?: DbTvshow;
  // fixingMetadata: boolean;
  // renaming: boolean;
  tabKey: string;
};

enum TvshowAction {
  play = "play",
  open = "open",
};


export default class TvShows extends React.Component<TvShowsProps, TvShowsState> {

  lastOrderBy?: OrderBy;

  constructor(props: TvShowsProps) {
    super(props);
    this.state = {
      tvshows: [],
      credits: [],
      tabKey: "cast",
    };
    apiClient.getTvshows().then(tvshows => this.setState({ tvshows }));
    apiClient.getCredits().then(credits => this.setState({ credits }));
  }

  getSeasonCount(tvshow: DbTvshow): string {
    if (tvshow.seasons.length > 0) {
      if (tvshow.seasons.length > 1) {
        return `${tvshow.seasons.length} saisons`;
      } else {
        return "1 saison";
      }
    }
    return "";
  }

  getEpisodeCount(tvshow: DbTvshow): string {
    if (tvshow.episodes.length > 0) {
      if (tvshow.episodes.length > 1) {
        return `${tvshow.episodes.length} épisodes`;
      } else {
        return "1 épisode";
      }
    }
    return "";
  }

  getTvshowUserStatus(tvshow: DbTvshow): UserTvshowStatus|null {
    for (let userStatus of tvshow.userStatus) {
      if (userStatus.userName == this.props.user.name) {
        return userStatus;
        break;
      }
    }
    return null;
  }

  getEpisodeUserStatus(episode: Episode): UserEpisodeStatus|null {
    for (let userStatus of tvshow.userStatus) {
      if (userStatus.userName == this.props.user.name) {
        return userStatus;
        break;
      }
    }
    return null;
  }

  getPosition(episode: Episode): number {
    let userStatus: UserEpisodeStatus|null = this.getEpisodeUserStatus(episode);
    return userStatus?.position || 0;
  }

  handleTvshowClick(tvshow: DbTvshow, action: ItemAction, evt: React.MouseEvent<HTMLElement>): void {
    evt.stopPropagation();
    switch (action) {
      case ItemAction.open:
        this.setState({ selection: tvshow, tabKey: "cast" });
        break;
      case ItemAction.play:
        const userStatus = this.getTvshowUserStatus(tvshow);
        if (userStatus?.currentFilename) {
          const episode = tvshow.episodes.filter(e => e.filename == userStatus.currentFilename).pop();
          if (episode) {
            const path = `${this.props.config.tvshowsRemotePath}/${userStatus.currentFilename}`;
            if (window._mpvSchemeSupported) {
              window._setPosition = apiClient.setEpisodePosition.bind(apiClient, tvshow, episode, this.props.user.name, this.forceUpdate.bind(this));
              document.location.href = `mpv://${path}?pos=${this.getPosition(episode)}`;
            } else {
              navigator.clipboard.writeText(path).then(function() {
                alert(`Le chemin a été copié dans le presse-papier`);
              }, function() {
                alert(`La copie du chemin dans le presse-papier a échoué`);
              });
            }
          }
        }
        break;
    }
  }

  handleToggleStatus(tvshow: DbTvshow, field: string, value: any, evt: React.MouseEvent<HTMLElement>): void {
    apiClient.setTvshowStatus(tvshow, this.props.user.name, field, value).then((userStatus: UserTvshowStatus[]) => {
      // tvshow.userStatus = userStatus;
      this.setState({ tvshows: this.state.tvshows });
    });
    evt.stopPropagation();
    evt.preventDefault();
  }

  renderList(): JSX.Element {
    let tvshows: DbTvshow[] = this.state.tvshows;
    if (this.lastOrderBy != this.props.orderBy) {
      this.lastOrderBy = this.props.orderBy;
      let sortFn: (a: DbTvshow, b: DbTvshow) => number;
      switch(this.props.orderBy) {
        case OrderBy.addedDesc:
          sortFn = (a: DbTvshow, b: DbTvshow) => (b.createdMax < a.createdMax) ? -1 : (b.createdMax > a.createdMax) ? 1 : 0;
          break;
        case OrderBy.addedAsc:
          sortFn = (a: DbTvshow, b: DbTvshow) => (a.createdMin < b.createdMin) ? -1 : (a.createdMin > b.createdMin) ? 1 : 0;
          break;
        case OrderBy.titleAsc:
          sortFn = (a: DbTvshow, b: DbTvshow) => (a.title.toUpperCase() < b.title.toUpperCase()) ? -1 : 1;
          break;
        case OrderBy.titleDesc:
          sortFn = (a: DbTvshow, b: DbTvshow) => (b.title.toUpperCase() < a.title.toUpperCase()) ? -1 : 1;
          break;
        case OrderBy.yearDesc:
          sortFn = (a: DbTvshow, b: DbTvshow) => (b.airDateMax < a.airDateMax) ? -1 : (b.airDateMax > a.airDateMax) ? 1 : 0;
          break;
        case OrderBy.yearAsc:
          sortFn = (a: DbTvshow, b: DbTvshow) => (a.airDateMin < b.airDateMin) ? -1 : (a.airDateMin > b.airDateMin) ? 1 : 0;
          break;
      }
      tvshows.sort(sortFn);
    }
    if (this.props.search) {
      tvshows = tvshows.filter(m => {
        if (! m.searchableContent) {
          m.searchableContent = cleanString(m.title + " " + 
            (m.title == m.originalTitle ? "" : m.originalTitle + " ") +
            m.genres.join(" ") + " " +
            m.countries.join(" ")
          );
        }
        return m.searchableContent.includes(cleanString(this.props.search));
      })
    }
    return <div className="d-flex flex-wrap justify-content-evenly mt-3">{
      tvshows.filter(m => m.audience <= this.props.user.audience)
      .map((tvshow, idx) => {
        const userStatus = this.getTvshowUserStatus(tvshow);
        return <div key={idx} className="media-card tvshow" onClick={this.handleTvshowClick.bind(this, tvshow, ItemAction.open)}>
          <span className="poster">
            <img src={`/images/backdrops_w780${tvshow.backdropPath}`} loading="lazy"/>
            {/*<b onClick={this.handleTvshowClick.bind(this, tvshow, ItemAction.play)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </b>*/}
            <i>
              <em title="Vu"
                  className={/*(! userStatus?.toSee && userStatus?.seen.length ? "active" : "") + */(userStatus?.notInterested /*|| ! userStatus?.seen.length*/ ? " d-none" : "")}
                  onClick={this.handleToggleStatus.bind(this, tvshow, "toSee", ! userStatus?.toSee)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              </em>
              <em title="Pas intéressé"
                  className={(userStatus?.notInterested ? "active" : "") /*+ (userStatus?.seen.length ? " d-none" : "")*/}
                  onClick={this.handleToggleStatus.bind(this, tvshow, "notInterested", ! userStatus?.notInterested)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20" viewBox="0 0 16 16">
                  <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                  <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                  <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                </svg>
              </em>
            </i>
          </span>
          <span className="title">{tvshow.title}</span>
          <span className="infos d-flex justify-content-between">
            <span className="year">{this.getSeasonCount(tvshow)}</span>
            <span className="duration">{this.getEpisodeCount(tvshow)}</span>
          </span>
          {/*this.getProgress(movie)*/}
        </div>;
      })
    }</div>;
  }

  render(): JSX.Element {
    if (this.state.selection) {
      // if (this.state.fixingMetadata) {
      //   return <FixMetadataForm {...this.props} movie={this.state.selection} onClose={this.handleFixingMetadataFormClose.bind(this)}/>;
      // } else  if (this.state.renaming) {
      //   return <RenamingForm {...this.props} movie={this.state.selection} onClose={this.handleRenamingFormClose.bind(this)}/>;
      // } else {
      //   return this.renderDetails();
      // }
      return <div>TODO renderDetails</div>;
    } else {
      return this.renderList();
    }
  }
}
