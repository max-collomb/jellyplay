import React from 'react';

import { Config, DbTvshow, DbUser, Episode, UserEpisodeStatus, UserTvshowStatus } from '../../api/src/types';
import { SeenStatus } from '../../api/src/enums';
import { getEpisodeCount, getEpisodeProgress, getEpisodeUserStatus, getSeasonCount, getTvshowUserStatus, playTvshow, selectCurrentEpisode } from './common';
import apiClient from './api-client';

type TvShowCardProps = {
  tvshow: DbTvshow
  config: Config;
  user: DbUser;
  showNext: boolean;
  onChanged: () => void;
  onSelected: (tvshow: DbTvshow) => void;
};
type TvShowCardState = {
  currentStatus: SeenStatus;
  percentPos: number;
};

export default class TvShows extends React.Component<TvShowCardProps, TvShowCardState> {

  constructor(props: TvShowCardProps) {
    super(props);
    this.state = {
      currentStatus: SeenStatus.unknown,
      percentPos: 0,
    };
  }

  handleToggleStatus(tvshow: DbTvshow, status: SeenStatus, evt: React.MouseEvent<HTMLElement>): void {
    apiClient.setTvshowStatus(tvshow, this.props.user.name, status).then((userStatus: UserTvshowStatus[]) => {
      tvshow.userStatus = userStatus;
      this.props.onChanged();
    });
    evt.stopPropagation();
    evt.preventDefault();
  }

  handleClick(evt: React.MouseEvent<HTMLElement>): void {
    this.props.onSelected(this.props.tvshow);
    evt.stopPropagation();
    evt.preventDefault();
  }

  handlePlayTvshow(evt: React.MouseEvent<HTMLElement>): void {
    const episode: Episode|undefined = playTvshow(this.props.config, this.props.tvshow, undefined, this.props.user, this.handlePlayCallback.bind(this));
    if (episode) {
      const us: UserEpisodeStatus|null = getEpisodeUserStatus(episode, this.props.user);
      this.setState({
        currentStatus: us ? us.currentStatus : SeenStatus.unknown,
        percentPos: (us && episode.duration) ? Math.floor(100 * us.position / episode.duration) : 0,
      });
    }
    evt.stopPropagation();
    evt.preventDefault();
  }

  handlePlayCallback(episode: Episode|undefined): void {
    if (episode) {
      const us: UserEpisodeStatus|null = getEpisodeUserStatus(episode, this.props.user);
      const percentPos = (us && episode.duration) ? Math.floor(100 * us.position / episode.duration) : 0;
      const currentStatus = us ? us.currentStatus : SeenStatus.unknown;
      if (percentPos != this.state.percentPos || currentStatus != this.state.currentStatus) {
        this.props.onChanged();
        this.setState({ percentPos, currentStatus });
      }
    }
  }

  render(): JSX.Element {
    const userStatus = getTvshowUserStatus(this.props.tvshow, this.props.user);
    const infos = [];
    let progress: JSX.Element|null = null;
    if (this.props.showNext) {
      const episode: Episode|undefined = selectCurrentEpisode(this.props.tvshow, this.props.user);
      if (episode) {
        infos.push(<span key={1} className="next-episode text-center">
          {episode.seasonNumber > 0 ? <>S{episode.seasonNumber.toString().padStart(2, '0')}</> : null}
          {episode.episodeNumbers?.length ? <>E{episode.episodeNumbers.map(n => n.toString().padStart(2, '0')).join('/')}&nbsp;&ndash;&nbsp;</> : null}
          {episode.title || episode.filename}
        </span>);
        progress = getEpisodeProgress(episode, this.props.user);
      }
    } else {
      infos.push(
        <span key={1} className="year">{getSeasonCount(this.props.tvshow)}</span>,
        <span key={2} className="duration">{getEpisodeCount(this.props.tvshow)}</span>
      );
    }
    return /*<React.Fragment>*/<div
      className={"flex-shrink-0 media-card tvshow" + (this.props.tvshow.audience == 999 ? " audience-not-set" : "")}
      onClick={this.handleClick.bind(this)}
    >
      <span className="poster">
        { this.props.tvshow.backdropPath ?
            <img src={`/images/backdrops_w780${this.props.tvshow.backdropPath}`} width="780" height="439" loading="lazy"/> :
            <span className="no-poster-picture"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" className="bi bi-film" viewBox="0 0 16 16">
              <path d="M0 1a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1zm4 0v6h8V1H4zm8 8H4v6h8V9zM1 1v2h2V1H1zm2 3H1v2h2V4zM1 7v2h2V7H1zm2 3H1v2h2v-2zm-2 3v2h2v-2H1zM15 1h-2v2h2V1zm-2 3v2h2V4h-2zm2 3h-2v2h2V7zm-2 3v2h2v-2h-2zm2 3h-2v2h2v-2z"/>
            </svg></span>
        }
        <b onClick={this.handlePlayTvshow.bind(this)}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
          </svg>
        </b>
        <i>
          <em title="Pas intéressé"
              className={(userStatus?.currentStatus == SeenStatus.wontSee ? "active" : "") /*+ (userStatus?.seen.length ? " d-none" : "")*/}
              onClick={this.handleToggleStatus.bind(this, this.props.tvshow, userStatus?.currentStatus == SeenStatus.wontSee ? SeenStatus.unknown : SeenStatus.wontSee)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20" viewBox="0 0 16 16">
              <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
              <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
              <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
            </svg>
          </em>
        </i>
      </span>
      <span className="title">{this.props.tvshow.title || this.props.tvshow.foldername}</span>
      <span className="infos d-flex justify-content-center">{infos}</span>
      { progress }
    </div>;
  }
}
