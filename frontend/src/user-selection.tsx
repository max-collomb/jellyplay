import React from 'react';

import { DbUser } from '../../api/src/types';

type UserSelectionProps = {
  users: DbUser[];
  onValidation: (user: DbUser) => void;
};
type UserSelectionState = {};

export default class UserSelection extends React.Component<UserSelectionProps, UserSelectionState> {

  constructor(props: UserSelectionProps) {
    super(props);
    this.state = {};
  }

  handleUserClick(user: DbUser, evt: React.MouseEvent<HTMLElement>) {
    this.props.onValidation(user);
    evt.preventDefault();
  }

  render(): JSX.Element {
    return <div className="d-flex flex-wrap justify-content-evenly mt-3">{
      this.props.users.map((user, idx) => {
        return <div key={idx} className="user-card" onClick={this.handleUserClick.bind(this, user)}>
          <img src={`/images/users/${user.name}.svg`} width="64"/><br/>
          <span className="name">{user.name}</span>
        </div>;
      })
    }</div>;
  }
}
