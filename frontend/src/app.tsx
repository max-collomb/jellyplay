import React from 'react';

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import FormControl from 'react-bootstrap/FormControl';
import InputGroup from 'react-bootstrap/InputGroup';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Offcanvas from 'react-bootstrap/Offcanvas';

import Home from './home';
import Movies from './movies';
import TvShows from './tvshows';

enum AppTab {
  home = "home",
  movies = "movies",
  tvshows = "tvshows",
};

type AppProps = {};
type AppState = {
  optionsVisible: boolean;
  tab: AppTab;
  selection?: number;
};

export default class App extends React.Component<AppProps, AppState> {

  constructor(props: AppProps) {
    super(props);
    this.state = {
      optionsVisible: false,
      tab: AppTab.movies
    };
  }

  handleOptionsToggle(isVisible: boolean): void {
    this.setState({ optionsVisible: isVisible });
  }

  handleTabClick(tab: AppTab, evt: React.MouseEvent<HTMLElement>): void {
    this.setState({ tab, selection: undefined });
    evt.preventDefault();
  }

  render(): JSX.Element {
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
                  type="search"
                  placeholder="Search"
                  aria-label="Search"
                />
                <Button variant="dark" style={{ lineHeight: "18px" }}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-search" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg></Button>
              </InputGroup>
              <Button variant="dark" className="ms-1" style={{ lineHeight: "18px" }} onClick={ this.handleOptionsToggle.bind(this, true) }><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-three-dots-vertical" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg></Button>
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
                  Options
                </Offcanvas.Title>
              </Offcanvas.Header>
              <Offcanvas.Body>
                <Nav className="justify-content-end flex-grow-1 pe-3">
                  <Nav.Link href="#action1">Action 1</Nav.Link>
                  <Nav.Link href="#action2">Action 2</Nav.Link>
                </Nav>
              </Offcanvas.Body>
            </Offcanvas>
          </Container>
        </Navbar>
        <div className={ "mt-5 p-2" + (this.state.tab == AppTab.home    ? "" : " d-none") }><Home /></div>
        <div className={ "mt-5 p-2" + (this.state.tab == AppTab.movies  ? "" : " d-none") }><Movies /></div>
        <div className={ "mt-5 p-2" + (this.state.tab == AppTab.tvshows ? "" : " d-none") }><TvShows /></div>
      </>
    );    
  }
}
