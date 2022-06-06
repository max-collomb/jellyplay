import React from 'react';


type HomeProps = {};
type HomeState = {
};

export default class Home extends React.Component<HomeProps, HomeState> {

  constructor(props: HomeProps) {
    super(props);
    this.state = {
    };
  }

  render(): JSX.Element {
    return <div>Accueil</div>;
  }
}
