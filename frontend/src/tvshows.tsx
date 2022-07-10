import React from 'react';

import Button from 'react-bootstrap/Button';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

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
  tabSeason: number;
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
      tabSeason: 0,
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

  getDuration(episode: Episode): string {
    if (episode.duration) {
      const minutes = Math.trunc(episode.duration / 60);
      return (minutes >= 60 ? Math.floor(minutes / 60) + 'h' : '') + (minutes % 60).toString().padStart(2, '0') + (minutes >= 60 ? '' : 'm');
    }
    return "";
  }

  getCredit(id: number): DbCredit|null {
    for(const credit of this.state.credits) {
      if (credit.tmdbid == id) {
        return credit;
      }
    }
    return null;
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
    for (let userStatus of episode.userStatus) {
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

  renderFileSize(size: number): string {
    var i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(1) + ' ' + ['o', 'ko', 'Mo', 'Go', 'To'][i];
  }

  renderVideoInfos(video: VideoInfo): JSX.Element {
    return <>{video.width} &times; {video.height} {video.codec}</>;
  }

  renderAudioInfos(audios: AudioInfo[]): JSX.Element {
    return <React.Fragment>{audios.map((audio, idx, all) => <React.Fragment key={idx}>{audio.lang} {audio.ch}ch {audio.codec} {idx < all.length - 1 ? ", " : null}</React.Fragment>)}</React.Fragment>;
  }

  handleTvshowClick(tvshow: DbTvshow, episode: Episode|null, action: ItemAction, evt: React.MouseEvent<HTMLElement>): void {
    evt.stopPropagation();
    switch (action) {
      case ItemAction.open:
        this.setState({
          selection: tvshow,
          tabSeason: tvshow.seasons[0]?.seasonNumber || -1,
          tabKey: "cast"
        });
        break;
      case ItemAction.play:
        if (! episode) {
          // TODO selectionner le bon épisode
          // const userStatus = this.getTvshowUserStatus(tvshow);
          // if (userStatus?.currentFilename) {
          //   episode = tvshow.episodes.filter(e => e.filename == userStatus.currentFilename).pop();
          // }
        }
        if (episode) {
          const path = `${this.props.config.tvshowsRemotePath}/${episode.filename}`;
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

  handleToggleEpisodeStatus(tvshow: DbTvshow, episode: Episode, field: string, value: any, evt: React.MouseEvent<HTMLElement>): void {
    // apiClient.setTvshowStatus(tvshow, this.props.user.name, field, value).then((userStatus: UserTvshowStatus[]) => {
    //   // tvshow.userStatus = userStatus;
    //   this.setState({ tvshows: this.state.tvshows });
    // });
    // evt.stopPropagation();
    // evt.preventDefault();
  }

  handleSetAudience(tvshow: DbTvshow, audience: number, evt: React.MouseEvent<HTMLElement>): void {
    if (this.props.user.admin) {
      apiClient.setTvshowAudience(tvshow, audience).then((aud: number) => {
        tvshow.audience = aud;
        this.setState({ tvshows: this.state.tvshows });
      });
    }
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
        return <div key={idx} className="media-card tvshow" onClick={this.handleTvshowClick.bind(this, tvshow, null, ItemAction.open)}>
          <span className="poster">
            <img src={`/images/backdrops_w780${tvshow.backdropPath}`} loading="lazy"/>
            {/*<b onClick={this.handleTvshowClick.bind(this, tvshow, null, ItemAction.play)}>
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

  handleCloseDetails(evt: React.MouseEvent<HTMLElement>): void {
    this.setState({ selection: undefined });
  }

  renderEpisode(tvshow: DbTvshow, episode: Episode): JSX.Element {
    const userStatus = this.getEpisodeUserStatus(episode);
    return <div key={episode.filename} className="episode-card d-flex flex-row my-3">
      {episode.stillPath ? 
        <span className="poster">
          <img src={`/images/stills_w300${episode.stillPath}`}/>
            <b onClick={this.handleTvshowClick.bind(this, tvshow, episode, ItemAction.play)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </b>
        </span> :
        null
      }
      <div className="flex-grow-1">
        <div className="p-3 episode-title d-flex">
          <div className="flex-grow-1">
            <h5>
              {episode.seasonNumber > 0 ? <>S{episode.seasonNumber.toString().padStart(2, '0')}</> : null}
              {episode.episodeNumbers?.length ? <>E{episode.episodeNumbers.map(n => n.toString().padStart(2, '0')).join('/')}&nbsp;&ndash;&nbsp;</> : null}
              {episode.title || episode.filename}
            </h5>
            <div>
              {episode.airDate ? <span>{(new Date(episode.airDate)).toLocaleString().substr(0,10)} &emsp;</span> : null}
              {this.getDuration(episode)} &emsp;
              {this.renderFileSize(episode.filesize)} &emsp;
            </div>
          </div>
          <div className="actions">
            <OverlayTrigger
              placement="bottom"
              overlay={
                <Tooltip>
                  <span className="file-details">
                    {episode.video
                      ? <p><span className="dt">Vidéo</span><span className="dd">{this.renderVideoInfos(episode.video)}</span></p>
                      : null
                    }
                    {episode.audio.length
                      ? <p><span className="dt">Audio</span><span className="dd">{this.renderAudioInfos(episode.audio)}</span></p>
                      : null
                    }
                    {episode.subtitles.length
                      ? <p><span className="dt">Sous-titres</span><span className="dd">{episode.subtitles.join(', ')}</span></p>
                      : null
                    }
                  </span>
                </Tooltip>
              }
            >
              <a href="#" className={"link-light me-3"} onClick={(e) => e.preventDefault()}>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-info" viewBox="0 0 16 16">
  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
</svg>
              </a>
            </OverlayTrigger>
            <a href="#" className="link-light me-3" onClick={this.handleTvshowClick.bind(this, tvshow, episode, ItemAction.play)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + /*(! userStatus?.toSee && userStatus?.seen.length ? " active" : "") + */(userStatus?.notInterested /*|| ! userStatus?.seen.length*/ ? " d-none" : "")}
               onClick={this.handleToggleEpisodeStatus.bind(this, tvshow, episode, "seen", Date.now())}
               title="Vu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
              </svg>
            </a>
          </div>
        </div>
        <p className="m-3">{episode.synopsys}</p>
      </div>
    </div>;
  }

  renderDetails(): JSX.Element {
    if (! this.state.selection) {
      return <div>Série introuvable. <a href="#" onClick={this.handleCloseDetails.bind(this)}>Retour</a></div>;
    }
    const tvshow: DbTvshow = this.state.selection;
    let selectedSeason: Season|undefined = tvshow.seasons.filter(s => s.seasonNumber == this.state.tabSeason).shift();
    const seasons = tvshow.seasons.slice(0);
    const unknownSeasonEpisodeCount: number = tvshow.episodes.filter(e => e.seasonNumber == -1).length; 
    if (unknownSeasonEpisodeCount > 0) {
      seasons.push({tmdbid: -1, seasonNumber: -1, episodeCount: unknownSeasonEpisodeCount, year: 0, synopsys: "", posterPath: "", cast: [] });
    }
    const userStatus = this.getTvshowUserStatus(tvshow);
    return <div className="media-details tvshow" style={{background: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6)), url(/images/backdrops_w1280${tvshow.backdropPath}) 100% 0% / cover no-repeat`}}>
      <div style={{ margin: "1em" }}>
        <a href="#" className="link-light" onClick={this.handleCloseDetails.bind(this)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
          </svg>
        </a>
      </div>
      <div className="media-poster">
        <span className="poster" style={{ backgroundImage: `url(/images/posters_w780${selectedSeason?.posterPath || tvshow.posterPath})` }}>
          <b onClick={this.handleTvshowClick.bind(this, tvshow, null, ItemAction.play)}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
            </svg>
          </b>
          {/*this.getProgress(movie)*/}
        </span>
      </div>
      <div className="title-bar">
        <div className="d-flex align-items-center">
          <div className="flex-grow-1">
            <h2>{tvshow.title}</h2>
            {tvshow.originalTitle && tvshow.originalTitle != tvshow.title ? <h6>{tvshow.originalTitle}</h6> : null}
            <div>{this.getSeasonCount(tvshow)} &emsp; {this.getEpisodeCount(tvshow)} &emsp; <img src={`/images/classification/${tvshow.audience}.svg`} width="18px"/></div>
          </div>
          <div className="actions">
            <a href="#" className="link-light me-3" onClick={this.handleTvshowClick.bind(this, tvshow, null, ItemAction.play)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + /*(! userStatus?.toSee /&& userStatus?.seen.length ? " active" : "") +*/ (userStatus?.notInterested /*|| ! userStatus?.seen.length*/ ? " d-none" : "")}
               onClick={this.handleToggleStatus.bind(this, tvshow, "toSee", ! userStatus?.toSee)}
               title="Vu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + (userStatus?.notInterested ? " active" : "") /*+ (userStatus?.seen.length ? " d-none" : "")*/}
               onClick={this.handleToggleStatus.bind(this, tvshow, "notInterested", ! userStatus?.notInterested)}
               title="Pas intéressé"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                  <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                  <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
              </svg>
            </a>
            <Dropdown className="d-inline-block">
              <Dropdown.Toggle as={MoreToggle}/>
              <Dropdown.Menu align="end">
                <Dropdown.Header>Audience</Dropdown.Header>
                <Dropdown.Item as={MultiItem}>
                  { [0,10,12,16,18,999].map(a => <a key={a} className={"audience-link p-2" + (this.props.user.admin ? "" : " disabled")} onClick={this.handleSetAudience.bind(this, tvshow, a)}><img src={`/images/classification/${a}.svg`} width="20"/></a>) }
                </Dropdown.Item>
                <Dropdown.Divider/>
                {/*<Dropdown.Item onClick={this.handleFixMetadataClick.bind(this)} disabled={! this.props.user.admin}>Corriger les métadonnées...</Dropdown.Item>*/}
                {/*<Dropdown.Item onClick={this.handleRenameClick.bind(this)} disabled={! this.props.user.admin}>Renommer le fichier...</Dropdown.Item>*/}
                {/*<Dropdown.Item onClick={this.handleDeleteClick.bind(this)} disabled={! this.props.user.admin}>Supprimer</Dropdown.Item>*/}
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>
      </div>
      <div className="content-bar">
        <p><span className="dt">Genre</span><span className="dd">{tvshow.genres.join(', ')}</span></p>
        <div className="d-flex align-items-start mb-2">
          <p className="synopsis">{selectedSeason?.synopsys || tvshow.synopsys}</p>
        </div>
        <Tabs id="season-tabs" activeKey={this.state.tabSeason} onSelect={(tabSeason) => this.setState({ tabSeason: parseFloat(tabSeason || "0") })} className="constrained-width">
          {seasons.map((season, idx) => {
            let title = `Saison ${season.seasonNumber > 0 ? season.seasonNumber.toString().padStart(2, '0') : 'inconnue'}`;
            if (season.year) title += ` (${season.year})`;
            return <Tab
              eventKey={season.seasonNumber}
              key={idx}
              tabClassName="position-relative"
              className="flex-grow-1"
              title={<>{title}<span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-secondary">{season.episodeCount} <span className="visually-hidden">épisodes</span></span></>}
            >
              {tvshow.episodes.filter(e => e.seasonNumber == season.seasonNumber).map(episode => this.renderEpisode(tvshow, episode))}
            </Tab>;
          })}
        </Tabs>
        <Tabs id="cast-similar-tabs" activeKey={this.state.tabKey} onSelect={(tabKey) => this.setState({ tabKey: tabKey || "cast" })}>
          <Tab eventKey="cast" title="Casting" tabClassName={selectedSeason?.cast?.length ? "" : "d-none"}>
            <div className="d-flex flex-wrap mt-3">{
              selectedSeason?.cast.map((role, idx) => {
                const credit = this.getCredit(role.tmdbid);
                return credit ? <div key={idx} className="cast-card">
                  {credit.profilePath
                    ? <img src={`/images/profiles_w185${credit.profilePath}`}/>
                    : <span className="no-profile-picture"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                      <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
                    </svg></span>}
                  <span className="actor">{credit.name}</span>
                  <span className={"character"}>{(role.character ? "en tant que " + role.character: "-")}</span>
                </div> : null;
              })
            }</div>
          </Tab>
          {/*<Tab eventKey="similar" title="Recommandations">
          </Tab>*/}
        </Tabs>
      </div>
    </div>;
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
      return this.renderDetails();
    } else {
      return this.renderList();
    }
  }
}
