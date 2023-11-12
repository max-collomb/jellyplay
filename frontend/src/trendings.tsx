import React from 'react';

import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import Spinner from 'react-bootstrap/Spinner';

import { MovieResult, TvResult } from 'moviedb-promise/dist/request-types';
import { MediaType } from '../../api/src/enums';
import {
  DbUser, DbWish, UserWish,
} from '../../api/src/types';

import { ctx } from './common';
import { Trending } from './tmdb-client';
import { YggItem } from './ygg-client';

const torrentDownloaded: string[] = [];

type TrendingProps = {
  users: DbUser[];
};
type TrendingState = {
  wishes?: DbWish[];
  trending?: Trending;
  trendingTimeWindow: 'day' | 'week';
  tops?: YggItem[];
  topsTimeWindow: 'day' | 'week' | 'month';
  yggItemDetails?: YggItem;
};

export default class Trendings extends React.Component<TrendingProps, TrendingState> {
  timer: NodeJS.Timer | undefined = undefined;

  constructor(props: TrendingProps) {
    super(props);
    this.state = {
      trendingTimeWindow: localStorage.getItem('trendingTimeWindow') === 'day' ? 'day' : 'week',
      topsTimeWindow: localStorage.getItem('topsTimeWindow') === 'month' ? 'month' : (localStorage.getItem('topsTimeWindow') === 'week' ? 'week' : 'day'),
    };
    this.refreshWishes();
    this.refreshTops();
    // ctx.eventBus.replace('will-navigate', ctx.router.saveScrollPosition.bind(ctx.router));
  }

  componentDidMount(): void {
    this.refreshTrending();
  }

  componentDidUpdate(_prevProps: TrendingProps, prevState: TrendingState) {
    const { yggItemDetails } = this.state;
    // if (prevState.movies.length === 0 && movies.length > 0) {
    //   ctx.router.restoreScrollPosition();
    // }
    if (ctx.apiClient.needRefresh('wishes')) {
      this.refreshWishes();
    }
    if (!prevState.yggItemDetails?.id && yggItemDetails?.id) {
      document.getElementById('ygg-iframe')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  componentWillUnmount(): void {
    clearInterval(this.timer);
  }

  handleWishClick(url: string, evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    ctx.router.navigateTo(url);
  }

  async handleDeleteWishClick(id: number, username: string, evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    if (ctx.user) {
      await ctx.apiClient.removeFromWishList(id, username);
      const wishes = await ctx.apiClient.getWishes();
      this.setState({ wishes });
    }
  }

  handleYggDetailsClick(yggItem: YggItem, evt: React.MouseEvent<HTMLAnchorElement>): void {
    evt.preventDefault();
    if (ctx.yggClient.isCloudFlareActive) {
      document.location.href = `browser://${encodeURIComponent(yggItem.detailLink)}`;
      return;
    }
    const { yggItemDetails } = this.state;
    this.setState({ yggItemDetails: yggItemDetails?.id === yggItem.id ? undefined : yggItem });
  }

  async handleYggDownloadClick(yggItem: YggItem, evt: React.MouseEvent<HTMLAnchorElement>): Promise<void> {
    evt.preventDefault();
    if (ctx.yggClient.isCloudFlareActive) {
      alert('Le téléchargement ne fonctionne pas pour le moment.\nUtliser la liste d\'envies'); // eslint-disable-line no-alert
      return;
    }
    if (await ctx.yggClient.download(yggItem.downloadLink)) {
      torrentDownloaded.push(yggItem.id);
      this.forceUpdate();
    } else {
      alert('Une erreur est survenue'); // eslint-disable-line no-alert
    }
  }

  handleTrendingTimeWindowClick(timeWidow: 'day' | 'week'): void {
    localStorage.setItem('trendingTimeWindow', timeWidow);
    this.setState({ trendingTimeWindow: timeWidow, trending: undefined }, this.refreshTrending.bind(this));
  }

  handleTopsTimeWindowClick(timeWidow: 'day' | 'week' | 'month'): void {
    localStorage.setItem('topsTimeWindow', timeWidow);
    this.setState({ topsTimeWindow: timeWidow, tops: undefined }, this.refreshTops.bind(this));
  }

  refreshWishes(): void {
    ctx.apiClient.getWishes().then((wishes) => { this.setState({ wishes }); });
  }

  refreshTops(): void {
    const { topsTimeWindow } = this.state;
    ctx.yggClient.getTops(topsTimeWindow).then((tops) => { this.setState({ tops }); });
  }

  async refreshTrending() {
    const { trendingTimeWindow } = this.state;
    this.setState({ trending: await ctx.tmdbClient.getTrending(trendingTimeWindow) });
  }

  render(): JSX.Element {
    const {
      wishes, trending, trendingTimeWindow, tops, topsTimeWindow, yggItemDetails,
    } = this.state;
    const { users } = this.props;

    let wishesJsx: JSX.Element = <></>;
    if (wishes && users) {
      const wishesByUser: any = {};
      for (const user of users) {
        wishesByUser[user.name] = wishes?.filter((w) => !!w.users.find((wu) => wu.userName === user.name)).reverse() || [];
      }
      wishesJsx = (
        <>
          <h4 className="section-title">Listes d&apos;envies</h4>
          <div className="d-flex flex-wrap -justify-content-evenly mt-3">
            {
              users.map((user) => (
                <Card className="wishlist-card" key={user.name}>
                  <Card.Body>
                    <Card.Title>
                      <img src={`/images/users/${user.name}.svg`} alt={user.name} width="24" className="me-3" />
                      <span className="text-uppercase">{user.name}</span>
                    </Card.Title>
                    <div className={wishesByUser[user.name].length === 0 ? 'mb-3' : 'mb-3 d-none'}>
                      Aucun élément
                    </div>
                    {
                      wishesByUser[user.name].map((wish: DbWish) => (
                        <div className="d-flex mt-3" key={wish.tmdbid}>
                          <Button variant="dark" className="d-block flex-grow-1 wish-link text-start" key={wish.tmdbid} onClick={this.handleWishClick.bind(this, `#/tmdb/${wish.type}/${wish.tmdbid}/state/${JSON.stringify({ tabKey: 'cast' })}`)}>
                            {wish.title}
                            <span className="year">{wish.year}</span>
                            <br />
                            {
                              wish.type === MediaType.movie
                                ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-camera-video" viewBox="0 0 16 16">
                                    <path fillRule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556v4.35zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H2z" />
                                  </svg>
                                )
                                : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-display" viewBox="0 0 16 16">
                                    <path d="M0 4s0-2 2-2h12s2 0 2 2v6s0 2-2 2h-4c0 .667.083 1.167.25 1.5H11a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1h.75c.167-.333.25-.833.25-1.5H2s-2 0-2-2V4zm1.398-.855a.758.758 0 0 0-.254.302A1.46 1.46 0 0 0 1 4.01V10c0 .325.078.502.145.602.07.105.17.188.302.254a1.464 1.464 0 0 0 .538.143L2.01 11H14c.325 0 .502-.078.602-.145a.758.758 0 0 0 .254-.302 1.464 1.464 0 0 0 .143-.538L15 9.99V4c0-.325-.078-.502-.145-.602a.757.757 0 0 0-.302-.254A1.46 1.46 0 0 0 13.99 3H2c-.325 0-.502.078-.602.145z" />
                                  </svg>
                                )
                            }
                            &emsp;
                            <span className="added">
                              Ajouté le&nbsp;
                              {(new Date((wish.users.find((wu) => wu.userName === user.name) as UserWish).added)).toLocaleDateString()}
                            </span>
                          </Button>
                          <Button variant="danger" onClick={this.handleDeleteWishClick.bind(this, wish.tmdbid, user.name)} className={ctx.user?.admin || ctx.user?.name === user.name ? '' : 'd-none'} title="Supprimer de la liste d'envies">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-x-circle-fill" viewBox="0 0 16 16">
                              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />
                            </svg>
                          </Button>
                        </div>
                      ))
                    }
                  </Card.Body>
                </Card>
              ))
            }
          </div>
        </>
      );
    }

    let trendingJsx: JSX.Element = <></>;
    if (trending) {
      trendingJsx = (
        <>
          <h4 className="section-title">
            Tendances &ndash; films
            <ButtonGroup className="ms-5">
              <Button variant={trendingTimeWindow === 'day' ? 'secondary' : 'outline-secondary'} onClick={this.handleTrendingTimeWindowClick.bind(this, 'day')}>Aujourd&#39;hui</Button>
              <Button variant={trendingTimeWindow === 'week' ? 'secondary' : 'outline-secondary'} onClick={this.handleTrendingTimeWindowClick.bind(this, 'week')}>Cette semaine</Button>
            </ButtonGroup>
          </h4>
          <div className="d-flex flex-wrap -justify-content-evenly mt-3">
            {
              trending.movies.map((movie: MovieResult) => (
                <div key={movie.id} className="media-card movie" onClick={(evt: React.MouseEvent) => { evt.preventDefault(); ctx.router.navigateTo(`#/tmdb/movie/${movie.id}/state/${JSON.stringify({ tabKey: 'cast' })}`); }}>
                  <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w342${movie.poster_path})` }} />
                  <span className="title">{movie.title}</span>
                  <span className="infos d-flex justify-content-between">
                    <span className="year">{movie.release_date?.substring(0, 4)}</span>
                  </span>
                </div>
              ))
            }
          </div>
          <h4 className="section-title">
            Tendances &ndash; séries
            <ButtonGroup className="ms-5">
              <Button variant={trendingTimeWindow === 'day' ? 'secondary' : 'outline-secondary'} onClick={this.handleTrendingTimeWindowClick.bind(this, 'day')}>Aujourd&#39;hui</Button>
              <Button variant={trendingTimeWindow === 'week' ? 'secondary' : 'outline-secondary'} onClick={this.handleTrendingTimeWindowClick.bind(this, 'week')}>Cette semaine</Button>
            </ButtonGroup>
          </h4>
          <div className="d-flex flex-wrap -justify-content-evenly mt-3">
            {
              trending.tvshows.map((movie: TvResult) => (
                <div key={movie.id} className="media-card movie" onClick={(evt: React.MouseEvent) => { evt.preventDefault(); ctx.router.navigateTo(`#/tmdb/tvshow/${movie.id}/state/${JSON.stringify({ tabKey: 'cast' })}`); }}>
                  <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w342${movie.poster_path})` }} />
                  <span className="title">{movie.name}</span>
                  <span className="infos d-flex justify-content-between">
                    <span className="year">{movie.first_air_date?.substring(0, 4)}</span>
                  </span>
                </div>
              ))
            }
          </div>
        </>
      );
    }

    const topsTitle = (
      <h4 className="section-title">
        Top torrents
        <ButtonGroup className="ms-5">
          <Button variant={topsTimeWindow === 'day' ? 'secondary' : 'outline-secondary'} onClick={this.handleTopsTimeWindowClick.bind(this, 'day')}>Aujourd&#39;hui</Button>
          <Button variant={topsTimeWindow === 'week' ? 'secondary' : 'outline-secondary'} onClick={this.handleTopsTimeWindowClick.bind(this, 'week')}>Cette semaine</Button>
          <Button variant={topsTimeWindow === 'month' ? 'secondary' : 'outline-secondary'} onClick={this.handleTopsTimeWindowClick.bind(this, 'month')}>Ce mois-ci</Button>
        </ButtonGroup>
      </h4>
    );

    let topsJsx = (
      <>
        {topsTitle}
        <div className="text-center m-5"><Spinner animation="border" variant="light" /></div>
      </>
    );
    if (tops) {
      topsJsx = (
        <>
          {topsTitle}
          <table className="table table-bordered table-striped" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Nom</th>
                <th style={{ width: '100px' }}>Age</th>
                <th style={{ width: '100px' }}>Taille</th>
                <th style={{ width: '75px' }}>Seed</th>
              </tr>
            </thead>
            <tbody>
              {tops.map((top: YggItem) => (
                <React.Fragment key={top.id}>
                  <tr>
                    <td>
                      <div className="d-flex">
                        <Badge bg={top.category === 'movies' ? 'primary' : (top.category === 'tvshows' ? 'secondary' : 'warning')} className="align-self-center me-3">{top.category === 'movies' ? 'Film' : (top.category === 'tvshows' ? 'Série' : 'Emission')}</Badge>
                        <a href={top.detailLink} onClick={this.handleYggDetailsClick.bind(this, top)} className={top.size > (top.category === 'tvshows' ? 2 : 5) * 1073741824 /* 1073741824 = 1Go */ ? 'opacity-50 flex-grow-1 text-truncate align-self-center' : 'flex-grow-1 text-truncate align-self-center'}>{top.name}</a>
                        { torrentDownloaded.includes(top.id) ? <Button variant="dark" className="mx-3" disabled title="Téléchargement en cours sur la seedbox">Téléchargement...</Button> : <a href="#" className="btn btn-success mx-3" onClick={this.handleYggDownloadClick.bind(this, top)}>Télécharger</a> }
                        <a href={`browser://${encodeURIComponent(top.detailLink)}`} className="align-self-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-box-arrow-up-right" viewBox="0 0 16 16">
                            <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
                            <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
                          </svg>
                        </a>
                      </div>
                    </td>
                    <td className="text-truncate" style={{ verticalAlign: 'middle' }}>{top.age.replace(/ /g, '\u00A0')}</td>
                    <td className="text-truncate" style={{ verticalAlign: 'middle' }}>{top.sizeStr}</td>
                    <td className="text-truncate" style={{ verticalAlign: 'middle' }}>{top.completed}</td>
                  </tr>
                  {top.id === yggItemDetails?.id
                    ? (
                      <tr>
                        <td colSpan={4}>
                          <iframe id="ygg-iframe" src={`/ygg/details?url=${encodeURIComponent(top.detailLink)}`} style={{ width: '100%', height: '75vh', maxHeight: '1000px' }} title="details" />
                        </td>
                      </tr>
                    )
                    : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </>
      );
    }
    return (
      <>
        {wishesJsx}
        {trendingJsx}
        {topsJsx}
      </>
    );
  }
}
