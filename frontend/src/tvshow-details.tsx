import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import {
  DbTvshow, Episode, Season, UserEpisodeStatus, UserTvshowStatus,
} from '../../api/src/types';
import { SeenStatus } from '../../api/src/enums';

import {
  ctx, MoreToggle, MultiItem, getEpisodeByFilename, getEpisodeUserStatus, getTvshowUserStatus, playTvshow, getEpisodeProgress, getEpisodeDuration, renderFileSize, renderVideoInfos, renderAudioInfos, getEpisodeCount, getSeasonCount, selectCurrentSeason,
} from './common';
import FixTvshowMetadataForm from './fix-tvshow-metadata-form';
import Casting from './casting';

type TvShowDetailsProps = {
  tvshowId: number;
};
type TvShowDetailsState = {
  tvshow: DbTvshow;
  fixingMetadata: boolean;
  tabSeason: number;
  tabKey: string;
  currentStatus: SeenStatus;
  percentPos: number;
};

export default class TvShows extends React.Component<TvShowDetailsProps, TvShowDetailsState> {
  // lastOrderBy?: OrderBy;

  constructor(props: TvShowDetailsProps) {
    super(props);
    const { tvshowId } = this.props;
    this.handleEventEpisodePositionChanged = this.handleEventEpisodePositionChanged.bind(this);
    this.state = {
      tvshow: {
        foldername: '', isSaga: false, tmdbid: 0, title: '', originalTitle: '', countries: [], synopsys: '', genres: [], audience: 0, backdropPath: '', posterPath: '', seasons: [], episodes: [], userStatus: [], createdMin: 0, createdMax: 0, airDateMin: '', airDateMax: '', searchableContent: '',
      },
      tabSeason: -1,
      tabKey: 'cast',
      fixingMetadata: false,
      currentStatus: SeenStatus.unknown,
      percentPos: 0,
    };
    ctx.apiClient.getTvshows().then((tvshows) => {
      const fetchedTvshow: DbTvshow | undefined = tvshows.find((t) => t.tmdbid === tvshowId);
      if (fetchedTvshow) {
        this.setState({ tvshow: fetchedTvshow, tabSeason: selectCurrentSeason(fetchedTvshow) });
      } else {
        const { tvshow } = this.state;
        this.setState({ tvshow: { ...tvshow, tmdbid: -1 } });
      }
    });
  }

  componentDidMount() {
    ctx.eventBus.on('episode-position-changed', this.handleEventEpisodePositionChanged);
  }

  componentWillUnmount() {
    ctx.eventBus.detach('episode-position-changed', this.handleEventEpisodePositionChanged);
  }

  handleEventEpisodePositionChanged(evt: any): void {
    const { tvshow, percentPos, currentStatus } = this.state;
    if (evt.foldername === tvshow.foldername) {
      const episode: Episode | null = getEpisodeByFilename(tvshow, evt.filename);
      if (episode) {
        episode.userStatus = evt.userStatus;
        const us: UserEpisodeStatus | null = getEpisodeUserStatus(episode);
        const newPercentPos = (us && episode.duration) ? Math.floor(100 * (us.position / episode.duration)) : 0;
        const newStatus = us ? us.currentStatus : SeenStatus.unknown;
        if (newPercentPos !== percentPos || newStatus !== currentStatus) {
          this.setState({ percentPos: newPercentPos, currentStatus: newStatus });
        }
      }
    }
  }

  handleToggleStatus(status: SeenStatus, evt: React.MouseEvent<HTMLElement>): void {
    evt.stopPropagation();
    evt.preventDefault();
    const { tvshow } = this.state;
    ctx.apiClient.setTvshowStatus(tvshow, ctx.user?.name, status).then((userStatus: UserTvshowStatus[]) => {
      tvshow.userStatus = userStatus;
      this.setState({ tvshow });
    });
  }

  handleToggleEpisodeStatus(episode: Episode, status: SeenStatus, evt: React.MouseEvent<HTMLElement>): void {
    evt.stopPropagation();
    evt.preventDefault();
    const { tvshow } = this.state;
    ctx.apiClient.setEpisodeStatus(tvshow, episode, ctx.user?.name, status).then((userStatus: UserEpisodeStatus[]) => {
      // eslint-disable-next-line no-param-reassign
      episode.userStatus = userStatus;
      this.setState({ tvshow });
    });
  }

  handleSetAudience(audience: number, evt: React.MouseEvent<HTMLElement>): void {
    evt.preventDefault();
    const { tvshow } = this.state;
    if (ctx.user?.admin) {
      ctx.apiClient.setTvshowAudience(tvshow, audience).then((aud: number) => {
        tvshow.audience = aud;
        this.setState({ tvshow });
      });
    }
  }

  handleFixMetadataClick(evt: React.MouseEvent<HTMLElement>): void {
    evt.preventDefault();
    this.setState({ fixingMetadata: true });
  }

  handleFixingMetadataFormClose(tvshow?: DbTvshow): void {
    if (tvshow) {
      this.setState({ tvshow });
    }
    this.setState({ fixingMetadata: false });
  }

  handlePlayTvshow(episode: Episode | undefined, evt: React.MouseEvent<HTMLElement>): void {
    const { tvshow } = this.state;
    const episode2: Episode | undefined = playTvshow(tvshow, episode);
    if (episode2) {
      const us: UserEpisodeStatus | null = getEpisodeUserStatus(episode2);
      this.setState({
        currentStatus: us ? us.currentStatus : SeenStatus.unknown,
        percentPos: (us && episode2.duration) ? Math.floor(100 * (us.position / episode2.duration)) : 0,
      });
    }
    evt.stopPropagation();
    evt.preventDefault();
  }

  // handlePlayCallback(episode: Episode | undefined): void {
  //   if (episode) {
  //     const us: UserEpisodeStatus | null = getEpisodeUserStatus(episode);
  //     const percentPos = (us && episode.duration) ? Math.floor(100 * us.position / episode.duration) : 0;
  //     const currentStatus = us ? us.currentStatus : SeenStatus.unknown;
  //     if (percentPos != this.state.percentPos || currentStatus != this.state.currentStatus) {
  //       this.setState({ tvshow: this.state.tvshow });
  //       this.setState({ percentPos, currentStatus });
  //     }
  //   }
  // }

  handleToggleAllStatus(season: number | undefined, status: SeenStatus): void {
    const { tvshow } = this.state;
    for (const episode of tvshow.episodes) {
      if (season === undefined || episode.seasonNumber === season) {
        ctx.apiClient.setEpisodeStatus(tvshow, episode, ctx.user?.name, status).then((userStatus: UserEpisodeStatus[]) => {
          episode.userStatus = userStatus;
          this.setState({ tvshow });
        });
      }
    }
  }

  renderEpisode(tvshow: DbTvshow, episode: Episode): JSX.Element {
    const userStatus = getEpisodeUserStatus(episode);
    return (
      <div key={episode.filename} className={`episode-card d-flex flex-row my-3${tvshow.isSaga ? ' saga-episode-card' : ''}`}>
        {episode.stillPath
          ? (
            <span className="poster">
              <img src={`/images/stills_w300${episode.stillPath}`} alt="still" />
              <b onClick={this.handlePlayTvshow.bind(this, episode)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
                  <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                </svg>
              </b>
              {getEpisodeProgress(episode)}
            </span>
          )
          : null}
        <div className="flex-grow-1">
          <div className="p-3 episode-title d-flex">
            <div className="flex-grow-1">
              <h5>
                {episode.seasonNumber > 0 ? (
                  <>
                    S
                    {episode.seasonNumber.toString().padStart(2, '0')}
                  </>
                ) : null}
                {episode.episodeNumbers?.length ? (
                  <>
                    E
                    {episode.episodeNumbers.map((n) => n.toString().padStart(2, '0')).join('/')}
                    &nbsp;&ndash;&nbsp;
                  </>
                ) : null}
                {episode.title || episode.filename}
              </h5>
              <div>
                {episode.airDate ? (
                  <span>
                    {(new Date(episode.airDate)).toLocaleString().substr(0, 10)}
                    &emsp;
                  </span>
                ) : null}
                {getEpisodeDuration(episode)}
                &emsp;
                {renderFileSize(episode.filesize)}
                &emsp;
              </div>
            </div>
            <div className="actions">
              <OverlayTrigger
                placement="bottom"
                overlay={(
                  <Tooltip>
                    <span className="file-details">
                      <p>{episode.filename}</p>
                      {episode.video
                        ? (
                          <p>
                            <span className="dt">Vidéo</span>
                            <span className="dd">{renderVideoInfos(episode.video)}</span>
                          </p>
                        )
                        : null}
                      {episode.audio.length
                        ? (
                          <p>
                            <span className="dt">Audio</span>
                            <span className="dd">{renderAudioInfos(episode.audio)}</span>
                          </p>
                        )
                        : null}
                      {episode.subtitles.length
                        ? (
                          <p>
                            <span className="dt">Sous-titres</span>
                            <span className="dd">{episode.subtitles.join(', ')}</span>
                          </p>
                        )
                        : null}
                    </span>
                  </Tooltip>
              )}
              >
                <a href="#" className="link-light me-3" onClick={(e) => e.preventDefault()}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-info" viewBox="0 0 16 16">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                  </svg>
                </a>
              </OverlayTrigger>
              <a href="#" className="link-light me-3" onClick={this.handlePlayTvshow.bind(this, episode)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                </svg>
              </a>
              <a
                href="#"
                className={`link-light me-3${userStatus?.currentStatus === SeenStatus.seen || (userStatus?.currentStatus !== SeenStatus.toSee && userStatus?.seenTs?.length) ? ' active' : ''}${userStatus?.currentStatus === SeenStatus.wontSee ? ' d-none' : ''}`}
                onClick={this.handleToggleEpisodeStatus.bind(this, episode, userStatus?.currentStatus === SeenStatus.seen ? SeenStatus.toSee : SeenStatus.seen)}
                title="Vu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
              </a>
            </div>
          </div>
          <p className="m-3">{episode.synopsys}</p>
        </div>
      </div>
    );
  }

  render(): JSX.Element {
    const {
      tvshow, fixingMetadata, tabSeason, tabKey,
    } = this.state;
    if (tvshow.tmdbid === -1) {
      return (
        <div>
          Série introuvable.
          {' '}
          <a href="#" onClick={(evt) => { evt.preventDefault(); window.history.back(); }}>Retour</a>
        </div>
      );
    }
    if (fixingMetadata) {
      return <FixTvshowMetadataForm tvshow={tvshow} onClose={this.handleFixingMetadataFormClose.bind(this)} />;
    }
    const selectedSeason: Season | undefined = tvshow.seasons.filter((s) => s.seasonNumber === tabSeason).shift();
    const seasons = tvshow.seasons.slice(0).sort((a, b) => a.seasonNumber - b.seasonNumber);
    const unknownSeasonEpisodeCount: number = tvshow.episodes.filter((e) => e.seasonNumber === -1).length;
    if (unknownSeasonEpisodeCount > 0) {
      seasons.push({
        tmdbid: -1, seasonNumber: -1, episodeCount: unknownSeasonEpisodeCount, year: 0, synopsys: '', posterPath: '', cast: [],
      });
    }
    const userStatus = getTvshowUserStatus(tvshow);
    return (
      <div className="media-details tvshow" style={{ background: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))${tvshow.backdropPath ? `, url(/images/backdrops_w1280${tvshow.backdropPath}) 100% 0% / cover no-repeat` : ''}` }}>
        <div className="position-fixed" style={{ top: '65px', left: '1rem' }}>
          <a href="#" className="link-light" onClick={(evt) => { evt.preventDefault(); window.history.back(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
            </svg>
          </a>
        </div>
        <div className="media-poster">
          <span className="poster" style={{ backgroundImage: (selectedSeason?.posterPath || tvshow.posterPath ? `url(/images/posters_w780${selectedSeason?.posterPath || tvshow.posterPath})` : '') }}>
            <b onClick={this.handlePlayTvshow.bind(this, undefined)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
              </svg>
            </b>
          </span>
        </div>
        <div className="title-bar">
          <div className="d-flex align-items-center">
            <div className="flex-grow-1">
              <h2>{tvshow.title}</h2>
              {tvshow.originalTitle && tvshow.originalTitle !== tvshow.title ? <h6>{tvshow.originalTitle}</h6> : null}
              <div>
                {getSeasonCount(tvshow)}
                &emsp;
                {getEpisodeCount(tvshow)}
                &emsp;
                <img src={`/images/classification/${tvshow.audience}.svg`} alt={`-${tvshow.audience}`} width="18px" />
              </div>
            </div>
            <div className="actions">
              <a href="#" className="link-light me-3" onClick={this.handlePlayTvshow.bind(this, undefined)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                </svg>
              </a>
              <a
                href="#"
                className={`link-light me-3${userStatus?.currentStatus === SeenStatus.wontSee ? ' active' : ''}`}
                onClick={this.handleToggleStatus.bind(this, userStatus?.currentStatus === SeenStatus.wontSee ? SeenStatus.unknown : SeenStatus.wontSee)}
                title="Pas intéressé"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                  <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z" />
                  <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z" />
                </svg>
              </a>
              <a
                href="#"
                className={`link-light me-3${userStatus?.currentStatus === SeenStatus.toSee ? ' active' : ''}`}
                onClick={this.handleToggleStatus.bind(this, userStatus?.currentStatus === SeenStatus.toSee ? SeenStatus.unknown : SeenStatus.toSee)}
                title="A voir"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-pin-angle" viewBox="0 0 16 16">
                  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146zm.122 2.112v-.002.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.878a.5.5 0 0 1-.511.12H5.78l-.014-.004a4.507 4.507 0 0 0-.288-.076 4.922 4.922 0 0 0-.765-.116c-.422-.028-.836.008-1.175.15l5.51 5.509c.141-.34.177-.753.149-1.175a4.924 4.924 0 0 0-.192-1.054l-.004-.013v-.001a.5.5 0 0 1 .12-.512l3.536-3.535a.5.5 0 0 1 .532-.115l.096.022c.087.017.208.034.344.034.114 0 .23-.011.343-.04L9.927 2.028c-.029.113-.04.23-.04.343a1.779 1.779 0 0 0 .062.46z" />
                </svg>
              </a>
              <Dropdown className="d-inline-block">
                <Dropdown.Toggle as={MoreToggle} />
                <Dropdown.Menu align="end">
                  <Dropdown.Header>Audience</Dropdown.Header>
                  <Dropdown.Item as={MultiItem}>
                    { [0, 10, 12, 16, 18, 999].map((a) => <a key={a} className={`audience-link p-2${ctx.user?.admin ? '' : ' disabled'}`} onClick={this.handleSetAudience.bind(this, a)}><img src={`/images/classification/${a}.svg`} alt={`-${a}`} width="20" /></a>) }
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={this.handleFixMetadataClick.bind(this)} disabled={!ctx.user?.admin}>Corriger les métadonnées...</Dropdown.Item>
                  <Dropdown.Item onClick={this.handleToggleAllStatus.bind(this, undefined, SeenStatus.seen)}>Tout marquer comme vu</Dropdown.Item>
                  <Dropdown.Item onClick={this.handleToggleAllStatus.bind(this, undefined, SeenStatus.toSee)}>Tout marquer comme non vu</Dropdown.Item>
                  <Dropdown.Item onClick={this.handleToggleAllStatus.bind(this, tabSeason, SeenStatus.seen)}>Marquer la saison comme vue</Dropdown.Item>
                  <Dropdown.Item onClick={this.handleToggleAllStatus.bind(this, tabSeason, SeenStatus.toSee)}>Marquer la saison comme non vue</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
        </div>
        <div className="content-bar">
          <p>
            <span className="dt">Genre</span>
            <span className="dd">{tvshow.genres.join(', ')}</span>
          </p>
          <div className="d-flex align-items-start mb-2">
            <p className="synopsis">{selectedSeason?.synopsys || tvshow.synopsys}</p>
          </div>
          <Tabs id="season-tabs" activeKey={tabSeason} onSelect={(tab) => this.setState({ tabSeason: parseFloat(tab || '0') })} className="constrained-width">
            {seasons.map((season) => {
              let title = `Saison ${season.seasonNumber > 0 ? season.seasonNumber.toString().padStart(2, '0') : 'inconnue'}`;
              if (season.year) title += ` (${season.year})`;
              return (
                <Tab
                  eventKey={season.seasonNumber}
                  key={season.seasonNumber}
                  tabClassName="position-relative"
                  className="flex-grow-1"
                  title={(
                    <>
                      {title}
                      <span className="d-block fst-italic fs-80pc">
                        {season.episodeCount}
                        épisodes
                      </span>
                    </>
                  )}
                >
                  {tvshow.episodes.filter((e) => e.seasonNumber === season.seasonNumber)
                    .sort((a, b) => a.episodeNumbers[0] - b.episodeNumbers[0])
                    .map((episode) => this.renderEpisode(tvshow, episode))}
                </Tab>
              );
            })}
          </Tabs>
          <Tabs id="cast-similar-tabs" activeKey={tabKey} onSelect={(tab) => this.setState({ tabKey: tab || 'cast' })}>
            <Tab eventKey="cast" title="Casting" tabClassName={selectedSeason?.cast?.length ? '' : 'd-none'}>
              <Casting cast={selectedSeason?.cast} />
            </Tab>
            {/* <Tab eventKey="similar" title="Recommandations">
          </Tab> */}
          </Tabs>
        </div>
      </div>
    );
  }
}
