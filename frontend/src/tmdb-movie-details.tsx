import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Spinner from 'react-bootstrap/Spinner';
import { Crew, CreditsResponse, MovieResponse } from 'moviedb-promise/dist/request-types';

import { MediaType } from '../../api/src/enums';
import { DbWish } from '../../api/src/types';
import { ctx } from './common';
import TmdbMovieRecommandations from './tmdb-movie-recommandations';
import TmdbCasting from './tmdb-casting';
import YoutubeVideos from './youtube-videos';

type TmdbMovieDetailsProps = {
  movieId: number;
};
type TmdbMovieDetailsState = {
  movie?: MovieResponse;
  credits?: CreditsResponse;
  wishes: DbWish[];
  tabKey: string;
};

export default class TmdbMovieDetails extends React.Component<TmdbMovieDetailsProps, TmdbMovieDetailsState> {
  constructor(props: TmdbMovieDetailsProps) {
    super(props);
    this.handleEventWishesChanged = this.handleEventWishesChanged.bind(this);
    this.state = { tabKey: ctx.router.currentRoute?.state?.tabKey || 'cast', wishes: [] };
    this.fetchMovie();
    this.fetchWishes();
  }

  componentDidMount() {
    ctx.eventBus.on('wishes-changed', this.handleEventWishesChanged);
  }

  componentDidUpdate(prevProps: TmdbMovieDetailsProps) {
    const { movieId } = this.props;
    if (prevProps.movieId !== movieId) {
      this.setState({
        movie: undefined,
        credits: undefined,
        tabKey: ctx.router.currentRoute?.state?.tabKey || 'cast',
      });
      this.fetchMovie();
    }
  }

  componentWillUnmount() {
    ctx.eventBus.detach('wishes-changed', this.handleEventWishesChanged);
  }

  handleChangeTab(tabKey: string | null): void {
    this.setState({ tabKey: tabKey || 'cast' });
    const { movieId } = this.props;
    window.history.replaceState({}, '', `#/tmdb/movie/${movieId}/state/${JSON.stringify({ tabKey })}`);
  }

  handleCastClick(crew: Crew, evt: React.MouseEvent): void {
    evt.preventDefault();
    ctx.router.navigateTo(`#/tmdb/person/${crew.id}`);
  }

  handleEventWishesChanged(): void {
    this.fetchWishes();
  }

  async handleWishListClick(action: string, evt: React.MouseEvent): Promise<void> {
    evt.preventDefault();
    const { movieId } = this.props;
    const { movie } = this.state;
    if (action === 'add') {
      await ctx.apiClient.addToWishList(
        movieId,
        movie?.title || '',
        MediaType.movie,
        movie?.poster_path || '',
        parseFloat(movie?.release_date || '0'),
        ctx.user?.name || '',
      );
      this.fetchWishes();
    } else if (action === 'remove') {
      await ctx.apiClient.removeFromWishList(movieId, ctx.user?.name || '');
      this.fetchWishes();
    }
  }

  getDuration(duration: number | null): string {
    if (duration) {
      return `${Math.floor(duration / 60)}h${(duration % 60).toString().padStart(2, '0')}`;
    }
    return '';
  }

  getAudience(movie?: MovieResponse): number {
    if (movie) {
      const audiences = [];
      if ((movie as any).release_dates?.results) {
        for (const country of (movie as any).release_dates.results) {
          if (country.iso_3166_1 === 'US') {
            for (const date of country.release_dates) {
              switch (date.certification) {
                case 'G': audiences.push(0); break; // "All ages admitted. There is no content that would be objectionable to most parents. This is one of only two ratings dating back to 1968 that still exists today."
                case 'PG': audiences.push(10); break; // "Some material may not be suitable for children under 10. These films may contain some mild language, crude/suggestive humor, scary moments and/or violence. No drug content is present. There are a few exceptions to this rule. A few racial insults may also be heard."
                case 'PG-13': audiences.push(12); break; // "Some material may be inappropriate for children under 13. Films given this rating may contain sexual content, brief or partial nudity, some strong language and innuendo, humor, mature themes, political themes, terror and/or intense action violence. However, bloodshed is rarely present. This is the minimum rating at which drug content is present."
                case 'R': audiences.push(16); break; // "Under 17 requires accompanying parent or adult guardian 21 or older. The parent/guardian is required to stay with the child under 17 through the entire movie, even if the parent gives the child/teenager permission to see the film alone. These films may contain strong profanity, graphic sexuality, nudity, strong violence, horror, gore, and strong drug use. A movie rated R for profanity often has more severe or frequent language than the PG-13 rating would permit. An R-rated movie may have more blood, gore, drug use, nudity, or graphic sexuality than a PG-13 movie would admit."
                case 'NC-17': audiences.push(18); break; // "These films contain excessive graphic violence, intense or explicit sex, depraved, abhorrent behavior, explicit drug abuse, strong language, explicit nudity, or any other elements which, at present, most parents would consider too strong and therefore off-limits for viewing by their children and teens. NC-17 does not necessarily mean obscene or pornographic in the oft-accepted or legal meaning of those words."
                case 'NR': // "No rating information."
                default: break;
              }
            }
          } else if (country.iso_3166_1 === 'FR') {
            for (const date of country.release_dates) {
              switch (date.certification) {
                case 'U': audiences.push(0); break; // "(Tous publics) valid for all audiences."
                case '10': audiences.push(10); break; // "(Déconseillé aux moins de 10 ans) unsuitable for children younger than 10 (this rating is only used for TV); equivalent in theatres : \"avertissement\" (warning), some scenes may be disturbing to young children and sensitive people; equivalent on video : \"accord parental\" (parental guidance)."
                case '12': audiences.push(12); break; // "(Interdit aux moins de 12 ans) unsuitable for children younger than 12 or forbidden in cinemas for under 12."
                case '16': audiences.push(16); break; // "(Interdit aux moins de 16 ans) unsuitable for children younger than 16 or forbidden in cinemas for under 16."
                case '18': audiences.push(18); break; // "(Interdit aux mineurs) unsuitable for children younger than 18 or forbidden in cinemas for under 18."
                default: break;
              }
            }
          }
        }
      }
      return (audiences.length) ? Math.max.apply(null, audiences) : 999;
    }
    return 999;
  }

  async fetchMovie(): Promise<void> {
    const { movieId } = this.props;
    const movie = await ctx.tmdbClient?.getMovie(movieId);
    const credits = await ctx.tmdbClient?.getMovieCredits(movieId);
    this.setState({ movie, credits });
  }

  async fetchWishes(): Promise<void> {
    const wishes = await ctx.apiClient.getWishes();
    this.setState({ wishes });
  }

  renderCredits(crewList?: Crew[]): JSX.Element {
    if (!crewList || !crewList.length) { return <>Inconnu</>; }
    const links = [];
    for (const crew of crewList) {
      links.push(<span className="cast" key={crew.id}><a href="#" onClick={this.handleCastClick.bind(this, crew)}>{ crew.name }</a></span>);
    }
    return <>{ links }</>;
  }

  render(): JSX.Element {
    const { movieId } = this.props;
    const {
      movie, credits, tabKey, wishes,
    } = this.state;
    if (!movie) {
      return <div className="d-flex justify-content-center mt-5"><Spinner animation="border" variant="light" /></div>;
    }
    const year: number = parseFloat(movie?.release_date || '0');
    const directors: Crew[] | undefined = credits?.crew?.filter((c) => c.job === 'Director').slice(0, 5);
    const writers: Crew[] | undefined = credits?.crew?.filter((c) => c.job === 'Writer').slice(0, 5);
    const isWished: boolean = !!wishes.find((w) => w.tmdbid === movieId && !!w.users.find((uw) => uw.userName === ctx.user?.name));
    return (
      <div className="media-details movie" style={{ background: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))${movie.backdrop_path ? `, url(${ctx.tmdbClient?.baseUrl}w1280${movie.backdrop_path}) 100% 0% / cover no-repeat` : ''}` }}>
        <div className="position-fixed" style={{ top: '65px', left: '1rem' }}>
          <a href="#" className="link-light" onClick={(evt) => { evt.preventDefault(); window.history.back(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-arrow-left" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
            </svg>
          </a>
        </div>
        <div className="media-poster">
          <span className="poster" style={{ backgroundImage: movie.poster_path ? `url(${ctx.tmdbClient?.baseUrl}w780${movie.poster_path})` : '' }} />
        </div>
        <div className="title-bar">
          <div className="d-flex align-items-center">
            <div className="flex-grow-1">
              <h2>{movie.title}</h2>
              {movie?.original_title && movie.original_title !== movie.title ? <h6>{movie.original_title}</h6> : null}
              <div>
                {year > 0 ? year : ''}
                &emsp;
                {this.getDuration(movie?.runtime || null)}
                &emsp;
                <img src={`/images/classification/${this.getAudience(movie)}.svg`} alt="audience" width="18px" />
              </div>
            </div>
            <div className="actions">
              <a
                href="#"
                className={`btn me-3 ${isWished ? 'btn-danger' : 'btn-primary'}`}
                onClick={this.handleWishListClick.bind(this, isWished ? 'remove' : 'add')}
              >
                <svg style={{ verticalAlign: 'baseline' }} xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-bookmark-plus-fill" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M2 15.5V2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.74.439L8 13.069l-5.26 2.87A.5.5 0 0 1 2 15.5zm6.5-11a.5.5 0 0 0-1 0V6H6a.5.5 0 0 0 0 1h1.5v1.5a.5.5 0 0 0 1 0V7H10a.5.5 0 0 0 0-1H8.5V4.5z" />
                </svg>
                <span className="d-inline-block ms-3">
                  {isWished ? 'Retirer de ma' : 'Ajouter à ma'}
                  <br />
                  liste d&apos;envies
                </span>
              </a>
            </div>
          </div>
        </div>
        <div className="content-bar">
          <div className="d-flex align-items-start mb-3">
            <div className="flex-grow-1 pe-5">
              <p>
                <span className="dt">Genre</span>
                <span className="dd">{ movie?.genres ? movie?.genres.filter((genre) => !!genre.name).map((genre) => genre.name).join(', ') : '' }</span>
              </p>
              <p>
                <span className="dt">Réalisé par</span>
                <span className="dd">{this.renderCredits(directors)}</span>
              </p>
              {writers && writers.length > 0
                ? (
                  <p>
                    <span className="dt">
                      Scénariste
                      {writers.length > 1 ? 's' : ''}
                    </span>
                    <span className="dd">{this.renderCredits(writers)}</span>
                  </p>
                )
                : null}
            </div>
          </div>
          <div className="d-flex align-items-start mb-3">
            <p className="synopsis">{movie.overview}</p>
          </div>
          <Tabs id="cast-similar-tabs" activeKey={tabKey} onSelect={this.handleChangeTab.bind(this)} className="constrained-width" mountOnEnter>
            <Tab eventKey="cast" title="Casting">
              <TmdbCasting cast={credits?.cast} />
            </Tab>
            <Tab eventKey="similar" title="Recommandations">
              <TmdbMovieRecommandations movieId={movieId} hidden={tabKey !== 'similar'} />
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
