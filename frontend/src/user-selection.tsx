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
    const { onValidation } = this.props;
    onValidation(user);
    evt.preventDefault();
  }

  render(): JSX.Element {
    const { users } = this.props;
    return (
      <div className="d-flex flex-wrap justify-content-evenly mt-3">
        {
      users.map((user) => (
        <div key={user.name} className="user-card" onClick={this.handleUserClick.bind(this, user)}>
          <img src={`/images/users/${user.name}.svg`} alt={user.name} width="64" />
          <br />
          <span className="name">{user.name}</span>
        </div>
      ))
    }
      </div>
    );
  }
}
