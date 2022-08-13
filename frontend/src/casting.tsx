import React from 'react';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import { Cast, Config, DbCredit, DbTvshow, DbUser, Episode, Season, UserEpisodeStatus, UserTvshowStatus } from '../../api/src/types';
import { OrderBy, SeenStatus } from '../../api/src/enums';
import { MoreToggle, MultiItem, getEpisodeUserStatus, getTvshowUserStatus, playTvshow, getEpisodeProgress, getEpisodeDuration, renderFileSize, renderVideoInfos, renderAudioInfos, getEpisodeCount, getSeasonCount, selectCurrentSeason } from './common';
import apiClient from './api-client';

import FixTvshowMetadataForm from './fix-tvshow-metadata-form';

type CastingProps = { cast: Cast[] };
type CastingState = { credits: DbCredit[] };

export default class Casting extends React.Component<CastingProps, CastingState> {

  constructor(props: CastingProps) {
    super(props);
    this.state = { credits: [] };
    apiClient.getCredits().then(credits => this.setState({ credits }));
  }

  getCredit(id: number): DbCredit|null {
    for(const credit of this.state.credits) {
      if (credit.tmdbid == id) {
        return credit;
      }
    }
    return null;
  }

  render(): JSX.Element {
    if (! this.props.cast) {
      return <></>;
    }
    return <div className="d-flex flex-wrap mt-3">{
      this.props.cast.map((role, idx) => {
        const credit = this.getCredit(role.tmdbid);
        return credit ? <div key={idx} className="cast-card">
          {credit.profilePath
            ? <img src={`/images/profiles_w185${credit.profilePath}`}/>
            : <span className="no-profile-picture"><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="currentColor" viewBox="0 0 16 16">
              <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
              <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/>
            </svg></span>}
          <span className="actor">{credit.name}</span>
          <span className={"character"}>{(role.character ? "en tant que " + role.character: "-")}</span>
        </div> : null;
      })
    }</div>;
  }
}
