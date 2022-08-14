import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import { Config, DbCredit, DbTvshow, DbUser, Episode, Season, UserEpisodeStatus, UserTvshowStatus } from '../../api/src/types';
import { OrderBy, SeenStatus } from '../../api/src/enums';
import { MoreToggle, MultiItem, getEpisodeUserStatus, getTvshowUserStatus, playTvshow, getEpisodeProgress, getEpisodeDuration, renderFileSize, renderVideoInfos, renderAudioInfos, getEpisodeCount, getSeasonCount, selectCurrentSeason } from './common';
import apiClient from './api-client';
import TmdbClient from './tmdb';
import FixTvshowMetadataForm from './fix-tvshow-metadata-form';
import Casting from './casting';

type TvShowDetailsProps = {
  tvshow: DbTvshow;
  config: Config;
  user: DbUser;
  tmdbClient?: TmdbClient;
  onClosed: () => void;
  onChanged: () => void;
  onReplaced: (tvshow: DbTvshow) => void;
};
type TvShowDetailsState = {
  credits: DbCredit[];
  fixingMetadata: boolean;
  tabSeason: number;
  tabKey: string;
};

export default class TvShows extends React.Component<TvShowDetailsProps, TvShowDetailsState> {

  lastOrderBy?: OrderBy;

  constructor(props: TvShowDetailsProps) {
    super(props);
    this.state = {
      credits: [],
      tabSeason: selectCurrentSeason(this.props.tvshow, this.props.user),
      tabKey: "cast",
      fixingMetadata: false,
    };
    apiClient.getCredits().then(credits => this.setState({ credits }));
  }

  getCredit(id: number): DbCredit|null {
    for(const credit of this.state.credits) {
      if (credit.tmdbid == id) {
        return credit;
      }
    }
    return null;
  }

  handleToggleStatus(tvshow: DbTvshow, status: SeenStatus, evt: React.MouseEvent<HTMLElement>): void {
    apiClient.setTvshowStatus(tvshow, this.props.user.name, status).then((userStatus: UserTvshowStatus[]) => {
      tvshow.userStatus = userStatus;
      this.props.onChanged();
    });
    evt.stopPropagation();
    evt.preventDefault();
  }

  handleToggleEpisodeStatus(tvshow: DbTvshow, episode: Episode, status: SeenStatus, evt: React.MouseEvent<HTMLElement>): void {
    apiClient.setEpisodeStatus(tvshow, episode, this.props.user.name, status).then((userStatus: UserEpisodeStatus[]) => {
      episode.userStatus = userStatus;
      this.props.onChanged();
    });
    evt.stopPropagation();
    evt.preventDefault();
  }

  handleSetAudience(tvshow: DbTvshow, audience: number, evt: React.MouseEvent<HTMLElement>): void {
    if (this.props.user.admin) {
      apiClient.setTvshowAudience(tvshow, audience).then((aud: number) => {
        tvshow.audience = aud;
        this.props.onChanged();
      });
    }
    evt.preventDefault();
  }

  handleFixMetadataClick(evt: React.MouseEvent<HTMLElement>): void {
    this.setState({ fixingMetadata: true });
    evt.preventDefault();
  }

  handleFixingMetadataFormClose(tvshow?: DbTvshow): void {
    if (tvshow) {
      this.props.onReplaced(tvshow);
    //   const tvshows = this.state.tvshows.filter(m => m.foldername !== tvshow.foldername)
    //   tvshows.push(tvshow);
    //   this.setState({ tvshows, selection: tvshow });
    }
    this.setState({ fixingMetadata: false });
  }

  renderEpisode(tvshow: DbTvshow, episode: Episode): JSX.Element {
    const userStatus = getEpisodeUserStatus(episode, this.props.user);
    return <div key={episode.filename} className="episode-card d-flex flex-row my-3">
      {episode.stillPath ? 
        <span className="poster">
          <img src={`/images/stills_w300${episode.stillPath}`}/>
            <b onClick={(evt: React.MouseEvent<HTMLElement>) => { evt.stopPropagation(); evt.preventDefault(); playTvshow(this.props.config, this.props.tvshow, episode, this.props.user, this.forceUpdate.bind(this)); }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
            </svg>
          </b>
          {getEpisodeProgress(episode, this.props.user)}
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
              {getEpisodeDuration(episode)} &emsp;
              {renderFileSize(episode.filesize)} &emsp;
            </div>
          </div>
          <div className="actions">
            <OverlayTrigger
              placement="bottom"
              overlay={
                <Tooltip>
                  <span className="file-details">
                    <p>{episode.filename}</p>
                    {episode.video
                      ? <p><span className="dt">Vidéo</span><span className="dd">{renderVideoInfos(episode.video)}</span></p>
                      : null
                    }
                    {episode.audio.length
                      ? <p><span className="dt">Audio</span><span className="dd">{renderAudioInfos(episode.audio)}</span></p>
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
            <a href="#" className="link-light me-3" onClick={(evt: React.MouseEvent<HTMLElement>) => { evt.stopPropagation(); evt.preventDefault(); playTvshow(this.props.config, this.props.tvshow, episode, this.props.user, this.forceUpdate.bind(this)); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + (userStatus?.currentStatus == SeenStatus.seen || (userStatus?.currentStatus != SeenStatus.toSee && userStatus?.seenTs?.length) ? " active" : "") + (userStatus?.currentStatus == SeenStatus.wontSee ? " d-none" : "")}
               onClick={this.handleToggleEpisodeStatus.bind(this, tvshow, episode, userStatus?.currentStatus == SeenStatus.seen ? SeenStatus.toSee : SeenStatus.seen)}
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

  render(): JSX.Element {
    if (! this.props.tvshow) {
      return <div>Série introuvable. <a href="#" onClick={this.props.onClosed}>Retour</a></div>;
    }
    if (this.state.fixingMetadata) {
      return <FixTvshowMetadataForm {...this.props} onClose={this.handleFixingMetadataFormClose.bind(this)}/>;
    }
    const tvshow: DbTvshow = this.props.tvshow;
    let selectedSeason: Season|undefined = tvshow.seasons.filter(s => s.seasonNumber == this.state.tabSeason).shift();
    const seasons = tvshow.seasons.slice(0).sort((a, b) => a.seasonNumber - b.seasonNumber);
    const unknownSeasonEpisodeCount: number = tvshow.episodes.filter(e => e.seasonNumber == -1).length; 
    if (unknownSeasonEpisodeCount > 0) {
      seasons.push({tmdbid: -1, seasonNumber: -1, episodeCount: unknownSeasonEpisodeCount, year: 0, synopsys: "", posterPath: "", cast: [] });
    }
    const userStatus = getTvshowUserStatus(tvshow, this.props.user);
    return <div className="media-details tvshow pt-5" style={{background: 'linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))' + (tvshow.backdropPath ? `, url(/images/backdrops_w1280${tvshow.backdropPath}) 100% 0% / cover no-repeat` : '')}}>
      <div className="position-fixed" style={{ top: "65px", left: "1rem" }}>
        <a href="#" className="link-light" onClick={this.props.onClosed}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
          </svg>
        </a>
      </div>
      <div className="media-poster">
        <span className="poster" style={{ backgroundImage: (selectedSeason?.posterPath || tvshow.posterPath ? `url(/images/posters_w780${selectedSeason?.posterPath || tvshow.posterPath})` : '') }}>
          <b onClick={(evt: React.MouseEvent<HTMLElement>) => { evt.stopPropagation(); evt.preventDefault(); playTvshow(this.props.config, tvshow, undefined, this.props.user, this.forceUpdate.bind(this)); }}>
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
            <div>{getSeasonCount(tvshow)} &emsp; {getEpisodeCount(tvshow)} &emsp; <img src={`/images/classification/${tvshow.audience}.svg`} width="18px"/></div>
          </div>
          <div className="actions">
            <a href="#" className="link-light me-3" onClick={(evt: React.MouseEvent<HTMLElement>) => { evt.stopPropagation(); evt.preventDefault(); playTvshow(this.props.config, tvshow, undefined, this.props.user, this.forceUpdate.bind(this)); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + (userStatus?.currentStatus == SeenStatus.wontSee ? " active" : "")}
               onClick={this.handleToggleStatus.bind(this, tvshow, userStatus?.currentStatus == SeenStatus.wontSee ? SeenStatus.unknown : SeenStatus.wontSee)}
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
                <Dropdown.Item onClick={this.handleFixMetadataClick.bind(this)} disabled={! this.props.user.admin}>Corriger les métadonnées...</Dropdown.Item>
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
              title={<>{title}<span className="d-block fst-italic fs-80pc">{season.episodeCount} épisodes</span></>}
            >
              {tvshow.episodes.filter(e => e.seasonNumber == season.seasonNumber)
                              .sort((a, b) => a.episodeNumbers[0] - b.episodeNumbers[0])
                              .map(episode => this.renderEpisode(tvshow, episode))}
            </Tab>;
          })}
        </Tabs>
        <Tabs id="cast-similar-tabs" activeKey={this.state.tabKey} onSelect={(tabKey) => this.setState({ tabKey: tabKey || "cast" })}>
          <Tab eventKey="cast" title="Casting" tabClassName={selectedSeason?.cast?.length ? "" : "d-none"}>
            <Casting cast={selectedSeason?.cast} />
          </Tab>
          {/*<Tab eventKey="similar" title="Recommandations">
          </Tab>*/}
        </Tabs>
      </div>
    </div>;
  }
}
