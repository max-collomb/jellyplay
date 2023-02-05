import React from 'react';

import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';

import { DbMovie } from '../../api/src/types';

import { ctx } from './common';

type RenamingFormProps = {
  movie: DbMovie;
  onClose: (filename?: string) => void;
};
type RenamingFormState = {
  filename: string;
  updating: boolean;
};

export default class RenamingForm extends React.Component<RenamingFormProps, RenamingFormState> {

  constructor(props: RenamingFormProps) {
    super(props);
    this.state = {
      filename: this.props.movie.filename,
      updating: false,
    };
  }

  handleFilenameChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ filename: evt.target.value });
  }

  async handleRenameClick(evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    if (this.state.filename != this.props.movie.filename) {
      let newFilename = await ctx.apiClient.renameFile(this.props.movie.filename, this.state.filename);
      if (newFilename) {
        this.props.movie.filename = newFilename;
      }
    }
    this.props.onClose();
  }

  handleCancelClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    this.props.onClose();
  }

  render(): JSX.Element {
    if (this.state.updating) {
      return <div className="d-flex justify-content-center mt-5">Mise à jour &emsp; <Spinner animation="border" variant="light" /></div>;
    }
    return <>
      <h4 className="mx-3 my-5">{ this.props.movie.filename }</h4>
      <Form className="m-3">
        <Row className="justify-content-md-center">
          <Col>
            <InputGroup className="mb-2">
              <InputGroup.Text>Titre</InputGroup.Text>
              <Form.Control value={this.state.filename} onChange={this.handleFilenameChange.bind(this)}/>
            </InputGroup>
          </Col>
          <Col md="auto">
            <Button type="submit" className="mb-2" onClick={this.handleRenameClick.bind(this)}>Renommer</Button>
            <Button variant="link" className="mb-2" onClick={this.handleCancelClick.bind(this)}>Annuler</Button>
          </Col>
        </Row>
      </Form>
    </>;
  }
}
