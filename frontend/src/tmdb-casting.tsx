import React from 'react';

import { Cast } from 'moviedb-promise/dist/request-types';

import { ctx } from './common';

type TmdbCastingProps = {
  cast?: Cast[];
};
type TmdbCastingState = {};

export default class TmdbCasting extends React.Component<TmdbCastingProps, TmdbCastingState> {

  constructor(props: TmdbCastingProps) {
    super(props);
    this.state = {};
  }

  handleCastSearch(cast: Cast, evt: React.MouseEvent): void {
    evt.preventDefault();
    ctx.eventBus.emit("set-search", { search: cast.name });
  }

  render(): JSX.Element {
    if (! this.props.cast) {
      return <></>;
    }
    return <div className="d-flex flex-wrap mt-3">{
      this.props.cast?.map((cast, idx) => {
        return <div key={idx} className="cast-card">
          {cast.profile_path
            ? <img src={`${ctx.tmdbClient?.baseUrl}w185${cast.profile_path}`}/>
            : <span className="no-profile-picture"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" viewBox="0 0 16 16">
              <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
              <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
            </svg></span>}
          <a href="#" className="actor" onClick={this.handleCastSearch.bind(this, cast)}>{cast.name}</a>
          <span className={"character"}>{(cast.character ? "en tant que " + cast.character : "-")}</span>
        </div>;
      })
    }</div>;
  }
}
