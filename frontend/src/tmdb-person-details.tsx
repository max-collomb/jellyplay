import React from 'react';

import { Person } from 'moviedb-promise/dist/request-types';

import { ctx } from './common';

type TmdbPersonDetailsProps = {
  personId: number;
};
type TmdbPersonDetailsState = {
  person?: Person;
};

export default class TmdbPersonDetails extends React.Component<TmdbPersonDetailsProps, TmdbPersonDetailsState> {
  constructor(props: TmdbPersonDetailsProps) {
    super(props);
    this.state = {};
    this.fetchMovie();
  }

  componentDidUpdate(prevProps: TmdbPersonDetailsProps) {
    const { personId } = this.props;
    if (prevProps.personId !== personId) {
    //   this.setState({
    //     movie: undefined,
    //     credits: undefined,
    //   });
    //   this.fetchMovie();
    }
  }

  async fetchMovie(): Promise<void> {
    const { personId } = this.props;
    const person = await ctx.tmdbClient?.getPerson(personId);
    this.setState({ person });
  }

  render(): JSX.Element {
    const { person } = this.state;
    return <>{person?.name}</>;
  }
}
