import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Dropdown from 'react-bootstrap/Dropdown';

import { DbCredit, DbMovie, UserMovieStatus } from '../../api/src/types';
import { SeenStatus } from '../../api/src/enums';

import {
  ctx, MoreToggle, MultiItem, getMovieDuration, getUserMovieStatus, getMovieProgress, playMovie, renderFileSize, renderVideoInfos, renderAudioInfos,
} from './common';
import FixMovieMetadataForm from './fix-movie-metadata-form';
import RenamingForm from './renaming-form';
import Casting from './casting';
import TmdbRecommandations from './tmdb-recommandations';
import YoutubeVideos from './youtube-videos';

type MovieDetailsProps = {
  movieId: number;
};
type MovieDetailsState = {
  movie: DbMovie;
  credits: DbCredit[];
  fixingMetadata: boolean;
  renaming: boolean;
  tabKey: string;
  currentStatus: SeenStatus;
  percentPos: number;
};

export default class MovieDetails extends React.Component<MovieDetailsProps, MovieDetailsState> {
  constructor(props: MovieDetailsProps) {
    super(props);
    this.handleEventMoviePositionChanged = this.handleEventMoviePositionChanged.bind(this);
    this.state = {
      movie: {
        filename: '', tmdbid: 0, title: '', originalTitle: '', year: 0, duration: 0, directors: [], writers: [], cast: [], genres: [], countries: [], audience: 0, created: 0, filesize: 0, video: { width: 0, height: 0, codec: '' }, audio: [], subtitles: [], synopsys: '', backdropPath: '', posterPath: '', userStatus: [], searchableContent: '',
      },
      credits: [],
      tabKey: ctx.router.currentRoute?.state?.tabKey || 'cast',
      fixingMetadata: false,
      renaming: false,
      currentStatus: SeenStatus.unknown,
      percentPos: 0,
    };
    this.loadMovie();
    ctx.apiClient.getCredits().then((credits) => this.setState({ credits }));
  }

  componentDidMount() {
    ctx.eventBus.on('movie-position-changed', this.handleEventMoviePositionChanged);
  }

  componentDidUpdate(prevProps: MovieDetailsProps) {
    const { movieId } = this.props;
    if (prevProps.movieId !== movieId) {
      this.setState({ tabKey: ctx.router.currentRoute?.state?.tabKey || 'cast' });
      this.loadMovie();
    }
  }

  componentWillUnmount() {
    ctx.eventBus.detach('movie-position-changed', this.handleEventMoviePositionChanged);
  }

  handleEventMoviePositionChanged(evt: any): void {
    const { movie, percentPos, currentStatus } = this.state;
    if (evt.filename === movie.filename) {
      movie.userStatus = evt.userStatus;
      const us: UserMovieStatus | null = getUserMovieStatus(movie);
      const newPercentPos = (us && movie.duration) ? Math.floor(100 * (us.position / movie.duration)) : 0;
      const newStatus = us ? us.currentStatus : SeenStatus.unknown;
      if (newPercentPos !== percentPos || newStatus !== currentStatus) {
        this.setState({ percentPos: newPercentPos, currentStatus: newStatus });
      }
    }
  }

  handleCastClick(cast: DbCredit, evt: React.MouseEvent) {
    evt.preventDefault();
    ctx.eventBus.emit('set-search', { search: cast.name });
  }

  handleToggleStatus(status: SeenStatus, evt: React.MouseEvent<HTMLElement>): void {
    evt.stopPropagation();
    evt.preventDefault();
    const { movie } = this.state;
    ctx.apiClient.setMovieStatus(movie, ctx.user?.name, status).then((userStatus: UserMovieStatus[]) => {
      movie.userStatus = userStatus;
      this.setState({ movie });
    });
  }

  handleSetAudience(audience: number, evt: React.MouseEvent<HTMLElement>): void {
    evt.preventDefault();
    const { movie } = this.state;
    if (ctx.user?.admin) {
      ctx.apiClient.setMovieAudience(movie, audience).then((aud: number) => {
        movie.audience = aud;
        this.setState({ movie });
      });
    }
  }

  handleFixMetadataClick(evt: React.MouseEvent<HTMLElement>): void {
    evt.preventDefault();
    this.setState({ fixingMetadata: true });
  }

  handleFixingMetadataFormClose(newMovie?: DbMovie): void {
    const { movie } = this.state;
    this.setState({ movie: newMovie || movie, fixingMetadata: false });
  }

  handleRenameClick(evt: React.MouseEvent<HTMLElement>): void {
    evt.preventDefault();
    this.setState({ renaming: true });
  }

  handleRenamingFormClose(): void {
    this.setState({ renaming: false });
  }

  handleDeleteClick(evt: React.MouseEvent<HTMLElement>): void {
    evt.preventDefault();
    const { movie } = this.state;
    if (movie) {
      ctx.apiClient.deleteFile(movie.filename);
    }
  }

  handleClick(evt: React.MouseEvent<HTMLElement>): void {
    evt.stopPropagation();
    evt.preventDefault();
    const { movie } = this.state;
    playMovie(movie);
  }

  handleChangeTab(tabKey: string | null): void {
    this.setState({ tabKey: tabKey || 'cast' });
    const { movieId } = this.props;
    window.history.replaceState({}, '', `#/movie/${movieId}/state/${JSON.stringify({ tabKey })}`);
  }

  getCredit(id: number): DbCredit | null {
    const { credits } = this.state;
    for (const credit of credits) {
      if (credit.tmdbid === id) {
        return credit;
      }
    }
    return null;
  }

  loadMovie(): void {
    ctx.apiClient.getMovies().then((movies) => {
      const { movieId } = this.props;
      const fetchedMovie: DbMovie | undefined = movies.find((m) => m.tmdbid === movieId);
      if (fetchedMovie) {
        const us: UserMovieStatus | null = getUserMovieStatus(fetchedMovie);
        this.setState({
          movie: fetchedMovie,
          currentStatus: us ? us.currentStatus : SeenStatus.unknown,
          percentPos: (us && fetchedMovie.duration) ? Math.floor(100 * (us.position / fetchedMovie.duration)) : 0,
        });
      } else {
        const { movie } = this.state;
        this.setState({ movie: { ...movie, tmdbid: -1 } });
      }
    });
  }

  renderCredits(ids: number[]): JSX.Element {
    const links = [];
    for (const id of ids) {
      const credit: DbCredit | null = this.getCredit(id);
      if (credit) {
        links.push(<span className="cast" key={id}><a href="#" onClick={this.handleCastClick.bind(this, credit)}>{ credit.name }</a></span>);
      }
    }
    return <>{ links }</>;
  }

  render(): JSX.Element {
    const {
      movie, fixingMetadata, renaming, tabKey,
    } = this.state;
    if (movie.tmdbid === -1) {
      return (
        <div>
          Film introuvable.
          {' '}
          <a href="#" onClick={(evt) => { evt.preventDefault(); window.history.back(); }}>Retour</a>
        </div>
      );
    }
    if (fixingMetadata) {
      return <FixMovieMetadataForm movie={movie} onClose={this.handleFixingMetadataFormClose.bind(this)} />;
    }
    if (renaming) {
      return <RenamingForm movie={movie} onClose={this.handleRenamingFormClose.bind(this)} />;
    }
    const userStatus = getUserMovieStatus(movie);
    return (
      <div className="media-details movie" style={{ background: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))${movie.backdropPath ? `, url(/images/backdrops_w1280${movie.backdropPath}) 100% 0% / cover no-repeat` : ''}` }}>
        <div className="position-fixed" style={{ top: '65px', left: '1rem' }}>
          <a href="#" className="link-light" style={{ zIndex: 1 }} onClick={(evt) => { evt.preventDefault(); window.history.back(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-arrow-left" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
            </svg>
          </a>
        </div>
        <div className="media-poster">
          <span className="poster" style={{ backgroundImage: movie.posterPath ? `url(/images/posters_w780${movie.posterPath})` : '' }}>
            <b onClick={this.handleClick.bind(this)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="bi bi-play-circle-fill" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
              </svg>
            </b>
            {getMovieProgress(movie)}
          </span>
        </div>
        <div className="title-bar">
          <div className="d-flex align-items-center">
            <div className="flex-grow-1">
              <h2>{movie.title}</h2>
              {movie.originalTitle && movie.originalTitle !== movie.title ? <h6>{movie.originalTitle}</h6> : null}
              <div>
                {movie.year > 0 ? movie.year : ''}
                {' '}
&emsp;
                {' '}
                {getMovieDuration(movie)}
                {' '}
&emsp;
                {' '}
                <img src={`/images/classification/${movie.audience}.svg`} alt={`-${movie.audience}`} width="18px" />
              </div>
            </div>
            <div className="actions">
              <a href="#" className="link-light me-3" onClick={this.handleClick.bind(this)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                </svg>
              </a>
              <a
                href="#"
                className={`link-light me-3${userStatus?.currentStatus === SeenStatus.seen || (userStatus?.currentStatus !== SeenStatus.toSee && userStatus?.seenTs?.length) ? ' active' : ''}${userStatus?.currentStatus === SeenStatus.wontSee ? ' d-none' : ''}`}
                onClick={this.handleToggleStatus.bind(this, userStatus?.currentStatus === SeenStatus.seen ? SeenStatus.toSee : SeenStatus.seen)}
                title="Vu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
              </a>
              <a
                href="#"
                className={`link-light me-3${userStatus?.currentStatus === SeenStatus.wontSee ? ' active' : ''}${userStatus?.seenTs.length ? ' d-none' : ''}`}
                onClick={this.handleToggleStatus.bind(this, userStatus?.currentStatus === SeenStatus.wontSee ? SeenStatus.unknown : SeenStatus.wontSee)}
                title="Pas intéressé"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                  <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z" />
                  <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z" />
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
                  <Dropdown.Item onClick={this.handleRenameClick.bind(this)} disabled={!ctx.user?.admin}>Renommer le fichier...</Dropdown.Item>
                  <Dropdown.Item onClick={this.handleDeleteClick.bind(this)} disabled={!ctx.user?.admin}>Supprimer</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
        </div>
        <div className="content-bar">
          <div className="d-flex align-items-start mb-3">
            <div className="flex-grow-1 pe-5">
              <p><span className="dd">{movie.filename}</span></p>
              <p>
                <span className="dt">Genre</span>
                <span className="dd">{movie.genres.join(', ')}</span>
              </p>
              <p>
                <span className="dt">Réalisé par</span>
                <span className="dd">{this.renderCredits(movie.directors)}</span>
              </p>
              {movie.writers.length > 0
                ? (
                  <p>
                    <span className="dt">
                      Scénariste
                      {movie.writers.length > 1 ? 's' : ''}
                    </span>
                    <span className="dd">{this.renderCredits(movie.writers)}</span>
                  </p>
                )
                : null}
            </div>
            <div className="flex-grow-1">
              <p>
                <span className="dt">Taille</span>
                <span className="dd">{renderFileSize(movie.filesize)}</span>
              </p>
              {movie.video
                ? (
                  <p>
                    <span className="dt">Vidéo</span>
                    <span className="dd">{renderVideoInfos(movie.video)}</span>
                  </p>
                )
                : null}
              {movie.audio.length
                ? (
                  <p>
                    <span className="dt">Audio</span>
                    <span className="dd">{renderAudioInfos(movie.audio)}</span>
                  </p>
                )
                : null}
              {movie.subtitles.length
                ? (
                  <p>
                    <span className="dt">Sous-titres</span>
                    <span className="dd">{movie.subtitles.join(', ')}</span>
                  </p>
                )
                : null}
            </div>
          </div>
          <div className="d-flex align-items-start mb-3">
            <p className="synopsis">{movie.synopsys}</p>
          </div>
          <Tabs id="cast-similar-tabs" activeKey={tabKey} onSelect={this.handleChangeTab.bind(this)} className="constrained-width" mountOnEnter>
            <Tab eventKey="cast" title="Casting">
              <Casting cast={movie.cast} />
            </Tab>
            <Tab eventKey="similar" title="Recommandations">
              <TmdbRecommandations movieId={movie.tmdbid} hidden={tabKey !== 'similar'} />
            </Tab>
            <Tab eventKey="trailers" title="Videos">
              <YoutubeVideos search={movie?.title || ''} />
            </Tab>
          </Tabs>
        </div>
      </div>
    );
  }
}
