import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Dropdown from 'react-bootstrap/Dropdown';

import { Config, DbCredit, DbMovie, DbUser, UserMovieStatus } from '../../api/src/types';
import { SeenStatus } from '../../api/src/enums';
import { MoreToggle, MultiItem, getMovieDuration, getUserMovieStatus, getMovieProgress, playMovie, renderFileSize, renderVideoInfos, renderAudioInfos } from './common';
import apiClient from './api-client';
import TmdbClient from './tmdb';
import FixMovieMetadataForm from './fix-movie-metadata-form';
import RenamingForm from './renaming-form';
import Casting from './casting';

type MovieDetailsProps = {
  movie: DbMovie;
  config: Config;
  user: DbUser;
  tmdbClient?: TmdbClient;
  onClosed: () => void;
  onChanged: () => void;
  onReplaced: (movie: DbMovie) => void;
  onDeleted: (movie: DbMovie) => void;
};
type MovieDetailsState = {
  credits: DbCredit[];
  fixingMetadata: boolean;
  renaming: boolean;
  tabKey: string;
};

export default class MovieDetails extends React.Component<MovieDetailsProps, MovieDetailsState> {

  constructor(props: MovieDetailsProps) {
    super(props);
    this.state = {
      credits: [],
      tabKey: "cast",
      fixingMetadata: false,
      renaming: false,
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

  handleToggleStatus(movie: DbMovie, status: SeenStatus, evt: React.MouseEvent<HTMLElement>): void {
    apiClient.setMovieStatus(movie, this.props.user.name, status).then((userStatus: UserMovieStatus[]) => {
      movie.userStatus = userStatus;
      this.props.onChanged();
    });
    evt.stopPropagation();
    evt.preventDefault();
  }

  handleSetAudience(movie: DbMovie, audience: number, evt: React.MouseEvent<HTMLElement>): void {
    if (this.props.user.admin) {
      apiClient.setMovieAudience(movie, audience).then((aud: number) => {
        movie.audience = aud;
        this.props.onChanged();
      });
    }
    evt.preventDefault();
  }

  handleFixMetadataClick(evt: React.MouseEvent<HTMLElement>): void {
    this.setState({ fixingMetadata: true });
    evt.preventDefault();
  }

  handleFixingMetadataFormClose(movie?: DbMovie): void {
    if (movie) {
      this.props.onReplaced(movie);
    }
    this.setState({ fixingMetadata: false });
  }

  handleRenameClick(evt: React.MouseEvent<HTMLElement>): void {
    this.setState({ renaming: true });
    evt.preventDefault();
  }

  handleRenamingFormClose(): void {
    this.setState({ renaming: false });
  }

  async handleDeleteClick(evt: React.MouseEvent<HTMLElement>): Promise<void> {
    if (this.props.movie) {
      await apiClient.deleteFile(this.props.movie.filename);
      this.props.onDeleted(this.props.movie);
      // const movies = this.state.movies.filter(m => m.filename !== this.props.movie?.filename)
      // this.setState({ movies, selection: undefined });
    }
    evt.preventDefault();
  }

  render(): JSX.Element {
    if (! this.props.movie) {
      return <div>Film introuvable. <a href="#" onClick={this.props.onClosed}>Retour</a></div>;
    }
    if (this.state.fixingMetadata) {
      return <FixMovieMetadataForm {...this.props} onClose={this.handleFixingMetadataFormClose.bind(this)}/>;
    }
    if (this.state.renaming) {
      return <RenamingForm {...this.props} onClose={this.handleRenamingFormClose.bind(this)}/>;
    }
    const movie: DbMovie = this.props.movie;
    const userStatus = getUserMovieStatus(movie, this.props.user);
    return <div className="media-details movie" style={{background: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6)), url(/images/backdrops_w1280${movie.backdropPath}) 100% 0% / cover no-repeat`}}>
      <div style={{ margin: "1em" }}>
        <a href="#" className="link-light" onClick={this.props.onClosed}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
          </svg>
        </a>
      </div>
      <div className="media-poster">
        <span className="poster" style={{ backgroundImage: `url(/images/posters_w780${movie.posterPath})` }}>
          <b onClick={(evt: React.MouseEvent<HTMLElement>) => { evt.stopPropagation(); evt.preventDefault(); playMovie(this.props.config, movie, this.props.user, this.forceUpdate.bind(this)); }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
            </svg>
           </b>
          {getMovieProgress(movie, this.props.user)}
        </span>
      </div>
      <div className="title-bar">
        <div className="d-flex align-items-center">
          <div className="flex-grow-1">
            <h2>{movie.title}</h2>
            {movie.originalTitle && movie.originalTitle != movie.title ? <h6>{movie.originalTitle}</h6> : null}
            <div>{movie.year} &emsp; {getMovieDuration(movie)} &emsp; <img src={`/images/classification/${movie.audience}.svg`} width="18px"/></div>
          </div>
          <div className="actions">
            <a href="#" className="link-light me-3" onClick={(evt: React.MouseEvent<HTMLElement>) => { evt.stopPropagation(); evt.preventDefault(); playMovie(this.props.config, movie, this.props.user, this.forceUpdate.bind(this)); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + (userStatus?.currentStatus == SeenStatus.seen || (userStatus?.currentStatus != SeenStatus.toSee && userStatus?.seenTs?.length) ? " active" : "") + (userStatus?.currentStatus == SeenStatus.wontSee ? " d-none" : "")}
               onClick={this.handleToggleStatus.bind(this, movie, userStatus?.currentStatus == SeenStatus.seen ? SeenStatus.toSee : SeenStatus.seen)}
               title="Vu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
              </svg>
            </a>
            <a href="#"
               className={"link-light me-3" + (userStatus?.currentStatus == SeenStatus.wontSee ? " active" : "") + (userStatus?.seenTs.length ? " d-none" : "")}
               onClick={this.handleToggleStatus.bind(this, movie, userStatus?.currentStatus == SeenStatus.wontSee ? SeenStatus.unknown : SeenStatus.wontSee)}
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
                  { [0,10,12,16,18,999].map(a => <a key={a} className={"audience-link p-2" + (this.props.user.admin ? "" : " disabled")} onClick={this.handleSetAudience.bind(this, movie, a)}><img src={`/images/classification/${a}.svg`} width="20"/></a>) }
                </Dropdown.Item>
                <Dropdown.Divider/>
                <Dropdown.Item onClick={this.handleFixMetadataClick.bind(this)} disabled={! this.props.user.admin}>Corriger les métadonnées...</Dropdown.Item>
                <Dropdown.Item onClick={this.handleRenameClick.bind(this)} disabled={! this.props.user.admin}>Renommer le fichier...</Dropdown.Item>
                <Dropdown.Item onClick={this.handleDeleteClick.bind(this)} disabled={! this.props.user.admin}>Supprimer</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>
      </div>
      <div className="content-bar">
        <div className="d-flex align-items-start mb-3">
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
            <p><span className="dt">Taille</span><span className="dd">{renderFileSize(movie.filesize)}</span></p>
            {movie.video
              ? <p><span className="dt">Vidéo</span><span className="dd">{renderVideoInfos(movie.video)}</span></p>
              : null
            }
            {movie.audio.length
              ? <p><span className="dt">Audio</span><span className="dd">{renderAudioInfos(movie.audio)}</span></p>
              : null
            }
            {movie.subtitles.length
              ? <p><span className="dt">Sous-titres</span><span className="dd">{movie.subtitles.join(', ')}</span></p>
              : null
            }
          </div>
        </div>
        <div className="d-flex align-items-start mb-3">
          <p className="synopsis">{movie.synopsys}</p>
        </div>
        <Tabs id="cast-similar-tabs" activeKey={this.state.tabKey} onSelect={(tabKey) => this.setState({ tabKey: tabKey || "cast" })} className="constrained-width">
          <Tab eventKey="cast" title="Casting">
            <Casting cast={movie.cast} />
          </Tab>
          {/*<Tab eventKey="similar" title="Recommandations">
          </Tab>*/}
        </Tabs>
      </div>
    </div>;
  }

}