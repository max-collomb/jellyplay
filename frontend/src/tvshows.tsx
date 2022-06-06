import React from 'react';


type TvShowsProps = {};
type TvShowsState = {
};

export default class TvShows extends React.Component<TvShowsProps, TvShowsState> {

  constructor(props: TvShowsProps) {
    super(props);
    this.state = {
    };
  }

  render(): JSX.Element {
    return <div>Séries</div>;
  }
}
