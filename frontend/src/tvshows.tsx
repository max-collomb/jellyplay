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
    };
    this.refreshContent();
  }

  componentDidMount() {
    ctx.eventBus.on('set-search', this.handleEventSetSearch);
    ctx.eventBus.on('will-navigate', this.handleEventWillNavigate);
  }

  componentDidUpdate() {
    if (ctx.router.currentRoute?.state?.windowScrollPosition !== undefined) {
      setTimeout(() => {
        // @ts-ignore en attente d'une correction pour https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1195
        window.scrollTo({ left: 0, top: ctx.router.currentRoute?.state?.windowScrollPosition || 0, behavior: 'instant' });
      }, 0);
    }
    if (ctx.apiClient.needRefresh('tvshows')) {
      this.refreshContent();
    }
  }

  componentWillUnmount() {
    ctx.eventBus.detach('set-search', this.handleEventSetSearch);
    ctx.eventBus.detach('will-navigate', this.handleEventWillNavigate);
  }

  handleEventSetSearch(): void {
    this.forceUpdate();
  }

  handleEventWillNavigate(): void {
    window.history.replaceState({}, '', `#/tvshows/state/${JSON.stringify({ windowScrollPosition: window.pageYOffset })}`);
  }

  getCreditName(id: number): string {
    const { credits } = this.state;
    for (const credit of credits) {
      if (credit.tmdbid === id) {
        return credit.name;
      }
    }
    return '';
  }

  refreshContent(): void {
    ctx.apiClient.getTvshows().then((tvshows) => { this.lastOrderBy = undefined; this.setState({ tvshows }); });
    ctx.apiClient.getCredits().then((credits) => this.setState({ credits }));
  }

  render(): JSX.Element {
    const { orderBy, search } = this.props;
    let { tvshows } = this.state;
    if (this.lastOrderBy !== orderBy) {
      this.lastOrderBy = orderBy;
      const { compare } = new Intl.Collator('fr', { usage: 'sort', sensitivity: 'base' });
      let sortFn: (a: DbTvshow, b: DbTvshow) => number;
      switch (orderBy) {
        case OrderBy.addedDesc: sortFn = (a: DbTvshow, b: DbTvshow) => ((b.createdMax < a.createdMax) ? -1 : (b.createdMax > a.createdMax) ? 1 : 0); break; // eslint-disable-line no-nested-ternary
        case OrderBy.addedAsc: sortFn = (a: DbTvshow, b: DbTvshow) => ((a.createdMin < b.createdMin) ? -1 : (a.createdMin > b.createdMin) ? 1 : 0); break; // eslint-disable-line no-nested-ternary
        case OrderBy.titleDesc: sortFn = (a: DbTvshow, b: DbTvshow) => compare(b.title, a.title); break;
        case OrderBy.yearDesc: sortFn = (a: DbTvshow, b: DbTvshow) => ((b.airDateMax < a.airDateMax) ? -1 : (b.airDateMax > a.airDateMax) ? 1 : 0); break; // eslint-disable-line no-nested-ternary
        case OrderBy.yearAsc: sortFn = (a: DbTvshow, b: DbTvshow) => ((a.airDateMin < b.airDateMin) ? -1 : (a.airDateMin > b.airDateMin) ? 1 : 0); break; // eslint-disable-line no-nested-ternary
        case OrderBy.filenameAsc: sortFn = (a: DbTvshow, b: DbTvshow) => compare(a.foldername, b.foldername); break;
        case OrderBy.filenameDesc: sortFn = (a: DbTvshow, b: DbTvshow) => compare(b.foldername, a.foldername); break;
        case OrderBy.titleAsc: /* valeur par défaut */
        default: sortFn = (a: DbTvshow, b: DbTvshow) => compare(a.title, b.title); break;
      }
      tvshows.sort(sortFn);
    }
    if (search) {
      tvshows = tvshows.filter((s) => {
        if (!s.searchableContent) {
          const cast: Set<string> = new Set<string>();
          s.seasons.forEach((season) => season.cast.forEach((c) => cast.add(this.getCreditName(c.tmdbid))));
          // eslint-disable-next-line no-param-reassign
          s.searchableContent = cleanString(`${s.foldername} ${s.title} ${
            s.title === s.originalTitle ? '' : `${s.originalTitle} `
          }${s.genres.join(' ')} ${
            s.countries.join(' ')
          }${Array.from(cast).join(' ')}`);
        }
        return s.searchableContent.includes(cleanString(search));
      });
    }
    const typeTitles = ctx.user?.name === 'thomas'
      ? ['Animes', 'Séries', 'Emissions']
      : ['Séries', 'Emissions', 'Animes'];
    const tvshowsByType: DbTvshow[][] = [[], [], []];
    const emissionPos = typeTitles.indexOf('Emissions');
    const animePos = typeTitles.indexOf('Animes');
    const showPos = typeTitles.indexOf('Séries');
    tvshows.forEach((t) => {
      if (t.foldername.startsWith('[émission]')) { tvshowsByType[emissionPos].push(t); } else if (t.foldername.startsWith('[anime]')) { tvshowsByType[animePos].push(t); } else { tvshowsByType[showPos].push(t); }
    });
    return (
      <>
        {tvshowsByType.map((tvshowsType, idx0) => (
          <React.Fragment key={typeTitles[idx0]}>
            <h4 className="section-title">{typeTitles[idx0]}</h4>
            <div className="d-flex flex-wrap -justify-content-evenly mt-2">
              {
                tvshowsType.filter((t) => t.audience <= (ctx.user?.audience || 999))
                  .map((tvshow) => <TvshowCard key={tvshow.tmdbid} tvshow={tvshow} showNext={false} />)
              }
            </div>
          </React.Fragment>
        ))}
      </>
    );
  }
}
