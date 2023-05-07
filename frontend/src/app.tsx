import React from 'react';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import InputGroup from 'react-bootstrap/InputGroup';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Offcanvas from 'react-bootstrap/Offcanvas';
import Spinner from 'react-bootstrap/Spinner';

import {
  DbUser, DbDownload, DbWish, UserWish,
} from '../../api/src/types';
import { OrderBy, MediaType } from '../../api/src/enums';

import {
  ctx, initContext, renderFileSize, renderRelativeTimeString,
} from './common';
import { MatchedRoute } from './router';
import Home from './home';
import Movies from './movies';
import MovieDetails from './movie-details';
import TmdbMovieDetails from './tmdb-movie-details';
import TmdbTvshowDetails from './tmdb-tvshow-details';
import TmdbPersonDetails from './tmdb-person-details';
import TvShows from './tvshows';
import TvshowDetails from './tvshow-details';
import UserSelection from './user-selection';
import SearchResults from './search-results';

const SCAN_POLL_INTERVAL: number = 1000;

type AppProps = {};
type AppState = {
  users: DbUser[];
  optionsVisible: boolean;
  route: MatchedRoute;
  orderBy: OrderBy;
  search: string;
  searchInputValue: string;
  scanning: boolean;
  scanLogs: string;
  offcanvasTab: string;
  wishes?: DbWish[];
  downloads?: DbDownload[];
};

export default class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.handleEventHashChanged = this.handleEventHashChanged.bind(this);
    this.handleEventWillNavigate = this.handleEventWillNavigate.bind(this);
    this.handleEventWishesChanged = this.handleEventWishesChanged.bind(this);
    const orderBy = (localStorage.getItem('orderBy') || 'addedDesc') as OrderBy;
    this.state = {
      users: [],
      optionsVisible: false,
      route: { name: 'home' },
      orderBy,
      search: '',
      searchInputValue: '',
      scanning: false,
      scanLogs: '',
      offcanvasTab: 'order',
    };
    ctx.apiClient.getConfig().then((config) => initContext(config));
    ctx.apiClient.getScanProgress(0).then((status) => {
      this.setState({ scanning: !status.finished, scanLogs: status.logs });
      this.initPollScan(status.finished);
    });
    ctx.apiClient.getUsers().then((users) => {
      const userName = localStorage.getItem('userName');
      let user;
      for (const u of users) {
        if (u.name === userName) {
          user = u;
        }
      }
      ctx.user = user;
      this.setState({ users });
    });
    ctx.router.add('home', '/home');
    ctx.router.add('movies', '/movies');
    ctx.router.add('tmdb-movie-details', '/tmdb/movie/:id');
    ctx.router.add('tmdb-tvshow-details', '/tmdb/tvshow/:id');
    ctx.router.add('tmdb-person-details', '/tmdb/person/:id');
    ctx.router.add('movie-details', '/movie/:id');
    ctx.router.add('tvshows', '/tvshows');
    ctx.router.add('tvshow-details', '/tvshow/:id');
  }

  componentDidMount() {
    // l'événement "search" n'est pas géré par FormControl => on se replie sur du vanillaJS
    document?.getElementById('search-input')?.addEventListener('search', (evt) => this.setState({ search: (evt?.target as HTMLInputElement).value || '' }));
    ctx.eventBus.on('hash-changed', this.handleEventHashChanged);
    ctx.eventBus.on('will-navigate-app', this.handleEventWillNavigate);
    ctx.eventBus.on('wishes-changed', this.handleEventWishesChanged);
  }

  componentDidUpdate(): void {
    if (ctx.apiClient.needRefresh('wishes')) {
      ctx.apiClient.getWishes().then((wishes) => {
        this.setState({ wishes });
      });
    }
    if (ctx.apiClient.needRefresh('downloads')) {
      ctx.apiClient.getDownloads().then((downloads) => {
        this.setState({ downloads });
      });
    }
  }

  componentWillUnmount() {
    ctx.eventBus.detach('hash-changed', this.handleEventHashChanged);
    ctx.eventBus.detach('will-navigate-app', this.handleEventWillNavigate);
    ctx.eventBus.detach('wishes-changed', this.handleEventWishesChanged);
  }

  handleEventWishesChanged(): void {
    const { offcanvasTab } = this.state;
    if (offcanvasTab === 'wishlist') {
      ctx.apiClient.getWishes().then((wishes) => this.setState({ wishes }));
    }
  }

  handleEventHashChanged(data: any): void {
    if (data.route.state?.search) {
      this.setState({ search: data.route.state.search, searchInputValue: data.route.state.search });
    }
    this.setState(data);
  }

  handleEventWillNavigate(): void {
    const { search } = this.state;
    if (search) {
      ctx.router.saveState({ search });
      this.setState({ search: '', searchInputValue: '' });
    }
  }

  handleOptionsToggle(isVisible: boolean): void {
    this.setState({ optionsVisible: isVisible });
  }

  handleUserSelected(user?: DbUser): void {
    ctx.user = user;
    this.forceUpdate();
    localStorage.setItem('userName', user ? user.name : 'none');
  }

  handleOrderClick(orderBy: OrderBy): void {
    localStorage.setItem('orderBy', orderBy);
    this.setState({ orderBy, optionsVisible: false });
  }

  handleSearchChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ searchInputValue: evt.target.value });
  }

  handleSearchKeyDown(evt: React.KeyboardEvent<HTMLInputElement>): void {
    if (evt.key === 'Enter') {
      const { searchInputValue } = this.state;
      this.setState({ search: searchInputValue });
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  handleSearchClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    const { searchInputValue } = this.state;
    this.setState({ search: searchInputValue });
    evt.preventDefault();
  }

  handleServerClick(host: string, evt: React.MouseEvent<HTMLButtonElement>): void {
    document.location.href = `http://${host}/frontend/`;
    evt.preventDefault();
  }

  handleScanClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    const { scanning } = this.state;
    if (!scanning) {
      ctx.apiClient.scanNow().then((status) => {
        this.setState({ optionsVisible: true, scanning: !status.finished, scanLogs: status.logs });
        this.initPollScan(status.finished);
      });
    }
  }

  async handleOffCanvasTabCLick(tab: string, evt: React.MouseEvent<HTMLAnchorElement>): Promise<void> {
    evt.preventDefault();
    this.setState({ offcanvasTab: tab });
    let { wishes, downloads } = this.state;
    if (tab === 'wishlist' && wishes === undefined) {
      wishes = await ctx.apiClient.getWishes();
      this.setState({ wishes });
    }
    if (tab === 'downloads' && downloads === undefined) {
      downloads = await ctx.apiClient.getDownloads();
      this.setState({ downloads });
    }
  }

  handleWishClick(url: string, evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    ctx.router.navigateTo(url);
  }

  async handleDeleteWishClick(id: number, evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    if (ctx.user) {
      await ctx.apiClient.removeFromWishList(id, ctx.user.name);
      const wishes = await ctx.apiClient.getWishes();
      this.setState({ wishes });
    }
  }

  initPollScan(finished: boolean) {
    if (finished) {
      ctx.apiClient.clearCache();
      this.setState({ optionsVisible: false });
    } else {
      setTimeout(this.pollScanProgress.bind(this), SCAN_POLL_INTERVAL);
    }
  }

  pollScanProgress() {
    const { scanLogs } = this.state;
    ctx.apiClient.getScanProgress(scanLogs.length).then((status) => {
      this.setState({ scanning: !status.finished, scanLogs: scanLogs + status.logs });
      this.initPollScan(status.finished);
    });
  }

  render(): JSX.Element {
    const {
      users, route, orderBy, search, searchInputValue, scanning, scanLogs, optionsVisible, offcanvasTab,
    } = this.state;
    let content: JSX.Element = <div />;
    if (!users.length) {
      content = <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-light" /></div>;
    } else if (!ctx.user) {
      content = <UserSelection users={users} onValidation={this.handleUserSelected.bind(this)} />;
    } else if (route.name === 'home') {
      content = <Home />;
    } else if (route.name === 'movies') {
      content = <Movies orderBy={orderBy} />;
    } else if (route.name === 'movie-details' && route.id) {
      content = <MovieDetails movieId={route.id} />;
    } else if (route.name === 'tmdb-movie-details' && route.id) {
      content = <TmdbMovieDetails movieId={route.id} />;
    } else if (route.name === 'tvshows') {
      content = <TvShows orderBy={orderBy} />;
    } else if (route.name === 'tvshow-details' && route.id) {
      content = <TvshowDetails tvshowId={route.id} />;
    } else if (route.name === 'tmdb-tvshow-details' && route.id) {
      content = <TmdbTvshowDetails tvshowId={route.id} />;
    } else if (route.name === 'tmdb-person-details' && route.id) {
      content = <TmdbPersonDetails personId={route.id} />;
    }

    let offcanvas: JSX.Element = <></>;
    if (offcanvasTab === 'order') {
      offcanvas = (
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
              <Nav.Item><Nav.Link className="px-3" href="#" onClick={this.handleOffCanvasTabCLick.bind(this, 'order')} active>Tri</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link className="px-3" href="#" onClick={this.handleOffCanvasTabCLick.bind(this, 'downloads')} active={false}>Téléchargements</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link className="px-3" href="#" onClick={this.handleOffCanvasTabCLick.bind(this, 'wishlist')} active={false}>Liste d&apos;envies</Nav.Link></Nav.Item>
            </Nav>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <ButtonToolbar className="mb-3">
              <Form.Label className="label-aligned">Date d&apos;ajout</Form.Label>
              <ButtonGroup className="flex-fill">
                <Button variant={orderBy === OrderBy.addedDesc ? 'secondary' : 'outline-secondary'} onClick={this.handleOrderClick.bind(this, OrderBy.addedDesc)}>+ Récent</Button>
                <Button variant={orderBy === OrderBy.addedAsc ? 'secondary' : 'outline-secondary'} onClick={this.handleOrderClick.bind(this, OrderBy.addedAsc)}>+ Ancien</Button>
              </ButtonGroup>
            </ButtonToolbar>
            <ButtonToolbar className="mb-3">
              <Form.Label className="label-aligned">Titre</Form.Label>
              <ButtonGroup className="flex-fill">
                <Button variant={orderBy === OrderBy.titleAsc ? 'secondary' : 'outline-secondary'} onClick={this.handleOrderClick.bind(this, OrderBy.titleAsc)}>A &ndash; Z</Button>
                <Button variant={orderBy === OrderBy.titleDesc ? 'secondary' : 'outline-secondary'} onClick={this.handleOrderClick.bind(this, OrderBy.titleDesc)}>Z &ndash; A</Button>
              </ButtonGroup>
            </ButtonToolbar>
            <ButtonToolbar className="mb-3">
              <Form.Label className="label-aligned">Nom de fichier</Form.Label>
              <ButtonGroup className="flex-fill">
                <Button variant={orderBy === OrderBy.filenameAsc ? 'secondary' : 'outline-secondary'} onClick={this.handleOrderClick.bind(this, OrderBy.filenameAsc)}>A &ndash; Z</Button>
                <Button variant={orderBy === OrderBy.filenameDesc ? 'secondary' : 'outline-secondary'} onClick={this.handleOrderClick.bind(this, OrderBy.filenameDesc)}>Z &ndash; A</Button>
              </ButtonGroup>
            </ButtonToolbar>
            <ButtonToolbar className="mb-3">
              <Form.Label className="label-aligned">Année</Form.Label>
              <ButtonGroup className="flex-fill">
                <Button variant={orderBy === OrderBy.yearDesc ? 'secondary' : 'outline-secondary'} onClick={this.handleOrderClick.bind(this, OrderBy.yearDesc)}>+ Récent</Button>
                <Button variant={orderBy === OrderBy.yearAsc ? 'secondary' : 'outline-secondary'} onClick={this.handleOrderClick.bind(this, OrderBy.yearAsc)}>+ Ancien</Button>
              </ButtonGroup>
            </ButtonToolbar>
            <div className={ctx.user?.admin ? '' : 'd-none'}>
              <hr />
              <Offcanvas.Title>Admin</Offcanvas.Title>
              <ButtonToolbar className="my-3">
                <ButtonGroup className="flex-fill">
                  <Button variant={document.location.host === '127.0.0.1:3000' ? 'secondary' : 'outline-secondary'} onClick={this.handleServerClick.bind(this, '127.0.0.1:3000')}>127.0.0.1:3000</Button>
                  <Button variant={document.location.host === '192.168.0.99:3000' ? 'secondary' : 'outline-secondary'} onClick={this.handleServerClick.bind(this, '192.168.0.99:3000')}>192.168.0.99:3000</Button>
                </ButtonGroup>
              </ButtonToolbar>
              <ButtonToolbar className="my-3">
                <Button variant="outline-secondary" className={`flex-fill${ctx.user?.admin && !scanning ? '' : ' disabled'}`} onClick={this.handleScanClick.bind(this)}>Scanner la bibliothèque</Button>
                <Spinner animation="border" role="status" className={scanning ? 'ms-3' : 'd-none'} />
              </ButtonToolbar>
              <div className="overflow-auto" style={{ height: '400px' }}>
                <pre>{scanLogs}</pre>
              </div>
            </div>
          </Offcanvas.Body>
        </Offcanvas>
      );
    } else if (offcanvasTab === 'downloads' && ctx.user) {
      const { downloads } = this.state;
      offcanvas = (
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
              <Nav.Item><Nav.Link className="px-3" href="#" onClick={this.handleOffCanvasTabCLick.bind(this, 'downloads')} active>Téléchargements</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link className="px-3" href="#" onClick={this.handleOffCanvasTabCLick.bind(this, 'wishlist')} active={false}>Liste d&apos;envies</Nav.Link></Nav.Item>
            </Nav>
          </Offcanvas.Header>
          <Offcanvas.Body>
            {downloads?.map((download) => {
              let { path } = download;
              if (download.path.startsWith(ctx.config.seedboxPath)) {
                path = download.path.substring(ctx.config.seedboxPath.length + 1);
              }
              const pathJsx: JSX.Element[] = [];
              for (const part of path.split('/')) {
                if (pathJsx.length > 0) {
                  pathJsx.push(<span key={pathJsx.length} className="flex-shrink-0">/</span>);
                }
                pathJsx.push(<span key={part} className="flex-shrink-1 text-truncate">{part}</span>);
              }
              return (
                <div key={path}>
                  <hr />
                  <div className="d-flex" title={path}>{pathJsx}</div>
                  <div className="d-flex opacity-50">
                    <span>{renderFileSize(download.size)}</span>
                    <span className="ms-auto">{renderRelativeTimeString(download.finished || download.started)}</span>
                  </div>
                </div>
              );
            })}
          </Offcanvas.Body>
        </Offcanvas>
      );
    } else if (offcanvasTab === 'wishlist' && ctx.user) {
      const { wishes } = this.state;
      const wishesByUser: any = {};
      for (const user of users) {
        wishesByUser[user.name] = wishes?.filter((w) => !!w.users.find((wu) => wu.userName === user.name)).reverse() || [];
      }
      offcanvas = (
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
            <h4 className="mb-3">
              <img src={`/images/users/${ctx.user.name}.svg`} alt={ctx.user.name} width="24" className="me-3" />
              <span className="text-uppercase">{ctx.user.name}</span>
            </h4>
            <div className={wishesByUser[ctx.user.name].length === 0 ? 'mb-3' : 'mb-3 d-none'}>
              Aucun élément
            </div>
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
              }
              </>
            ))}
          </Offcanvas.Body>
        </Offcanvas>
      );
    }

    return (
      <>
        <Navbar variant="dark" fixed="top" id="navbar">
          <Container fluid>
            <Nav className="me-auto">
              <Nav.Link href="#/home" active={route.name === 'home' && !search} style={{ lineHeight: '18px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-house-door-fill" viewBox="0 0 16 16"><path d="M6.5 14.5v-3.505c0-.245.25-.495.5-.495h2c.25 0 .5.25.5.5v3.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5z" /></svg>
              </Nav.Link>
              <Nav.Link href="#/movies" active={route.name === 'movies' && !search}>
                Films
              </Nav.Link>
              <Nav.Link href="#/tvshows" active={route.name === 'tvshows' && !search}>
                Séries
              </Nav.Link>
            </Nav>
            <Form className="d-flex">
              <InputGroup>
                <FormControl
                  id="search-input"
                  type="search"
                  placeholder="Recherche"
                  autoComplete="off"
                  value={searchInputValue}
                  onChange={this.handleSearchChange.bind(this)}
                  onKeyDown={this.handleSearchKeyDown.bind(this)}
                />
                <Button variant="dark" style={{ lineHeight: '18px' }} onClick={this.handleSearchClick.bind(this)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-search" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" /></svg></Button>
              </InputGroup>
              <Button variant="dark" className={`ms-1${scanning ? ' disabled' : ''}${ctx.user?.admin ? '' : ' d-none'}`} style={{ lineHeight: '18px' }} onClick={this.handleScanClick.bind(this)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
                </svg>
              </Button>
              <Button variant="dark" className="ms-1" style={{ lineHeight: '18px' }} onClick={this.handleOptionsToggle.bind(this, true)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-three-dots-vertical" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" /></svg></Button>
              {ctx.user ? <a href="#" style={{ textDecoration: 'none' }} onClick={this.handleUserSelected.bind(this, undefined)}><img src={`/images/users/${ctx.user.name}.svg`} alt={ctx.user.name} width="36" className="ms-3" /></a> : null}
            </Form>
            {offcanvas}
          </Container>
        </Navbar>
        <div className="mt-5 p-2">{search ? <SearchResults query={search} onClose={() => this.setState({ search: '', searchInputValue: '' })} /> : content}</div>
      </>
    );
  }
}
