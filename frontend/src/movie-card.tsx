import React from 'react';

import { Config, DbMovie, DbUser, UserMovieStatus } from '../../api/src/types';
import { SeenStatus } from '../../api/src/enums';
import { getMovieLanguage, getMovieDuration, getUserMovieStatus, getMovieProgress, playMovie } from './common';
import apiClient from './api-client';

type MovieCardProps = {
  movie: DbMovie;
  config: Config;
  user: DbUser;
  onChanged: () => void;
  onSelected: (movie: DbMovie) => void;
};
type MovieCardState = {
  currentStatus: SeenStatus;
  percentPos: number;
};

export default class MovieCard extends React.Component<MovieCardProps, MovieCardState> {

  constructor(props: MovieCardProps) {
    super(props);
    const us: UserMovieStatus|null = getUserMovieStatus(this.props.movie, this.props.user);
    this.state = {
      currentStatus: us ? us.currentStatus : SeenStatus.unknown,
      percentPos: (us && this.props.movie.duration) ? Math.floor(100 * us.position / this.props.movie.duration) : 0,
    };
  }

  handleToggleStatus(movie: DbMovie, status: SeenStatus, evt: React.MouseEvent<HTMLElement>): void {
    apiClient.setMovieStatus(movie, this.props.user.name, status).then((userStatus: UserMovieStatus[]) => {
      movie.userStatus = userStatus;
      this.props.onChanged();
    });
    evt.stopPropagation();
    evt.preventDefault();
  }

  handleClick(evt: React.MouseEvent<HTMLElement>): void {
    this.props.onSelected(this.props.movie);
    evt.stopPropagation();
    evt.preventDefault();
  }

  handlePlayMovie(evt: React.MouseEvent<HTMLElement>): void {
    playMovie(this.props.config, this.props.movie, this.props.user, this.handlePlayCallback.bind(this));
    evt.stopPropagation();
    evt.preventDefault();
  }

  handlePlayCallback(): void {
    const us: UserMovieStatus|null = getUserMovieStatus(this.props.movie, this.props.user);
    const percentPos = (us && this.props.movie.duration) ? Math.floor(100 * us.position / this.props.movie.duration) : 0;
    const currentStatus = us ? us.currentStatus : SeenStatus.unknown;
    if (percentPos != this.state.percentPos || currentStatus != this.state.currentStatus) {
      this.props.onChanged();
      this.setState({ percentPos, currentStatus });
    }
  }

  render(): JSX.Element {
    const userStatus = getUserMovieStatus(this.props.movie, this.props.user);
    const lang = getMovieLanguage(this.props.movie);
    return <div
      className={"flex-shrink-0 media-card portrait" + (this.props.movie.audience == 999 ? " audience-not-set" : "")}
      onClick={this.handleClick.bind(this)}
    >
      <span className="poster">
        { this.props.movie.posterPath ?
            <img src={`/images/posters_w342${this.props.movie.posterPath}`} width="342" height="513" loading="lazy"/> :
            <span className="no-poster-picture"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" className="bi bi-film" viewBox="0 0 16 16">
              <path d="M0 1a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1zm4 0v6h8V1H4zm8 8H4v6h8V9zM1 1v2h2V1H1zm2 3H1v2h2V4zM1 7v2h2V7H1zm2 3H1v2h2v-2zm-2 3v2h2v-2H1zM15 1h-2v2h2V1zm-2 3v2h2V4h-2zm2 3h-2v2h2V7zm-2 3v2h2v-2h-2zm2 3h-2v2h2v-2z"/>
            </svg></span>
        }
        <b onClick={this.handlePlayMovie.bind(this)}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
            <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
          </svg>
        </b>
        <i>
          <em title="Vu"
              className={(userStatus?.currentStatus == SeenStatus.seen || (userStatus?.currentStatus != SeenStatus.toSee && userStatus?.seenTs?.length) ? "active" : "") + (userStatus?.currentStatus == SeenStatus.wontSee ? " d-none" : "")}
              onClick={this.handleToggleStatus.bind(this, this.props.movie, userStatus?.currentStatus == SeenStatus.seen ? SeenStatus.toSee : SeenStatus.seen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          </em>
          <em title="Pas intéressé"
              className={(userStatus?.currentStatus == SeenStatus.wontSee ? " active" : "") + (userStatus?.seenTs.length ? " d-none" : "")}
              onClick={this.handleToggleStatus.bind(this, this.props.movie, userStatus?.currentStatus == SeenStatus.wontSee ? SeenStatus.unknown : SeenStatus.wontSee)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20" viewBox="0 0 16 16">
              <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
              <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
              <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
            </svg>
          </em>
        </i>
        {getMovieProgress(this.props.movie, this.props.user)}
      </span>
      <span className="title">{this.props.movie.title || this.props.movie.filename}</span>
      <span className="infos d-flex justify-content-center">
        <span className={"year" + (this.props.movie.year < 0 ? " invisible" : "")}>{this.props.movie.year}</span>
        <span className={"lang" + (lang ? "" : " invisible")} title={lang}>{lang}</span>
        <span className="duration">{getMovieDuration(this.props.movie)}</span>
      </span>
    </div>;
  }
}
