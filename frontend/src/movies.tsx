import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';

import { AudioInfo, Config, DbCredit, DbMovie, DbUser, UserMovieStatus, VideoInfo } from '../../api/src/types';
import apiClient from './api-client';

type MoviesProps = {
  config: Config;
  user: DbUser;
};
type MoviesState = {
  movies: DbMovie[];
  credits: DbCredit[];
  selection?: DbMovie;
  tabKey: string;
};

enum MovieAction {
  play = "play",
  open = "open",
};

export default class Movies extends React.Component<MoviesProps, MoviesState> {

  constructor(props: MoviesProps) {
    super(props);
    this.state = {
      movies: [],
      credits: [],
      tabKey: "cast",
    };
    apiClient.getMovies().then((movies) => {
      this.setState({ movies });
    });
    apiClient.getCredits().then((credits) => {
      this.setState({ credits });
    });
  }

  getLanguage(movie: DbMovie): string {
    let found = movie.filename.match(/([vostfqi\+]+)\]/i);
    if (found) {
      return found[1].toUpperCase();
    }
    return "";
  }

  getDuration(movie: DbMovie): string {
    let found = movie.filename.match(/\[([0-9]+)'/i);
    if (found) {
      return Math.floor(parseFloat(found[1]) / 60) + 'h' + (parseFloat(found[1]) % 60).toString().padStart(2, '0');
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

  getUserStatus(movie: DbMovie): UserMovieStatus|null {
    console.log("getUserStatus", movie.userStatus);
    for (let userStatus of movie.userStatus) {
      if (userStatus.userName == this.props.user.name) {
        return userStatus;
        break;
      }
    }
    return null;
  }

  getPosition(movie: DbMovie): number {
    let userStatus: UserMovieStatus|null = this.getUserStatus(movie);
    return userStatus?.position || 0;
  }

  getProgress(movie: DbMovie): JSX.Element {
    let position: number = this.getPosition(movie);
    return position > 0 ? <div className="progress-bar"><div style={{ width: Math.round(100 * position / movie.duration) + '%' }}></div></div> : <></>;
  }

  renderCredits(ids: number[]): string {
    const strings = [];
     for (const id of ids) {
       const credit: DbCredit|null = this.getCredit(id);
       if (credit) {
         strings.push(credit.name);
       }
     }
     return strings.join(', ');
  }

  renderFileSize(size: number): string {
    var i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(1) + ' ' + ['o', 'ko', 'Mo', 'Go', 'To'][i];
  }

  renderVideoInfos(video: VideoInfo): JSX.Element {
    return <>{video.width} &times; {video.height} &emsp; {video.codec}</>;
  }

  renderAudioInfos(audios: AudioInfo[]): JSX.Element {
    return <React.Fragment>{audios.map((audio, idx) => <React.Fragment key={idx}>{audio.lang} {audio.ch}ch {audio.codec} &emsp;</React.Fragment>)}</React.Fragment>;
  }

  handleMovieClick(movie: DbMovie, action: MovieAction, evt: React.MouseEvent<HTMLElement>): void {
    evt.stopPropagation();
    switch (action) {
      case MovieAction.open:
        this.setState({ selection: movie, tabKey: "cast" });
        break;
      case MovieAction.play:
        const path = `${this.props.config.moviesRemotePath}/${movie.filename}`;
        if (window._mpvSchemeSupported) {
          window._setPosition = apiClient.setPosition.bind(apiClient, movie, this.props.user.name, this.forceUpdate.bind(this));
          document.location.href = `mpv://${path}?pos=${this.getPosition(movie)}`;
        } else {
          navigator.clipboard.writeText(path).then(function() {
            alert(`Le chemin a été copié dans le presse-papier`);
          }, function() {
            alert(`La copie du chemin dans le presse-papier a échoué`);
          });
        }
        break;
    }
  }

  handleToggleStatus(movie: DbMovie, field: string, value: any, evt: React.MouseEvent<HTMLElement>): void {
    apiClient.setStatus(movie, this.props.user.name, field, value).then((userStatus: UserMovieStatus[]) => {
      movie.userStatus = userStatus;
      this.setState({ movies: this.state.movies });
    });
    evt.stopPropagation();
    evt.preventDefault();
  }

  renderList(): JSX.Element {
    return <div className="d-flex flex-wrap justify-content-evenly mt-3">{
      this.state.movies.map((movie, idx) => {
        const userStatus = this.getUserStatus(movie);
        return <div key={idx} className="movie-card" onClick={this.handleMovieClick.bind(this, movie, MovieAction.open)}>
          <span className="poster" style={{ backgroundImage: `url(/images/posters_w342${movie.posterPath})` }}>
            <b onClick={this.handleMovieClick.bind(this, movie, MovieAction.play)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </b>
            <i>
              <em title="Vu"
                  className={(! userStatus?.toSee && userStatus?.seen.length ? "active" : "") + (userStatus?.notInterested || ! userStatus?.seen.length ? " d-none" : "")}
                  onClick={this.handleToggleStatus.bind(this, movie, "toSee", ! userStatus?.toSee)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              </em>
              <em title="Pas intéressé"
                  className={(userStatus?.notInterested ? "active" : "") + (userStatus?.seen.length ? " d-none" : "")}
                  onClick={this.handleToggleStatus.bind(this, movie, "notInterested", ! userStatus?.notInterested)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="20" height="20" viewBox="0 0 16 16">
                  <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                  <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                  <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
                </svg>
              </em>
            </i>
          </span>
          <span className="title">{movie.title}</span>
          <span className="infos d-flex justify-content-between">
            <span className="year">{movie.year}</span>
            <span className="lang">{this.getLanguage(movie)}</span>
            <span className="duration">{this.getDuration(movie)}</span>
          </span>
          {this.getProgress(movie)}
        </div>;
      })
    }</div>;
  }
  
  handleCloseDetails(evt: React.MouseEvent<HTMLElement>): void {
    this.setState({ selection: undefined });
  }

  renderDetails(): JSX.Element {
    if (! this.state.selection) {
      return <div>Film introuvable. <a href="#" onClick={this.handleCloseDetails.bind(this)}>Retour</a></div>;
    }
    const movie: DbMovie = this.state.selection;
    const userStatus = this.getUserStatus(movie);
    return <div className="movie-details" style={{background: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6)), url(/images/backdrops_w1280${movie.backdropPath}) 100% 0% / cover no-repeat`}}>
      <div style={{ margin: "1em" }}>
        <a href="#" className="link-light" onClick={this.handleCloseDetails.bind(this)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
          </svg>
        </a>
      </div>
      <div className="movie-poster">
        <span className="poster" style={{ backgroundImage: `url(/images/posters_w780${movie.posterPath})` }}>
          <b onClick={this.handleMovieClick.bind(this, movie, MovieAction.play)}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
            </svg>
           </b>
          {this.getProgress(movie)}
        </span>
      </div>
      <div className="title-bar">
        <div className="d-flex align-items-center">
          <div className="flex-grow-1">
            <h2>{movie.title}</h2>
            {movie.originalTitle && movie.originalTitle != movie.title ? <h6>{movie.originalTitle}</h6> : null}
            <div>{movie.year} &emsp; {this.getDuration(movie)} &emsp; <img src={`/images/classification/${movie.audience}.svg`} width="18px"/></div>
          </div>
          <div className="actions">
            <a href="#" className="link-light me-3" onClick={this.handleMovieClick.bind(this, movie, MovieAction.play)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + (! userStatus?.toSee && userStatus?.seen.length ? " active" : "") + (userStatus?.notInterested || ! userStatus?.seen.length ? " d-none" : "")}
               onClick={this.handleToggleStatus.bind(this, movie, "toSee", ! userStatus?.toSee)}
               title="Vu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + (userStatus?.notInterested ? " active" : "") + (userStatus?.seen.length ? " d-none" : "")}
               onClick={this.handleToggleStatus.bind(this, movie, "notInterested", ! userStatus?.notInterested)}
               title="Pas intéressé"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
                  <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                  <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
              </svg>
            </a>
            <a href="#" className="link-light me-3 d-none" onClick={undefined}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
      <div className="content-bar">
        <div className="d-flex align-items-start mb-5">
          <div className="flex-grow-1 pe-5">
            <p><span className="dd">{movie.filename}</span></p>
            <p><span className="dt">Genre</span><span className="dd">{movie.genres.join(', ')}</span></p>
            <p><span className="dt">Réalisé par</span><span className="dd">{this.renderCredits(movie.directors)}</span></p>
            {movie.writers.length > 0
              ? <p><span className="dt">Scénariste{movie.writers.length > 1 ? "s" : ""}</span><span className="dd">{this.renderCredits(movie.writers)}</span></p>
              : null
            }
          </div>
          <div className="flex-grow-1">
            <p><span className="dt">Taille</span><span className="dd">{this.renderFileSize(movie.filesize)}</span></p>
            {movie.video
              ? <p><span className="dt">Vidéo</span><span className="dd">{this.renderVideoInfos(movie.video)}</span></p>
              : null
            }
            {movie.audio.length
              ? <p><span className="dt">Audio</span><span className="dd">{this.renderAudioInfos(movie.audio)}</span></p>
              : null
            }
            {movie.subtitles.length
              ? <p><span className="dt">Sous-titres</span><span className="dd">{movie.subtitles.join(', ')}</span></p>
              : null
            }
          </div>
        </div>
        <div className="d-flex align-items-start mb-5">
          <p className="synopsis">{movie.synopsys}</p>
        </div>
        <Tabs id="controlled-tab-example" activeKey={this.state.tabKey} onSelect={(tabKey) => this.setState({ tabKey })}>
          <Tab eventKey="cast" title="Casting">
            <div className="d-flex flex-wrap mt-3">{
              movie.cast.map((role, idx) => {
                const credit = this.getCredit(role.tmdbid);
                return credit ? <div key={idx} className="cast-card">
                  {credit.profilePath
                    ? <img src={`/images/profiles_w185${credit.profilePath}`}/>
                    : <span className="no-profile-picture"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                      <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
                    </svg></span>}
                  <span className="actor">{credit.name}</span>
                  <span className="character">en tant que {role.character}</span>
                </div> : null;
              })
            }</div>
          </Tab>
          <Tab eventKey="similar" title="Recommandations">
          </Tab>
        </Tabs>
      </div>
    </div>;
  }

  render(): JSX.Element {
    if (this.state.selection) {
      return this.renderDetails();
    } else {
      return this.renderList();
    }
  }
}
