import React from 'react';

import { Cast } from 'moviedb-promise/dist/request-types';

import { ctx } from './common';

type TmdbCastingProps = { cast: Cast[] };
type TmdbCastingState = {};

export default class TmdbCasting extends React.Component<TmdbCastingProps, TmdbCastingState> {
  static defaultProps: { cast: []; };

  constructor(props: TmdbCastingProps) {
    super(props);
    this.state = {};
  }

  handleCastSearch(cast: Cast, evt: React.MouseEvent): void {
    evt.preventDefault();
    ctx.router.navigateTo(`#/tmdb/person/${cast.id}`);
  }

  render(): JSX.Element {
    const { cast } = this.props;
    if (!cast) {
      return <></>;
    }
    return (
      <div className="d-flex flex-wrap mt-3">
        {
          cast?.map((person) => (
            <div key={person.id} className="cast-card" onClick={this.handleCastSearch.bind(this, person)} title={`${person.name}\n${(person.character ? `en tant que ${person.character}` : '-')}`}>
              {person.profile_path
                ? <img src={`${ctx.tmdbClient?.baseUrl}w185${person.profile_path}`} alt={person.name} />
                : (
                  <span className="no-profile-picture">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                      <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z" />
                    </svg>
                  </span>
                )}
              <span className="actor">{person.name}</span>
              <span className="character">{(person.character ? `en tant que ${person.character}` : '-')}</span>
            </div>
          ))
        }
      </div>
    );
  }
}
