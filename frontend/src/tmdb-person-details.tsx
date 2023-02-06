import React from 'react';

import Spinner from 'react-bootstrap/Spinner';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';

import { PersonWithCredits } from './tmdb-client';

import { ctx } from './common';

type TmdbPersonDetailsProps = {
  personId: number;
};
type TmdbPersonDetailsState = {
  person?: PersonWithCredits;
  tabKey: string;
};

export default class TmdbPersonDetails extends React.Component<TmdbPersonDetailsProps, TmdbPersonDetailsState> {
  constructor(props: TmdbPersonDetailsProps) {
    super(props);
    this.state = {
      tabKey: 'movies',
    };
    this.fetchPerson();
  }

  componentDidUpdate(prevProps: TmdbPersonDetailsProps) {
    const { personId } = this.props;
    if (prevProps.personId !== personId) {
    //   this.setState({
    //     movie: undefined,
    //     credits: undefined,
    //   });
    //   this.fetchMovie();
    }
  }

  handleChangeTab(tabKey: string | null): void {
    this.setState({ tabKey: tabKey || 'cast' });
    const { personId } = this.props;
    window.history.replaceState({}, '', `#/tmdb/person/${personId}/state/${JSON.stringify({ tabKey })}`);
  }

  handleMovieClick(movieId: number): void {
    ctx.router.navigateTo(`#/tmdb/movie/${movieId}/state/${JSON.stringify({ tabKey: 'cast' })}`);
  }

  async fetchPerson(): Promise<void> {
    const { personId } = this.props;
    const person = await ctx.tmdbClient?.getPerson(personId);
    // person?.movie_credits?.cast?.sort((a, b) => ((a.release_date && b.release_date && a.release_date > b.release_date) ? -1 : ((a.release_date && b.release_date && b.release_date > a.release_date) ? 1 : 0)));
    this.setState({ person });
  }

  render(): JSX.Element {
    const { person, tabKey } = this.state;
    if (!person) {
      return <div className="text-center mt-5"><Spinner animation="border" variant="light" /></div>;
    }
    return (
      <div className="media-details movie">
        <div className="position-fixed" style={{ top: '65px', left: '1rem' }}>
          <a href="#" className="link-light" onClick={(evt) => { evt.preventDefault(); window.history.back(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" className="bi bi-arrow-left" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
            </svg>
          </a>
        </div>
        <div className="media-poster">
          <span className="poster" style={{ backgroundImage: person.profile_path ? `url(${ctx.tmdbClient?.baseUrl}w780${person.profile_path})` : '' }} />
        </div>
        <div className="title-bar">
          <div className="d-flex align-items-center">
            <div className="flex-grow-1">
              <h2>{person.name}</h2>
              <div>
                {person.birthday ? `Né${person.gender === 1 ? 'e' : ''} le ${(new Date(person.birthday)).toLocaleDateString()} ${person.place_of_birth ? `à ${person.place_of_birth}` : ''}` : '' }
                {person.deathday ? `. Décédé${person.gender === 1 ? 'e' : ''} le ${(new Date(person.deathday)).toLocaleDateString()}` : '' }
              </div>
            </div>
          </div>
        </div>
        <div className="content-bar">
          <div className="d-flex align-items-start mb-3">
            <p className="synopsis overflow-auto" style={{ maxHeight: '195px' }}>{person.biography}</p>
          </div>
          <Tabs id="movie-tv-tabs" activeKey={tabKey} onSelect={this.handleChangeTab.bind(this)} className="constrained-width" mountOnEnter>
            <Tab eventKey="movies" title="Films">
              <div className="d-flex flex-wrap mt-3">
                {
                  person.movie_credits?.cast?.filter((movie: any) => !!movie.poster_path).map((movie: any) => (
                    <div key={movie.id} className="media-card movie" onClick={this.handleMovieClick.bind(this, movie.id)}>
                      <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w342${movie.poster_path})` }} />
                      <span className="title">{movie.title}</span>
                      <span className="infos d-flex justify-content-between">
                        <span className="year">{movie.release_date?.substring(0, 4)}</span>
                      </span>
                    </div>
                  ))
                }
              </div>
            </Tab>
            <Tab eventKey="tvshows" title="Séries">
              Séries TODO
            </Tab>
          </Tabs>
        </div>
      </div>
    );
  }
}
