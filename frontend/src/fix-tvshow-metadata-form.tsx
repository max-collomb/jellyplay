import React from 'react';

import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';
import { TvResult } from 'moviedb-promise/dist/request-types';

import { DbTvshow } from '../../api/src/types';

import { ctx } from './common';

type FixTvshowMetadataFormProps = {
  tvshow: DbTvshow;
  onClose: (tvshow?: DbTvshow) => void;
};
type FixMetadataFormState = {
  title: string;
  candidates?: TvResult[];
  updating: boolean;
};

export default class FixTvshowMetadataForm extends React.Component<FixTvshowMetadataFormProps, FixMetadataFormState> {
  constructor(props: FixTvshowMetadataFormProps) {
    super(props);
    const { tvshow } = this.props;
    this.state = {
      title: '',
      updating: false,
    };
    ctx.apiClient.parseFilename(tvshow.foldername)
      .then((data) => {
        let { title } = data;
        if (title.startsWith('[')) { title = title.substring(title.indexOf(']') + 1).trim(); }
        this.setState({ title }, this.handleSearchClick.bind(this));
      });
  }

  handleTitleChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ title: evt.target.value });
  }

  async handleCandidateClick(candidate: TvResult, evt: React.MouseEvent<HTMLElement>): Promise<void> {
    this.setState({ updating: true });
    let { tvshow } = this.props;
    const { onClose } = this.props;
    if (candidate.id) {
      tvshow = await ctx.apiClient.fixTvshowMetadata(tvshow.foldername, candidate.id);
    }
    onClose(tvshow);
    evt.preventDefault();
  }

  async handleSearchClick(evt?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (evt) {
      evt.preventDefault();
    }
    const { title } = this.state;
    const candidates: TvResult[] | undefined = await ctx.tmdbClient.getTvCandidates(title);
    this.setState({ candidates });
  }

  handleCancelClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    const { onClose } = this.props;
    onClose();
    evt.preventDefault();
  }

  render(): JSX.Element {
    const { updating, candidates, title } = this.state;
    const { tvshow } = this.props;
    if (updating) {
      return (
        <div className="d-flex justify-content-center mt-5">
          Mise à jour des métadonnées &emsp;
          <Spinner animation="border" variant="light" />
        </div>
      );
    }
    let candidatesElement: JSX.Element = <div className="d-flex justify-content-center mt-5"><Spinner animation="border" variant="light" /></div>;
    if (candidates && candidates.length === 0) {
      candidatesElement = <p className="text-muted">Aucun résultat</p>;
    } else if (candidates && candidates.length > 0) {
      candidatesElement = (
        <div className="d-flex flex-wrap justify-content-evenly mt-3">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="media-card movie" onClick={this.handleCandidateClick.bind(this, candidate)}>
              <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient.baseUrl}w342${candidate.poster_path})` }} />
              <span className="title">{candidate.name}</span>
              <span className="infos d-flex justify-content-between">
                <span className="year">{candidate.first_air_date?.substring(0, 4)}</span>
                <span className="duration" onClick={(evt) => evt.stopPropagation()}>
                  id
                  {candidate.id}
                </span>
              </span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <>
        <h4 className="mx-3 my-5">{ tvshow.foldername }</h4>
        <Form className="m-3">
          <Row className="justify-content-md-center">
            <Col>
              <InputGroup className="mb-2">
                <InputGroup.Text>Titre</InputGroup.Text>
                <Form.Control value={title} onChange={this.handleTitleChange.bind(this)} />
              </InputGroup>
            </Col>
            <Col md="auto">
              <Button type="submit" className="mb-2" onClick={this.handleSearchClick.bind(this)}>Rechercher</Button>
              <Button variant="link" className="mb-2" onClick={this.handleCancelClick.bind(this)}>Annuler</Button>
            </Col>
          </Row>
        </Form>
        {candidatesElement}
      </>
    );
  }
}
