import React from 'react';

import { DbCredit, DbTvshow } from '../../api/src/types';
import { OrderBy } from '../../api/src/enums';

import { ctx, cleanString } from './common';
import TvshowCard from './tvshow-card';

type TvShowsProps = {
  orderBy: OrderBy;
  search: string;
};
type TvShowsState = {
  tvshows: DbTvshow[];
  credits: DbCredit[];
  selection?: DbTvshow;
  fixingMetadata: boolean;
  tabSeason: number;
  tabKey: string;
  scrollPosition: number;
};

export default class TvShows extends React.Component<TvShowsProps, TvShowsState> {

  lastOrderBy?: OrderBy;

  constructor(props: TvShowsProps) {
    super(props);
    this.handleEventWillNavigate = this.handleEventWillNavigate.bind(this);
    this.handleEventSetSearch = this.handleEventSetSearch.bind(this);
    this.state = {
      tvshows: [],
      credits: [],
      tabSeason: 0,
      tabKey: "cast",
      fixingMetadata: false,
      scrollPosition: 0,
    };
    this.refreshContent();
  }

  getCreditName(id: number): string {
    for(const credit of this.state.credits) {
      if (credit.tmdbid == id) {
        return credit.name;
      }
    }
    return "";
  }

  componentDidMount() {
    ctx.eventBus.on("set-search", this.handleEventSetSearch);
    ctx.eventBus.on("will-navigate", this.handleEventWillNavigate);
  }

  componentWillUnmount() {
    ctx.eventBus.detach("set-search", this.handleEventSetSearch);
    ctx.eventBus.detach("will-navigate", this.handleEventWillNavigate);
  }

  componentDidUpdate(_prevProps: TvShowsProps, prevState: TvShowsState) {
    if (ctx.router.currentRoute?.state?.windowScrollPosition !== undefined) {
      setTimeout(() => {
        //@ts-ignore en attente d'une correction pour https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1195
        window.scrollTo({left: 0, top: ctx.router.currentRoute?.state?.windowScrollPosition || 0, behavior: 'instant'});
      }, 0);
    }
    if (ctx.apiClient.needRefresh("tvshows")) {
      this.refreshContent();
    }
  }

  handleEventSetSearch(data: any): void {
    this.setState({ selection: undefined });
  }

  handleEventWillNavigate(evt: any): void {
    history.replaceState({}, "", "#/tvshows/state/" + JSON.stringify({ windowScrollPosition: window.pageYOffset }));
  }

  refreshContent(): void {
    ctx.apiClient.getTvshows().then(tvshows => { this.lastOrderBy = undefined; this.setState({ tvshows }); });
    ctx.apiClient.getCredits().then(credits => this.setState({ credits }));    
  }

  render(): JSX.Element {
    let tvshows: DbTvshow[] = this.state.tvshows;
    if (this.lastOrderBy != this.props.orderBy) {
      this.lastOrderBy = this.props.orderBy;
      const compare = new Intl.Collator('fr', { usage: "sort", sensitivity: "base" }).compare;
      let sortFn: (a: DbTvshow, b: DbTvshow) => number;
      sortFn = (a: DbTvshow, b: DbTvshow) => compare(a.title, b.title);
      switch(this.props.orderBy) {
        case OrderBy.addedDesc:    sortFn = (a: DbTvshow, b: DbTvshow) => (b.createdMax < a.createdMax) ? -1 : (b.createdMax > a.createdMax) ? 1 : 0; break;
        case OrderBy.addedAsc:     sortFn = (a: DbTvshow, b: DbTvshow) => (a.createdMin < b.createdMin) ? -1 : (a.createdMin > b.createdMin) ? 1 : 0; break;
        case OrderBy.titleAsc:     /* valeur par défaut */ break;
        case OrderBy.titleDesc:    sortFn = (a: DbTvshow, b: DbTvshow) => compare(b.title, a.title); break;
        case OrderBy.yearDesc:     sortFn = (a: DbTvshow, b: DbTvshow) => (b.airDateMax < a.airDateMax) ? -1 : (b.airDateMax > a.airDateMax) ? 1 : 0; break;
        case OrderBy.yearAsc:      sortFn = (a: DbTvshow, b: DbTvshow) => (a.airDateMin < b.airDateMin) ? -1 : (a.airDateMin > b.airDateMin) ? 1 : 0; break;
        case OrderBy.filenameAsc:  sortFn = (a: DbTvshow, b: DbTvshow) => compare(a.foldername, b.foldername); break;
        case OrderBy.filenameDesc: sortFn = (a: DbTvshow, b: DbTvshow) => compare(b.foldername, a.foldername); break;
      }
      tvshows.sort(sortFn);
    }
    if (this.props.search) {
      tvshows = tvshows.filter(s => {
        if (! s.searchableContent) {
          let cast: Set<string> = new Set<string>();
          s.seasons.forEach(season => season.cast.forEach(c => cast.add(this.getCreditName(c.tmdbid))));
          s.searchableContent = cleanString(s.foldername + " " + s.title + " " + 
            (s.title == s.originalTitle ? "" : s.originalTitle + " ") +
            s.genres.join(" ") + " " +
            s.countries.join(" ") +
            Array.from(cast).join(" ")
          );
        }
        return s.searchableContent.includes(cleanString(this.props.search));
      })
    }
    const typeTitles = ctx.user?.name == "thomas"
      ? ["Animes", "Séries", "Emissions"]
      : ["Séries", "Emissions", "Animes"];
    let tvshowsByType: DbTvshow[][] = [ [], [], [] ];
    const emissionPos = typeTitles.indexOf("Emissions");
    const animePos = typeTitles.indexOf("Animes");
    const showPos = typeTitles.indexOf("Séries");
    tvshows.forEach(t => {
      if (t.foldername.startsWith('[émission]'))
        tvshowsByType[emissionPos].push(t);
      else if (t.foldername.startsWith('[anime]'))
        tvshowsByType[animePos].push(t);
      else 
        tvshowsByType[showPos].push(t);
    });
    return <>{tvshowsByType.map((tvshows, idx0) => {
      return <React.Fragment key={idx0}><h4 className="section-title">{typeTitles[idx0]}</h4>
        <div className="d-flex flex-wrap -justify-content-evenly mt-2">{
          tvshows.filter(t => t.audience <= (ctx.user?.audience || 999))
          .map((tvshow, idx) => <TvshowCard key={idx} tvshow={tvshow} showNext={false}/>)
       }
      </div></React.Fragment>;
    })}</>;
  }
}
