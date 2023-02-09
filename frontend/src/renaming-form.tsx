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
    const { movie } = this.props;
    this.state = {
      filename: movie.filename,
      updating: false,
    };
  }

  handleFilenameChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ filename: evt.target.value });
  }

  async handleRenameClick(evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    const { movie, onClose } = this.props;
    const { filename } = this.state;
    if (filename !== movie.filename) {
      const newFilename = await ctx.apiClient.renameFile(movie.filename, filename);
      if (newFilename) {
        movie.filename = newFilename;
      }
    }
    onClose();
  }

  handleCancelClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    const { onClose } = this.props;
    onClose();
  }

  render(): JSX.Element {
    const { movie } = this.props;
    const { filename, updating } = this.state;
    if (updating) {
      return (
        <div className="d-flex justify-content-center mt-5">
          Mise à jour &emsp;
          <Spinner animation="border" variant="light" />
        </div>
      );
    }
    return (
      <>
        <h4 className="mx-3 my-5">{ movie.filename }</h4>
        <Form className="m-3">
          <Row className="justify-content-md-center">
            <Col>
              <InputGroup className="mb-2">
                <InputGroup.Text>Titre</InputGroup.Text>
                <Form.Control value={filename} onChange={this.handleFilenameChange.bind(this)} />
              </InputGroup>
            </Col>
            <Col md="auto">
              <Button type="submit" className="mb-2" onClick={this.handleRenameClick.bind(this)}>Renommer</Button>
              <Button variant="link" className="mb-2" onClick={this.handleCancelClick.bind(this)}>Annuler</Button>
            </Col>
          </Row>
        </Form>
      </>
    );
  }
}
