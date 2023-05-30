import React from 'react';

import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import Dropdown from 'react-bootstrap/Dropdown';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Spinner from 'react-bootstrap/Spinner';

import { MovieResult, TvResult } from 'moviedb-promise/dist/request-types';
import { MediaType } from '../../api/src/enums';
import {
  DbUser, DbDownload, DbWish, UserWish,
} from '../../api/src/types';

import {
  ctx, renderFileSize, renderRelativeTimeString,
} from './common';
import ImportDownloadForm from './import-download-form';
import { Trending } from './tmdb-client';
import { YggItem } from './ygg-client';

const torrentDownloaded: string[] = [];

interface CachedTrending {
  data: Trending;
  expiration: number;
}

type NewsProps = {
  users: DbUser[];
};
type NewsState = {
  wishes?: DbWish[];
  downloads?: DbDownload[];
  showAllDownloads: boolean;
  importingDownload?: DbDownload;
  trending?: Trending;
  tops?: YggItem[];
  yggItemDetails?: YggItem;
};

export default class News extends React.Component<NewsProps, NewsState> {
  timer: number | undefined = undefined;

  constructor(props: NewsProps) {
    super(props);
    this.state = { showAllDownloads: false };
    this.refreshWishes();
    this.refreshDownloads();
    this.refreshTops();
    // ctx.eventBus.replace('will-navigate', ctx.router.saveScrollPosition.bind(ctx.router));
  }

  componentDidMount(): void {
    this.refreshTrending();
    this.timer = setInterval(this.refreshDownloads.bind(this), 3000);
  }

  componentDidUpdate(_prevProps: NewsProps, prevState: NewsState) {
    const { yggItemDetails } = this.state;
    // if (prevState.movies.length === 0 && movies.length > 0) {
    //   ctx.router.restoreScrollPosition();
    // }
    if (ctx.apiClient.needRefresh('wishes')) {
      this.refreshWishes();
    }
    if (ctx.apiClient.needRefresh('downloads')) {
      this.refreshDownloads();
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

  async handleIgnoreDownloadClick(path: string, evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    await ctx.apiClient.ignoreDownload(path);
    this.refreshDownloads();
  }

  async handleDeleteDownload(path: string, evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    await ctx.apiClient.deleteDownload(path);
    this.refreshDownloads();
  }

  handleYggDetailsClick(yggItem: YggItem, evt: React.MouseEvent<HTMLAnchorElement>): void {
    evt.preventDefault();
    const { yggItemDetails } = this.state;
    this.setState({ yggItemDetails: yggItemDetails?.id === yggItem.id ? undefined : yggItem });
  }

  async handleYggDownloadClick(yggItem: YggItem, evt: React.MouseEvent<HTMLAnchorElement>): Promise<void> {
    evt.preventDefault();
    if (await ctx.yggClient.download(yggItem.downloadLink)) {
      torrentDownloaded.push(yggItem.id);
      this.forceUpdate();
    } else {
      alert('Une erreur est survenue'); // eslint-disable-line no-alert
    }
  }

  handleImportDownloadClick(download: DbDownload, evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    this.setState({ importingDownload: download });
  }

  handleImportFormClose(): void {
    this.setState({ importingDownload: undefined });
    this.refreshDownloads();
  }

  refreshWishes(): void {
    ctx.apiClient.getWishes().then((wishes) => { this.setState({ wishes }); });
  }

  refreshDownloads(): void {
    const { importingDownload } = this.state;
    if (!importingDownload) {
      ctx.apiClient.getDownloads().then((downloads) => { this.setState({ downloads }); });
    }
  }

  refreshTops(): void {
    ctx.yggClient.getTops().then((tops) => { this.setState({ tops }); });
  }

  async refreshTrending() {
    let trending: CachedTrending | null = JSON.parse(localStorage.getItem('trending') || '{}');
    //    if (!trending || trending.expiration < Date.now()) {
    trending = {
      data: await ctx.tmdbClient.getTrending(),
      expiration: Date.now() + 1000 * 60 * 60, // 1h
    };
    //    }
    this.setState({ trending: trending.data });
    localStorage.setItem('trending', JSON.stringify(trending));
  }

  render(): JSX.Element {
    const {
      wishes, downloads, showAllDownloads, importingDownload, trending, tops, yggItemDetails,
    } = this.state;
    const { users } = this.props;
    if (importingDownload) {
      return <ImportDownloadForm download={importingDownload} onClose={this.handleImportFormClose.bind(this)} />;
    }
    let downloadJsx: JSX.Element = <></>;
    if (downloads) {
      downloadJsx = (
        <>
          <h4 className="section-title">
            Té́léchargements
            &emsp;
            <ButtonGroup>
              <Button variant="dark" onClick={() => ctx.apiClient.checkSeedbox()} title="Télécharger nouveaux fichiers depuis la seedbox">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-cloud-download" viewBox="0 0 16 16">
                  <path d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
                  <path d="M7.646 15.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 14.293V5.5a.5.5 0 0 0-1 0v8.793l-2.146-2.147a.5.5 0 0 0-.708.708l3 3z" />
                </svg>
              </Button>
              <Button variant="dark" onClick={() => this.setState({ showAllDownloads: !showAllDownloads })} title={showAllDownloads ? 'Afficher seulement les nouveaux' : 'Afficher tout'}>
                {showAllDownloads
                  ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                    </svg>
                  )
                  : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-slash" viewBox="0 0 16 16">
                      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z" />
                      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z" />
                    </svg>
                  )}
              </Button>
            </ButtonGroup>
          </h4>
          <div className="d-flex flex-wrap -justify-content-evenly mt-3">
            {
              downloads.filter((dn) => (!dn.ignored && !dn.imported) || showAllDownloads).reverse()
                .map((download) => {
                  let { path } = download;
                  if (download.path.startsWith(ctx.config.seedboxPath)) path = download.path.substring(ctx.config.seedboxPath.length + 1);
                  const title = path;
                  const isNew = !download.imported && !download.ignored;
                  const isIgnored = !download.imported && download.ignored;
                  if (path.includes('/')) path = path.substring(path.lastIndexOf('/') + 1);
                  return (
                    <Card className="download-card" key={path}>
                      <Card.Body>
                        <div className="text-truncate" title={title}>{path}</div>
                        <div className="d-flex mt-3">
                          <span className="align-self-center">{renderFileSize(download.size)}</span>
                          {download.finished < 0
                            ? (
                              <>
                                <ProgressBar variant="primary" now={download.progress} label={`${download.progress.toFixed(1)}%`} className="flex-grow-1 align-self-center mx-3" />
                                <Button variant="danger" onClick={this.handleDeleteDownload.bind(this, download.path)} title="Supprimer (re-télécharger)" disabled={!ctx.user?.admin}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-x-circle-fill" viewBox="0 0 16 16">
                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />
                                  </svg>
                                </Button>
                              </>
                            )
                            : (
                              <>
                                <span className="opacity-50 mx-3 flex-grow-1 align-self-center" title={(new Date(download.finished)).toLocaleString()}>{renderRelativeTimeString(download.finished)}</span>
                                {(isIgnored
                                  ? <Button className="ms-auto align-self-center" variant="link" onClick={this.handleIgnoreDownloadClick.bind(this, download.path)}>Importer</Button>
                                  : (
                                    <Dropdown as={ButtonGroup}>
                                      <Button variant="primary" className={isNew ? '' : ' invisible'} onClick={this.handleImportDownloadClick.bind(this, download)}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                                          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                                          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                                        </svg>
                                        &ensp;Importer
                                      </Button>
                                      <Dropdown.Toggle split variant="primary" id="dropdown-custom-2" />
                                      <Dropdown.Menu>
                                        <Dropdown.Item eventKey="1" onClick={this.handleIgnoreDownloadClick.bind(this, download.path)} disabled={download.imported}>Ignorer</Dropdown.Item>
                                        <Dropdown.Item eventKey="2" onClick={this.handleDeleteDownload.bind(this, download.path)} disabled={!ctx.user?.admin}>Supprimer (re-télécharger)</Dropdown.Item>
                                      </Dropdown.Menu>
                                    </Dropdown>
                                  ))}
                              </>
                            )}
                        </div>
                      </Card.Body>
                    </Card>
                  );
                })
            }
          </div>
        </>
      );
    }

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
                              Ajouté le
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
          <h4 className="section-title">Tendances &ndash; films</h4>
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
          <h4 className="section-title">Tendances &ndash; séries</h4>
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

    let topsJsx = (
      <>
        <h4 className="section-title">Torrents du jour</h4>
        <div className="text-center m-5"><Spinner animation="border" variant="light" /></div>
      </>
    );
    if (tops) {
      topsJsx = (
        <>
          <h4 className="section-title">Torrents du jour</h4>
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
                          <iframe id="ygg-iframe" src={`/ygg/details?url=${encodeURIComponent(top.detailLink)}`} style={{ width: '100%', height: '80vh', maxHeight: '1000px' }} title="details" />
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
        {downloadJsx}
        {wishesJsx}
        {trendingJsx}
        {topsJsx}
      </>
    );
  }
}
