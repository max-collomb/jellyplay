import React from 'react';

import { DbMovie, DbCredit, VideoInfo, AudioInfo } from '../../api/src/types';
import apiClient from './api-client';

type MoviesProps = {};
type MoviesState = {
  movies: DbMovie[];
  credits: DbCredit[];
  selection?: DbMovie;
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
    return (size / Math.pow(1024, i)).toFixed(1) * 1 + ' ' + ['o', 'ko', 'Mo', 'Go', 'To'][i];
  }

  renderVideoInfos(video: VideoInfo): JSX.Element {
    return <>{video.width} &times; {video.height} &emsp; {video.codec}</>;
  }

  renderAudioInfos(audios: AudioInfo[]): JSX.Element {
    console.log("audios", audios);
    return <React.Fragment>{audios.map((audio, idx) => <React.Fragment key={idx}>{audio.lang} {audio.ch}ch {audio.codec} &emsp;</React.Fragment>)}</React.Fragment>;
  }

  handleMovieClick(movie: DbMovie, action: MovieAction, evt: React.MouseEvent<HTMLElement>): void {
    evt.stopPropagation();
    switch (action) {
      case MovieAction.open:
        this.setState({ selection: movie });
        break;
      case MovieAction.play:
        console.log("TODO launch MVP") ;
        break;
    }
  }

  renderList(): JSX.Element {
    return <div className="d-flex flex-wrap justify-content-evenly mt-3">{
      this.state.movies.map((movie, idx) => {
        return <div key={idx} className="movie-card" onClick={this.handleMovieClick.bind(this, movie, MovieAction.open)}>
          <span className="poster" style={{ backgroundImage: `url(/images/posters_w342${movie.posterPath})` }}>
            <b onClick={this.handleMovieClick.bind(this, movie, MovieAction.play)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
             </b>
          </span>
          <span className="title">{movie.title}</span>
          <span className="infos d-flex justify-content-between">
            <span className="year">{movie.year}</span>
            <span className="lang">{this.getLanguage(movie)}</span>
            <span className="duration">{this.getDuration(movie)}</span>
          </span>
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
            <a href="#" className="link-light me-3" onClick={null} title="Vu">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
              </svg>
            </a>
            <a href="#" className="link-light me-3" onClick={null}>
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
          <p class="synopsis">{movie.synopsys}</p>
        </div>
        <div className="d-flex flex-wrap mt-3">{
          movie.cast.map((role, idx) => {
            const credit = this.getCredit(role.tmdbid);
            return credit ? <div className="cast-card">
              {credit.profilePath
                ? <img src={`/images/profiles_w185${credit.profilePath}`}/>
                : <span className="no-profile-picture"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                  <path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
                </svg></span>}
              <span className="actor">{credit.name}</span>
              <span className="character">en tant que {role.character}</span>
            </div> : null;
          })
        }</div>
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
