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

import { Config, DbUser, OrderBy } from '../../api/src/types';

import Home from './home';
import Movies from './movies';
import TvShows from './tvshows';
import UserSelection from './user-selection';
import apiClient from './api-client';
import TmdbClient from './tmdb';

enum AppTab {
  home = "home",
  movies = "movies",
  tvshows = "tvshows",
};

type AppProps = {};
type AppState = {
  config: Config;
  tmdbClient?: TmdbClient;
  users: DbUser[];
  user?: DbUser;
  optionsVisible: boolean;
  tab: AppTab;
  selection?: number;
  orderBy: OrderBy;
  search: string;
};

export default class App extends React.Component<AppProps, AppState> {

  constructor(props: AppProps) {
    super(props);
    const orderBy = (localStorage.getItem('orderBy') || "addedDesc") as OrderBy;
    this.state = {
      config: { moviesLocalPath: "", moviesRemotePath: "", tvshowsLocalPath: "", tvshowsRemotePath: "", tmdbApiKey: "" },
      users: [],
      optionsVisible: false,
      tab: AppTab.movies,
      orderBy,
      search: "",
    };
    apiClient.getConfig().then((config) => {
      this.setState({ config, tmdbClient: new TmdbClient(config.tmdbApiKey, 'fr-FR') });
    });
    apiClient.getUsers().then((users) => {
      let userName = localStorage.getItem('userName');
      let user;
      for(let u of users) {
        if (u.name == userName) {
          user = u;
        }
      }
      this.setState({ users, user });
    });
  }

  componentDidMount() {
    // l'événement "search" n'est pas géré par FormControl => on se replie sur du vanillaJS
    document?.getElementById("search-input")?.addEventListener("search", (evt) => this.setState({ search: (evt?.target as HTMLInputElement).value || "" }));
  }

  handleOptionsToggle(isVisible: boolean): void {
    this.setState({ optionsVisible: isVisible });
  }

  handleTabClick(tab: AppTab, evt: React.MouseEvent<HTMLElement>): void {
    this.setState({ tab, selection: undefined });
    evt.preventDefault();
  }

  handleUserSelected(user?: DbUser): void {
    this.setState({ user });
    localStorage.setItem('userName', user ? user.name : "none");
  }

  handleOrderClick(orderBy: OrderBy): void {
    localStorage.setItem('orderBy', orderBy);
    this.setState({ orderBy, optionsVisible: false });
  }

  handleSearchKeyDown(evt: React.KeyboardEvent<HTMLInputElement>): void {
    if (evt.key === 'Enter') {
      const input: HTMLElement|null = document.getElementById("search-input");
      this.setState({ search: input ? (input as HTMLInputElement).value : "" });
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  handleSearchClick(evt: React.MouseEvent<HTMLButtonElement>): void {
      const input: HTMLElement|null = document.getElementById("search-input");
      this.setState({ search: input ? (input as HTMLInputElement).value : "" });
  }

  render(): JSX.Element {
    let content: JSX.Element = <div/>;
    if (! this.state.users.length) {
      content = <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-light"></div></div>;
    } else if (! this.state.user) {
      content = <UserSelection users={this.state.users} onValidation={this.handleUserSelected.bind(this)}/>
    } else if (this.state.tab == AppTab.home) {
      content = <Home />;
    } else if (this.state.tab == AppTab.movies) {
      content = <Movies config={this.state.config}
                        user={this.state.user}
                        tmdbClient={this.state.tmdbClient}
                        orderBy={this.state.orderBy}
                        search={this.state.search}/>;
    } else if (this.state.tab == AppTab.tvshows) {
      content = <TvShows config={this.state.config}
                        user={this.state.user}
                        tmdbClient={this.state.tmdbClient}
                        orderBy={this.state.orderBy}
                        search={this.state.search}/>
    }

    return (
      <>
        <Navbar variant="dark" fixed="top" id="navbar">
          <Container fluid>
            <Nav className="me-auto">
              <Nav.Link
                href="#home"
                className={ (this.state.tab == AppTab.home) ? "active" : "" }
                onClick={ this.handleTabClick.bind(this, AppTab.home) }
                style={{ lineHeight: "18px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-house-door-fill" viewBox="0 0 16 16"><path d="M6.5 14.5v-3.505c0-.245.25-.495.5-.495h2c.25 0 .5.25.5.5v3.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5z"/></svg>
              </Nav.Link>
              <Nav.Link
                href="#movies"
                className={ (this.state.tab == AppTab.movies) ? "active" : "" }
                onClick={ this.handleTabClick.bind(this, AppTab.movies) }>
                Films
              </Nav.Link>
              <Nav.Link
                href="#tvshows"
                className={ (this.state.tab == AppTab.tvshows) ? "active" : "" }
                onClick={ this.handleTabClick.bind(this, AppTab.tvshows) }>
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
                  onKeyDown={ this.handleSearchKeyDown.bind(this) }
                />
                <Button variant="dark" style={{ lineHeight: "18px" }} onClick={ this.handleSearchClick.bind(this) }><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-search" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg></Button>
              </InputGroup>
              <Button variant="dark" className="ms-1" style={{ lineHeight: "18px" }} onClick={ this.handleOptionsToggle.bind(this, true) }><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-three-dots-vertical" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg></Button>
              {this.state.user ? <div style={{ cursor: "pointer" }} onClick={this.handleUserSelected.bind(this, undefined)}><img src={`/images/users/${this.state.user.name}.svg`} width="36" className="ms-3"/></div> : null}
            </Form>
            <Offcanvas
              id={`offcanvasNavbar-expand`}
              aria-labelledby={`offcanvasNavbarLabel-expand`}
              placement="end"
              show={ this.state.optionsVisible }
              onHide={ this.handleOptionsToggle.bind(this, false) }
            >
              <Offcanvas.Header closeButton>
                <Offcanvas.Title id={`offcanvasNavbarLabel-expand`}>
                  Tri
                </Offcanvas.Title>
              </Offcanvas.Header>
              <Offcanvas.Body>
                <ButtonToolbar className="mb-3">
                  <Form.Label className="label-aligned">Date d'ajout</Form.Label>
                  <ButtonGroup className="flex-fill">
                    <Button variant={this.state.orderBy == OrderBy.addedDesc ? "secondary" : "outline-secondary"} onClick={this.handleOrderClick.bind(this, OrderBy.addedDesc)}>+ Récent</Button>
                    <Button variant={this.state.orderBy == OrderBy.addedAsc  ? "secondary" : "outline-secondary"} onClick={this.handleOrderClick.bind(this, OrderBy.addedAsc) }>+ Ancien</Button>
                  </ButtonGroup>
                 </ButtonToolbar>
                <ButtonToolbar className="mb-3">
                  <Form.Label className="label-aligned">Titre</Form.Label>
                  <ButtonGroup className="flex-fill">
                    <Button variant={this.state.orderBy == OrderBy.titleAsc  ? "secondary" : "outline-secondary"} onClick={this.handleOrderClick.bind(this, OrderBy.titleAsc) }>A &ndash; Z</Button>
                    <Button variant={this.state.orderBy == OrderBy.titleDesc ? "secondary" : "outline-secondary"} onClick={this.handleOrderClick.bind(this, OrderBy.titleDesc)}>Z &ndash; A</Button>
                  </ButtonGroup>
                 </ButtonToolbar>
                <ButtonToolbar className="mb-3">
                  <Form.Label className="label-aligned">Année</Form.Label>
                  <ButtonGroup className="flex-fill">
                    <Button variant={this.state.orderBy == OrderBy.yearDesc ? "secondary" : "outline-secondary"} onClick={this.handleOrderClick.bind(this, OrderBy.yearDesc)}>+ Récent</Button>
                    <Button variant={this.state.orderBy == OrderBy.yearAsc  ? "secondary" : "outline-secondary"} onClick={this.handleOrderClick.bind(this, OrderBy.yearAsc) }>+ Ancien</Button>
                  </ButtonGroup>
                 </ButtonToolbar>
              </Offcanvas.Body>
            </Offcanvas>
          </Container>
        </Navbar>
        <div className="mt-5 p-2">{content}</div>
      </>
    );    
  }
}
