import React from 'react';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';

import { MediaType } from '../../api/src/enums';
import {
  DbUser, DbDownload, DbWish, UserWish,
} from '../../api/src/types';
import {
  ctx, renderFileSize, renderRelativeTimeString,
} from './common';
import ImportDownloadForm from './import-download-form';

type NewsProps = {
  users: DbUser[];
};
type NewsState = {
  wishes?: DbWish[];
  downloads?: DbDownload[];
  showAllDownloads: boolean;
  importingDownload?: DbDownload;
};

export default class News extends React.Component<NewsProps, NewsState> {
  constructor(props: NewsProps) {
    super(props);
    this.state = { showAllDownloads: false };
    this.refreshWishes();
    this.refreshDownloads();
    // ctx.eventBus.replace('will-navigate', ctx.router.saveScrollPosition.bind(ctx.router));
  }

  componentDidUpdate(/* _prevProps: NewsProps, prevState: NewsState */) {
    // const { movies } = this.state;
    // if (prevState.movies.length === 0 && movies.length > 0) {
    //   ctx.router.restoreScrollPosition();
    // }
    if (ctx.apiClient.needRefresh('wishes')) {
      this.refreshWishes();
    }
    if (ctx.apiClient.needRefresh('downloads')) {
      this.refreshDownloads();
    }
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

  handleImportDownloadClick(download: DbDownload, evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    this.setState({ importingDownload: download });
  }

  handleImportFormClose(): void {
    this.setState({ importingDownload: undefined });
    this.refreshDownloads();
  }

  refreshWishes() {
    ctx.apiClient.getWishes().then((wishes) => { this.setState({ wishes }); });
  }

  refreshDownloads() {
    ctx.apiClient.getDownloads().then((downloads) => { this.setState({ downloads }); });
  }

  render(): JSX.Element {
    const {
      wishes, downloads, showAllDownloads, importingDownload,
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
            <Button variant="dark" onClick={() => this.setState({ showAllDownloads: !showAllDownloads })} title={showAllDownloads ? 'Afficher seulement les nouveaux' : 'Afficher tout'}>...</Button>
          </h4>
          <div className="d-flex flex-wrap -justify-content-evenly mt-3">
            {
              downloads.filter((dn) => (dn.progress === 100 && !dn.imported && !dn.ignored) || showAllDownloads).reverse()
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
                          <span className="opacity-50 mx-3 align-self-center" title={(new Date(download.finished || download.started)).toLocaleString()}>{renderRelativeTimeString(download.finished || download.started)}</span>
                          <Button className={`ms-auto align-self-center${isNew ? '' : '  d-none'}`} variant="link" onClick={this.handleIgnoreDownloadClick.bind(this, download.path)}>Ignorer</Button>
                          <Button variant="primary" className={isNew ? '' : ' invisible'} onClick={this.handleImportDownloadClick.bind(this, download)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                            </svg>
                            &ensp;Importer
                          </Button>
                          <Button className={`ms-auto align-self-center${isIgnored ? '' : ' d-none'}`} variant="link" onClick={this.handleIgnoreDownloadClick.bind(this, download.path)}>Importer</Button>
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
    return (
      <>
        {downloadJsx}
        {wishesJsx}
      </>
    );
  }
}

/* }            <h4 className="mb-3">

            </h4>
            {
              wishesByUser[ctx.user.name].map((wish: DbWish) => (
                <div className="d-flex mb-3" key={wish.tmdbid}>
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
                      {' '}
                      {(new Date((wish.users.find((wu) => wu.userName === ctx.user?.name) as UserWish).added)).toLocaleDateString()}
                    </span>
                  </Button>
                  <Button variant="danger" onClick={this.handleDeleteWishClick.bind(this, wish.tmdbid)} title="Supprimer de la liste d'envies">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-x-circle-fill" viewBox="0 0 16 16">
                      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />
                    </svg>
                  </Button>
                </div>
              ))
            }

          </div>
        </>
        <Offcanvas
          className="offcanvas-size-xl"
          id="offcanvasNavbar-expand"
          aria-labelledby="offcanvasNavbarLabel-expand"
          placement="end"
          show={optionsVisible}
          onHide={this.handleOptionsToggle.bind(this, false)}
        >
          <Offcanvas.Header closeButton>
            <Nav variant="tabs">
              <Nav.Item><Nav.Link className="px-3" href="#" onClick={this.handleOffCanvasTabCLick.bind(this, 'order')} active={false}>Tri</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link className="px-3" href="#" onClick={this.handleOffCanvasTabCLick.bind(this, 'downloads')} active={false}>Téléchargements</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link className="px-3" href="#" onClick={this.handleOffCanvasTabCLick.bind(this, 'wishlist')} active>Liste d&apos;envies</Nav.Link></Nav.Item>
            </Nav>
          </Offcanvas.Header>
          <Offcanvas.Body>
            {users.filter((user) => user.name !== ctx.user?.name && wishesByUser[user.name].length).map((user) => (
              <>
                <hr />
                <h4 className="mb-3">
                  <img src={`/images/users/${user.name}.svg`} alt={user.name} width="24" className="me-3" />
                  <span className="text-uppercase">{user.name}</span>
                </h4>
                {
                  wishesByUser[user.name].map((wish: DbWish) => (
                    <div className="d-flex mb-3" key={wish.tmdbid}>
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
                      <Button variant="danger" onClick={this.handleDeleteWishClick.bind(this, wish.tmdbid)} className={ctx.user?.admin ? '' : 'd-none'} title="Supprimer de la liste d'envies">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-x-circle-fill" viewBox="0 0 16 16">
                          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />
                        </svg>
                      </Button>
                    </div>
                  ))
                } */
