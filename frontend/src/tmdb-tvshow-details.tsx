import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Spinner from 'react-bootstrap/Spinner';
import { Crew, CreditsResponse, ShowResponse } from 'moviedb-promise/dist/request-types';

import { MediaType } from '../../api/src/enums';
import { DbWish } from '../../api/src/types';
import { ctx } from './common';
import TmdbTvshowRecommandations from './tmdb-tvshow-recommandations';
import TmdbCasting from './tmdb-casting';
import YoutubeVideos from './youtube-videos';
import Rating from './rating';

type TmdbTvshowDetailsProps = {
  tvshowId: number;
};
type TmdbTvshowDetailsState = {
  tvshow?: ShowResponse;
  credits?: CreditsResponse;
  wishes: DbWish[];
  tabKey: string;
};

export default class TmdbTvshowDetails extends React.Component<TmdbTvshowDetailsProps, TmdbTvshowDetailsState> {
  constructor(props: TmdbTvshowDetailsProps) {
    super(props);
    this.handleEventWishesChanged = this.handleEventWishesChanged.bind(this);
    this.state = { tabKey: ctx.router.currentRoute?.state?.tabKey || 'cast', wishes: [] };
    this.fetchTvshow();
    this.fetchWishes();
    ctx.eventBus.replace('will-navigate', ctx.router.saveScrollPosition.bind(ctx.router));
  }

  componentDidMount() {
    ctx.eventBus.on('wishes-changed', this.handleEventWishesChanged);
  }

  componentDidUpdate(prevProps: TmdbTvshowDetailsProps, prevState: TmdbTvshowDetailsState) {
    const { tvshowId } = this.props;
    if (prevProps.tvshowId !== tvshowId) {
      this.setState({
        tvshow: undefined,
        credits: undefined,
        tabKey: ctx.router.currentRoute?.state?.tabKey || 'cast',
      });
      this.fetchTvshow();
    }
    const { tvshow } = this.state;
    if (prevState.tvshow?.id !== tvshow?.id) {
      ctx.router.restoreScrollPosition();
    }
  }

  componentWillUnmount() {
    ctx.eventBus.detach('wishes-changed', this.handleEventWishesChanged);
  }

  handleEventWishesChanged(): void {
    this.fetchWishes();
  }

  handleChangeTab(tabKey: string | null): void {
    this.setState({ tabKey: tabKey || 'cast' });
    ctx.router.saveState({ tabKey });
  }

  handleCastClick(crew: Crew, evt: React.MouseEvent) {
    evt.preventDefault();
    ctx.router.navigateTo(`#/tmdb/person/${crew.id}`);
  }

  async handleWishListClick(action: string, evt: React.MouseEvent): Promise<void> {
    evt.preventDefault();
    const { tvshowId } = this.props;
    const { tvshow } = this.state;
    if (action === 'add') {
      await ctx.apiClient.addToWishList(
        tvshowId,
        tvshow?.name || '',
        MediaType.tvshow,
        tvshow?.poster_path || '',
        parseFloat(tvshow?.first_air_date || '0'),
        ctx.user?.name || '',
      );
      this.fetchWishes();
    } else if (action === 'remove') {
      await ctx.apiClient.removeFromWishList(tvshowId, ctx.user?.name || '');
      this.fetchWishes();
    }
  }

  getAudience(tvshow?: ShowResponse): number {
    if (tvshow) {
      const audiences = [];
      if ((tvshow as any).content_ratings?.results) {
        for (const country of (tvshow as any).content_ratings.results) {
          if (country.iso_3166_1 === 'US') {
            switch (country.rating) {
              case 'TV-Y': // "This program is designed to be appropriate for all children."
              case 'TV-Y7': audiences.push(0); break; // "This program is designed for children age 7 and above."
              case 'TV-G': // "Most parents would find this program suitable for all ages."
              case 'TV-PG': audiences.push(10); break; // "This program contains material that parents may find unsuitable for younger children."
              case 'TV-14': audiences.push(12); break; // "This program contains some material that many parents would find unsuitable for children under 14 years of age."
              case 'TV-MA': audiences.push(16); break; // "This program is specifically designed to be viewed by adults and therefore may be unsuitable for children under 17."
              case 'TV-NR': // "No rating information."
              default: break;
            }
          } else if (country.iso_3166_1 === 'ES') {
            switch (country.rating) {
              case 'TP':
              case '7': audiences.push(0); break; // "Suitable for all ages."
              case '10': audiences.push(10); break; // "Not recommended for children under 10. Not allowed in children's television series."
              case '12':
              case '13': audiences.push(12); break; // "Not recommended for children under 12. Not allowed air before 10:00 p.m. Some channels and programs are subject to exception."
              case '16': audiences.push(16); break; // "Not recommended for children under 16. Not allowed air before 10:30 p.m. Some channels and programs are subject to exception."
              case '18': audiences.push(18); break; // "Not recommended for persons under 18. Allowed between midnight and 5 a.m. and only in some channels, access to these programs is locked by a personal password."
              case 'NR': // "No rating information."
              default: break;
            }
          } else if (country.iso_3166_1 === 'FR') {
            switch (country.rating) {
              case '10': audiences.push(10); break; // "Not recommended for children under 10. Not allowed in children's television series."
              case '12': audiences.push(12); break; // "Not recommended for children under 12. Not allowed air before 10:00 p.m. Some channels and programs are subject to exception."
              case '16': audiences.push(16); break; // "Not recommended for children under 16. Not allowed air before 10:30 p.m. Some channels and programs are subject to exception."
              case '18': audiences.push(18); break; // "Not recommended for persons under 18. Allowed between midnight and 5 a.m. and only in some channels, access to these programs is locked by a personal password."
              case 'NR': // "No rating information."
              default: break;
            }
          }
        }
      }
      return (audiences.length) ? Math.max.apply(null, audiences) : 999;
    }
    return 999;
  }

  async fetchTvshow(): Promise<void> {
    const { tvshowId } = this.props;
    const tvshow = await ctx.tmdbClient?.getTvshow(tvshowId);
    const credits = await ctx.tmdbClient?.getTvshowCredits(tvshowId);
    this.setState({ tvshow, credits });
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
    const { tvshowId } = this.props;
    const {
      tvshow, credits, tabKey, wishes,
    } = this.state;
    if (!tvshow) {
      return <div className="d-flex justify-content-center mt-5"><Spinner animation="border" variant="light" /></div>;
    }
    const year: number = parseFloat(tvshow?.first_air_date || '0');
    const directors: Crew[] | undefined = credits?.crew?.filter((c) => c.job === 'Director').slice(0, 5);
    const writers: Crew[] | undefined = credits?.crew?.filter((c) => c.job === 'Writer').slice(0, 5);
    const isWished: boolean = !!wishes.find((w) => w.tmdbid === tvshowId && !!w.users.find((uw) => uw.userName === ctx.user?.name));
    return (
      <div className="media-details movie" style={{ background: `linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6))${tvshow.backdrop_path ? `, url(${ctx.tmdbClient?.baseUrl}w1280${tvshow.backdrop_path}) 100% 0% / cover fixed` : ''}` }}>
        <div className="position-fixed" style={{ top: '65px', left: '1rem' }}>
          <a href="#" className="link-light" onClick={(evt) => { evt.preventDefault(); window.history.back(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-arrow-left" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
            </svg>
          </a>
        </div>
        <div className="media-poster">
          <span className="poster" style={{ backgroundImage: tvshow.poster_path ? `url(${ctx.tmdbClient?.baseUrl}w780${tvshow.poster_path})` : '' }} />
        </div>
        <div className="title-bar">
          <div className="d-flex align-items-center">
            <div className="flex-grow-1">
              <h2>{tvshow.name}</h2>
              {tvshow?.original_name && tvshow.original_name !== tvshow.name ? <h6>{tvshow.original_name}</h6> : null}
              <div>
                {year > 0 ? year : ''}
                &emsp;
                {tvshow?.number_of_seasons}
                &nbsp;
                {tvshow?.number_of_seasons && tvshow?.number_of_seasons > 1 ? 'saisons' : 'saison'}
                &emsp;
                {tvshow?.number_of_episodes}
                &nbsp;épisodes
                &emsp;
                <img src={`/images/classification/${this.getAudience(tvshow)}.svg`} alt="audience" width="18px" />
              </div>
            </div>
            {tvshow.vote_average ? <Rating value={tvshow.vote_average} type="tv" tmdbid={tvshow.id} /> : undefined}
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
                <span className="dd">{ tvshow?.genres ? tvshow?.genres.filter((genre) => !!genre.name).map((genre) => genre.name).join(', ') : '' }</span>
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
            <p className="synopsis">{tvshow.overview}</p>
          </div>
          <Tabs id="cast-similar-tabs" activeKey={tabKey} onSelect={this.handleChangeTab.bind(this)} className="constrained-width" mountOnEnter>
            <Tab eventKey="cast" title="Casting">
              <TmdbCasting cast={credits?.cast} />
            </Tab>
            <Tab eventKey="similar" title="Recommandations">
              <TmdbTvshowRecommandations tvshowId={tvshowId} hidden={tabKey !== 'similar'} />
            </Tab>
            <Tab eventKey="trailers" title="Videos">
              <YoutubeVideos search={tvshow?.name || ''} />
            </Tab>
          </Tabs>
        </div>
      </div>
    );
  }
}
