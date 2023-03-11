import React from 'react';

import { DbTvshow } from '../../api/src/types';
import { OrderBy } from '../../api/src/enums';

import { ctx } from './common';
import TvshowCard from './tvshow-card';

type TvShowsProps = {
  orderBy: OrderBy;
};
type TvShowsState = {
  tvshows: DbTvshow[];
  selection?: DbTvshow;
};

export default class TvShows extends React.Component<TvShowsProps, TvShowsState> {
  lastOrderBy?: OrderBy;

  constructor(props: TvShowsProps) {
    super(props);
    this.state = {
      tvshows: [],
    };
    this.refreshContent();
    ctx.eventBus.replace('will-navigate', ctx.router.saveScrollPosition.bind(ctx.router));
  }

  componentDidUpdate(prevProps: TvShowsProps, prevState: TvShowsState) {
    const { tvshows } = this.state;
    if (prevState.tvshows.length === 0 && tvshows.length > 0) {
      ctx.router.restoreScrollPosition();
    }
    if (ctx.apiClient.needRefresh('tvshows')) {
      this.refreshContent();
    }
  }

  refreshContent(): void {
    ctx.apiClient.getTvshows().then((tvshows) => { this.lastOrderBy = undefined; this.setState({ tvshows }); });
  }

  render(): JSX.Element {
    const { orderBy } = this.props;
    const { tvshows } = this.state;
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
    const typeTitles = ctx.user?.name === 'thomas'
      ? ['Animes', 'Séries', 'Emissions']
      : ['Séries', 'Emissions', 'Animes'];
    const tvshowsByType: DbTvshow[][] = [[], [], []];
    const emissionPos = typeTitles.indexOf('Emissions');
    const animePos = typeTitles.indexOf('Animes');
    const showPos = typeTitles.indexOf('Séries');
    tvshows.forEach((t) => {
      if (t.foldername.startsWith('[emission]')) { tvshowsByType[emissionPos].push(t); } else if (t.foldername.startsWith('[anime]')) { tvshowsByType[animePos].push(t); } else { tvshowsByType[showPos].push(t); }
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
