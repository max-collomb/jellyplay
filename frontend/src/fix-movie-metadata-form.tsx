import React from 'react';

import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';
import { MovieResult } from 'moviedb-promise/dist/request-types';

import { DbMovie } from '../../api/src/types';

import { ctx } from './common';

type FixMovieMetadataFormProps = {
  movie: DbMovie;
  onClose: (movie?: DbMovie) => void;
};
type FixMovieMetadataFormState = {
  title: string;
  year: string;
  candidates?: MovieResult[];
  updating: boolean;
};

export default class FixMovieMetadataForm extends React.Component<FixMovieMetadataFormProps, FixMovieMetadataFormState> {

  constructor(props: FixMovieMetadataFormProps) {
    super(props);
    this.state = {
      title: "",
      year: "",
      updating: false,
    };
    ctx.apiClient.parseFilename(this.props.movie.filename)
             .then((data) => this.setState({ title: data.title, year: data.year || "" }, this.handleSearchClick.bind(this)));
  }

  handleTitleChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ title: evt.target.value });
  }

  handleYearChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ year: evt.target.value });
  }

  handleClearYear(evt: React.MouseEvent<HTMLButtonElement>): void {
    this.setState({ candidates: undefined, year: "" }, this.handleSearchClick.bind(this));
    evt.preventDefault();
  }

  async handleCandidateClick(candidate: MovieResult, evt: React.MouseEvent<HTMLElement>): Promise<void> {
    this.setState({ updating: true });
    let movie: DbMovie = this.props.movie;
    if (candidate.id) {
      movie = await ctx.apiClient.fixMovieMetadata(this.props.movie.filename, candidate.id);
    }
    this.props.onClose(movie);
    evt.preventDefault();
  }

  async handleSearchClick(evt?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (evt) {
      evt.preventDefault();
    }
    const candidates: MovieResult[] | undefined = await ctx.tmdbClient.getMovieCandidates(this.state.title, this.state.year);
    this.setState({ candidates });
  }

  handleCancelClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    this.props.onClose();
    evt.preventDefault();
  }

  render(): JSX.Element {
    if (this.state.updating) {
      return <div className="d-flex justify-content-center mt-5">Mise à jour des métadonnées &emsp; <Spinner animation="border" variant="light" /></div>;
    }
    let candidates: JSX.Element = <div className="d-flex justify-content-center mt-5"><Spinner animation="border" variant="light" /></div>;
    if (this.state.candidates && this.state.candidates.length === 0) {
      candidates = <p className="text-muted">Aucun résultat</p>;
    } else if (this.state.candidates && this.state.candidates.length > 0) {
      candidates = <div className="d-flex flex-wrap justify-content-evenly mt-3">
        {this.state.candidates.map((candidate, idx) => <div key={idx} className="media-card movie" onClick={this.handleCandidateClick.bind(this, candidate)}>
          <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient.baseUrl}w342${candidate.poster_path})` }}></span>
          <span className="title">{candidate.title}</span>
          <span className="infos d-flex justify-content-between">
            <span className="year">{candidate.release_date?.substring(0, 4)}</span>
            <span className="duration" onClick={evt => evt.stopPropagation()}>id{candidate.id}</span>
          </span>
        </div>)}
      </div>
    }
    return <>
      <h4 className="mx-3 my-5">{ this.props.movie.filename }</h4>
      <Form className="m-3">
        <Row className="justify-content-md-center">
          <Col>
            <InputGroup className="mb-2">
              <InputGroup.Text>Titre</InputGroup.Text>
              <Form.Control value={this.state.title} onChange={this.handleTitleChange.bind(this)}/>
            </InputGroup>
          </Col>
          <Col md="auto">
            <InputGroup className="mb-2">
              <InputGroup.Text>Année</InputGroup.Text>
              <Form.Control value={this.state.year} onChange={this.handleYearChange.bind(this)} style={{width: "4rem"}}/>
              <Button variant="outline-secondary" onClick={this.handleClearYear.bind(this)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                </svg>
              </Button>
            </InputGroup>
          </Col>
          <Col md="auto">
            <Button type="submit" className="mb-2" onClick={this.handleSearchClick.bind(this)}>Rechercher</Button>
            <Button variant="link" className="mb-2" onClick={this.handleCancelClick.bind(this)}>Annuler</Button>
          </Col>
        </Row>
      </Form>
      {candidates}
    </>;
  }
}
