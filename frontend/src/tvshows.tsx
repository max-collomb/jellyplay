import React from 'react';

import { Config, DbCredit, DbTvshow, DbUser } from '../../api/src/types';
import { OrderBy } from '../../api/src/enums';
import { cleanString, selectCurrentSeason } from './common';
import apiClient from './api-client';
import TmdbClient from './tmdb';
import TvshowCard from './tvshow-card';
import TvshowDetails from './tvshow-details';

type TvShowsProps = {
  config: Config;
  user: DbUser;
  tmdbClient?: TmdbClient;
  orderBy: OrderBy;
  search: string;
};
type TvShowsState = {
  tvshows: DbTvshow[];
  credits: DbCredit[];
  selection?: DbTvshow;
  fixingMetadata: boolean;
  // renaming: boolean;
  tabSeason: number;
  tabKey: string;
};

export default class TvShows extends React.Component<TvShowsProps, TvShowsState> {

  lastOrderBy?: OrderBy;

  constructor(props: TvShowsProps) {
    super(props);
    this.state = {
      tvshows: [],
      credits: [],
      tabSeason: 0,
      tabKey: "cast",
      fixingMetadata: false,
    };
    apiClient.getTvshows().then(tvshows => this.setState({ tvshows }));
    apiClient.getCredits().then(credits => this.setState({ credits }));
  }

  render(): JSX.Element {
    if (this.state.selection) {
      return <TvshowDetails tvshow={this.state.selection}
                            config={this.props.config}
                            user={this.props.user}
                            onClosed={() => this.setState({ selection: undefined })}
                            onChanged={this.forceUpdate.bind(this)}
                            onReplaced={(tvshow: DbTvshow) => {
                              const tvshows = this.state.tvshows.filter(m => m.foldername !== tvshow.foldername)
                              tvshows.push(tvshow);
                              this.setState({ tvshows, selection: tvshow });
                            }}/>;
    } else {
      let tvshows: DbTvshow[] = this.state.tvshows;
      if (this.lastOrderBy != this.props.orderBy) {
        this.lastOrderBy = this.props.orderBy;
        let sortFn: (a: DbTvshow, b: DbTvshow) => number;
        sortFn = (a: DbTvshow, b: DbTvshow) => (a.title.toUpperCase() < b.title.toUpperCase()) ? -1 : 1;
        switch(this.props.orderBy) {
          case OrderBy.addedDesc:
            sortFn = (a: DbTvshow, b: DbTvshow) => (b.createdMax < a.createdMax) ? -1 : (b.createdMax > a.createdMax) ? 1 : 0;
            break;
          case OrderBy.addedAsc:
            sortFn = (a: DbTvshow, b: DbTvshow) => (a.createdMin < b.createdMin) ? -1 : (a.createdMin > b.createdMin) ? 1 : 0;
            break;
          case OrderBy.titleAsc:
            // valeur par défaut
            break;
          case OrderBy.titleDesc:
            sortFn = (a: DbTvshow, b: DbTvshow) => (b.title.toUpperCase() < a.title.toUpperCase()) ? -1 : 1;
            break;
          case OrderBy.yearDesc:
            sortFn = (a: DbTvshow, b: DbTvshow) => (b.airDateMax < a.airDateMax) ? -1 : (b.airDateMax > a.airDateMax) ? 1 : 0;
            break;
          case OrderBy.yearAsc:
            sortFn = (a: DbTvshow, b: DbTvshow) => (a.airDateMin < b.airDateMin) ? -1 : (a.airDateMin > b.airDateMin) ? 1 : 0;
            break;
        }
        tvshows.sort(sortFn);
      }
      if (this.props.search) {
        tvshows = tvshows.filter(s => {
          if (! s.searchableContent) {
            s.searchableContent = cleanString(s.title + " " + 
              (s.title == s.originalTitle ? "" : s.originalTitle + " ") +
              s.genres.join(" ") + " " +
              s.countries.join(" ")
            );
          }
          return s.searchableContent.includes(cleanString(this.props.search));
        })
      }
      const typeTitles = ["Séries", "Emissions", "Animes"];
      let tvshowsByType: DbTvshow[][] = [ [], [], [] ];
      tvshows.forEach(t => {
        if (t.foldername.startsWith('[émission]'))
          tvshowsByType[1].push(t);
        else if (t.foldername.startsWith('[anime]'))
          tvshowsByType[2].push(t);
        else 
          tvshowsByType[0].push(t);
      });
      return <>{tvshowsByType.map((tvshows, idx0) => {
        return <React.Fragment key={idx0}><hr className={idx0 == 0 ? "d-none" : ""}/><h4 className="section-title p-2 mt-3 text-center">{typeTitles[idx0]}</h4>
          <div className="d-flex flex-wrap justify-content-evenly mt-2">{
            tvshows.filter(t => t.audience <= this.props.user.audience)
            .map((tvshow, idx) => <TvshowCard key={idx}
                                              tvshow={tvshow}
                                              config={this.props.config}
                                              user={this.props.user}
                                              onChanged={this.forceUpdate.bind(this)}
                                              onSelected={(tvshow: DbTvshow) => this.setState({ selection: tvshow, tabSeason: selectCurrentSeason(tvshow, this.props.user), tabKey: "cast" })}/>)
          }
        </div></React.Fragment>;
      })}</>;
    }
  }
}
