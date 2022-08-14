import React from 'react';

import { Config, DbMovie, DbUser } from '../../api/src/types';
import { OrderBy } from '../../api/src/enums';
import { cleanString } from './common';
import apiClient from './api-client';
import TmdbClient from './tmdb';
import MovieCard from './movie-card';
import MovieDetails from './movie-details';

type MoviesProps = {
  config: Config;
  user: DbUser;
  tmdbClient?: TmdbClient;
  orderBy: OrderBy;
  search: string;
};
type MoviesState = {
  movies: DbMovie[];
  selection?: DbMovie;
  scrollPosition: number;
};

export default class Movies extends React.Component<MoviesProps, MoviesState> {

  lastOrderBy?: OrderBy;

  constructor(props: MoviesProps) {
    super(props);
    this.state = {
      movies: [],
      scrollPosition: 0,
    };
    apiClient.getMovies().then(movies => this.setState({ movies }));
  }

  componentDidUpdate(_prevProps: MoviesProps, prevState: MoviesState) {
    if (prevState.selection && ! this.state.selection) {
      setTimeout(() => {
        //@ts-ignore en attente d'une correction pour https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1195
        window.scrollTo({left: 0, top: this.state.scrollPosition, behavior: 'instant'});
      }, 0);
    }
  }

  render(): JSX.Element {
    if (this.state.selection) {
      return <MovieDetails  {...this.props}
                            movie={this.state.selection}
                            onClosed={() => this.setState({ selection: undefined })}
                            onChanged={this.forceUpdate.bind(this)}
                            onReplaced={(movie: DbMovie) => {
                              const movies = this.state.movies.filter(m => m.filename !== movie.filename)
                              movies.push(movie);
                              this.setState({ movies, selection: movie });
                            }}
                            onDeleted={(movie: DbMovie) => {
                              const movies = this.state.movies.filter(m => m.filename !== movie.filename)
                              this.setState({ movies, selection: undefined });
                            }}/>;
    } else {
      let movies: DbMovie[] = this.state.movies;
      if (this.lastOrderBy != this.props.orderBy) {
        this.lastOrderBy = this.props.orderBy;
        let sortFn: (a: DbMovie, b: DbMovie) => number;
        sortFn = (a: DbMovie, b: DbMovie) => (b.created < a.created) ? -1 : (b.created > a.created) ? 1 : 0;
        switch(this.props.orderBy) {
          case OrderBy.addedDesc:
            // valeur par défaut
            break;
          case OrderBy.addedAsc:
            sortFn = (a: DbMovie, b: DbMovie) => (a.created < b.created) ? -1 : (a.created > b.created) ? 1 : 0;
            break;
          case OrderBy.titleAsc:
            sortFn = (a: DbMovie, b: DbMovie) => (a.title.toUpperCase() < b.title.toUpperCase()) ? -1 : 1;
            break;
          case OrderBy.titleDesc:
            sortFn = (a: DbMovie, b: DbMovie) => (b.title.toUpperCase() < a.title.toUpperCase()) ? -1 : 1;
            break;
          case OrderBy.yearDesc:
            sortFn = (a: DbMovie, b: DbMovie) => b.year - a.year;
            break;
          case OrderBy.yearAsc:
            sortFn = (a: DbMovie, b: DbMovie) => a.year - b.year;
            break;
        }
        movies.sort(sortFn);
      }
      if (this.props.search) {
        movies = movies.filter(m => {
          if (! m.searchableContent) {
            m.searchableContent = cleanString(m.title + " " + 
              (m.title == m.originalTitle ? "" : m.originalTitle + " ") +
              m.genres.join(" ") + " " +
              m.countries.join(" ")
            );
          }
          return m.searchableContent.includes(cleanString(this.props.search));
        })
      }
      return <div className="d-flex flex-wrap justify-content-evenly mt-3">{
        movies.filter(m => m.audience <= this.props.user.audience)
        .map((movie, idx) => <MovieCard key={idx}
                                        movie={movie}
                                        config={this.props.config}
                                        user={this.props.user}
                                        onChanged={this.forceUpdate.bind(this)}
                                        onSelected={(movie: DbMovie) => this.setState({ selection: movie, scrollPosition: window.pageYOffset })}/>)
      }</div>;
    }
  }
}
