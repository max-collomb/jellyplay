import React from 'react';

import Badge from 'react-bootstrap/Badge';
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

import { DbDownload, DbUser } from '../../api/src/types';
import { OrderBy } from '../../api/src/enums';

import { ctx, initContext } from './common';
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
import Trendings from './trendings';
import Downloads from './downloads';

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
  downloadCount: number;
};

export default class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.handleEventHashChanged = this.handleEventHashChanged.bind(this);
    this.handleEventWillNavigate = this.handleEventWillNavigate.bind(this);
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
      downloadCount: 0,
    };
    ctx.apiClient.getConfig().then((json) => {
      initContext(json.config);
      localStorage.setItem('userName', json.userName);
      ctx.apiClient.getUsers().then((users) => {
        let user;
        for (const u of users) {
          if (u.name === json.userName) {
            user = u;
          }
        }
        ctx.user = user;
        document.body.classList.toggle('simplified-ui', !!user?.simplifiedUI);
        this.setState({ users });
      });
    });
    ctx.apiClient.getScanProgress(0).then((status) => {
      this.setState({ scanning: !status.finished, scanLogs: status.logs });
      this.initPollScan(status.finished);
    });
    ctx.apiClient.getDownloads().then((downloads) => {
      this.updateNewDownloadCount(downloads);
    });
    ctx.router.add('home', '/home');
    ctx.router.add('movies', '/movies');
    ctx.router.add('tmdb-movie-details', '/tmdb/movie/:id');
    ctx.router.add('tmdb-tvshow-details', '/tmdb/tvshow/:id');
    ctx.router.add('tmdb-person-details', '/tmdb/person/:id');
    ctx.router.add('movie-details', '/movie/:id');
    ctx.router.add('tvshows', '/tvshows');
    ctx.router.add('tvshow-details', '/tvshow/:id');
    ctx.router.add('trendings', '/trendings');
    ctx.router.add('downloads', '/downloads');
  }

  componentDidMount() {
    // l'événement "search" n'est pas géré par FormControl => on se replie sur du vanillaJS
    document?.getElementById('search-input')?.addEventListener('search', (evt) => this.setState({ search: (evt?.target as HTMLInputElement).value || '' }));
    ctx.eventBus.on('hash-changed', this.handleEventHashChanged);
    ctx.eventBus.on('will-navigate-app', this.handleEventWillNavigate);
    ctx.eventBus.on('downloads-fetched', (data) => this.updateNewDownloadCount(data.downloads));
  }

  componentWillUnmount() {
    ctx.eventBus.detach('hash-changed', this.handleEventHashChanged);
    ctx.eventBus.detach('will-navigate-app', this.handleEventWillNavigate);
    ctx.eventBus.off('downloads-fetched');
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
    document.body.classList.toggle('simplified-ui', !!user?.simplifiedUI);
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

  updateNewDownloadCount(downloads: DbDownload[]): void {
    this.setState({ downloadCount: downloads.filter((d) => !d.imported && !d.ignored).length });
  }

  render(): JSX.Element {
    const {
      users, route, orderBy, search, searchInputValue, scanning, scanLogs, optionsVisible, downloadCount,
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
    } else if (route.name === 'trendings') {
      content = <Trendings users={users} />;
    } else if (route.name === 'downloads') {
      content = <Downloads />;
    }

    const offcanvas: JSX.Element = (
      <Offcanvas
        id="offcanvasNavbar-expand"
        aria-labelledby="offcanvasNavbarLabel-expand"
        placement="end"
        show={optionsVisible}
        onHide={this.handleOptionsToggle.bind(this, false)}
      >
        <Offcanvas.Header closeButton><Offcanvas.Title>Tri</Offcanvas.Title></Offcanvas.Header>
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
                <Button variant={document.location.host === 'nas.colors.ovh:3000' ? 'secondary' : 'outline-secondary'} onClick={this.handleServerClick.bind(this, 'nas.colors.ovh:3000')}>nas.colors.ovh:3000</Button>
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
              <Nav.Link href="#/trendings" active={route.name === 'trendings' && !search} className="simplified-ui-hidden">
                Tendances
              </Nav.Link>
              <Nav.Link href="#/downloads" active={route.name === 'downloads' && !search} className="simplified-ui-hidden">
                Téléchargements
                { downloadCount > 0 ? <Badge pill bg="primary" className="ms-2">{downloadCount}</Badge> : null }
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
              {/* <Button variant="dark" className={`ms-1${scanning ? ' disabled' : ''}${ctx.user?.admin ? '' : ' d-none'}`} style={{ lineHeight: '18px' }} onClick={this.handleScanClick.bind(this)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
                </svg>
              </Button> */}
              <Button variant="dark" className="ms-1" style={{ lineHeight: '18px' }} onClick={this.handleOptionsToggle.bind(this, true)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-three-dots-vertical" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" /></svg></Button>
              {ctx.user ? <a href="jellyplay://logform" style={{ textDecoration: 'none' }} onClick={undefined/* this.handleUserSelected.bind(this, undefined) */}><img src={`/images/users/${ctx.user.name}.svg`} alt={ctx.user.name} width="36" className="ms-3" /></a> : null}
            </Form>
            {offcanvas}
          </Container>
        </Navbar>
        <div className="mt-5 p-2">{search ? <SearchResults query={search} onClose={() => this.setState({ search: '', searchInputValue: '' })} /> : content}</div>
      </>
    );
  }
}
