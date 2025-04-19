import React from 'react';

import { Cast, DbCredit } from '../../api/src/types';
import { ctx } from './common';

type CastingProps = { cast: Cast[] };
type CastingState = { credits: DbCredit[] };

export default class Casting extends React.Component<CastingProps, CastingState> {
  static defaultProps: { cast: []; };

  constructor(props: CastingProps) {
    super(props);
    this.state = { credits: [] };
    ctx.apiClient.getCredits().then((credits) => this.setState({ credits }));
  }

  handleCreditSearch(credit: DbCredit, evt: React.MouseEvent): void {
    evt.preventDefault();
    ctx.router.navigateTo(`#/tmdb/person/${credit.tmdbid}`);
  }

  getCredit(id: number): DbCredit | null {
    const { credits } = this.state;
    for (const credit of credits) {
      if (credit.tmdbid === id) {
        return credit;
      }
    }
    return null;
  }

  render(): JSX.Element {
    const { cast } = this.props;
    if (!cast) {
      return <></>;
    }
    return (
      <div className="d-flex flex-wrap mt-3">
        {
        cast.map((role) => {
          const credit = this.getCredit(role.tmdbid);
          return credit ? (
            <div key={credit.tmdbid} className="cast-card" onClick={this.handleCreditSearch.bind(this, credit)} title={`${credit.name}\n${(role.character ? `en tant que ${role.character}` : '-')}`}>
              {credit.profilePath
                ? <img src={`/images/profiles_w185${credit.profilePath}`} alt={credit.name} />
                : (
                  <span className="no-profile-picture">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                      <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z" />
                    </svg>
                  </span>
                )}
              <span className="actor">{credit.name}</span>
              <span className="character">{(role.character ? `en tant que ${role.character}` : '-')}</span>
            </div>
          ) : null;
        })
        }
      </div>
    );
  }
}
