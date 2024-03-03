import React from 'react';

import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';
import { MovieResult, TvResult } from 'moviedb-promise/dist/request-types';

import {
  DbDownload, FileInfo, DbMovie, DbTvshow,
} from '../../api/src/types';

import {
  ctx, parseFilename, generateFilename, generateFoldername, searchCandidates,
} from './common';

type ImportDownloadFormProps = {
  downloads: DbDownload[];
  onClose: () => void;
};
type ImportDownloadFormState = {
  title: string;
  year: string;
  importedFilename: string;
  mediaType: string;
  fileInfo?: FileInfo;
  // parsedMovie?: ParsedMovie;
  // parsedTvshow?: ParsedShow;
  movieCandidates?: MovieResult[];
  selectedMovieCandidate?: MovieResult;
  tvshowCandidates?: TvResult[];
  selectedTvshowCandidate?: TvResult;
  importing: boolean;
  showRawMediaInfo: boolean;
  existingTvshows?: { [key: string]: string };
};

export default class ImportDownloadForm extends React.Component<ImportDownloadFormProps, ImportDownloadFormState> {
  constructor(props: ImportDownloadFormProps) {
    super(props);
    const { downloads } = this.props;
    this.state = {
      title: '',
      year: '',
      importedFilename: '',
      importing: false,
      mediaType: 'movie',
      showRawMediaInfo: false,
    };
    this.autoParseFilename(downloads[0].path);
  }

  handleTitleChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ title: evt.target.value });
  }

  handleFilenameChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ importedFilename: evt.target.value });
  }

  handleYearChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ year: evt.target.value });
  }

  handleClearYear(evt: React.MouseEvent<HTMLButtonElement>): void {
    this.setState({ movieCandidates: undefined, year: '' }, this.handleSearchClick.bind(this));
    evt.preventDefault();
  }

  async handleMovieCandidateClick(candidate: MovieResult, evt: React.MouseEvent<HTMLElement>): Promise<void> {
    const { downloads } = this.props;
    const { fileInfo } = this.state;
    this.setState({
      selectedMovieCandidate: candidate,
      importedFilename: generateFilename(candidate.title || '', candidate.release_date?.substring(0, 4) || '', candidate.original_language || '', fileInfo, downloads[0].path),
    });
    evt.preventDefault();
  }

  async handleTvshowCandidateClick(candidate: TvResult, evt: React.MouseEvent<HTMLElement>): Promise<void> {
    const { tvshowCandidates, existingTvshows } = this.state;
    this.setState({
      selectedTvshowCandidate: candidate,
      importedFilename: generateFoldername(candidate.name || '', existingTvshows, candidate.id, !tvshowCandidates || candidate.id !== tvshowCandidates[0].id),
    });
    evt.preventDefault();
  }

  async handleImportClick(evt?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (evt) {
      evt.preventDefault();
    }
    const { downloads, onClose } = this.props;
    const {
      importedFilename, selectedMovieCandidate, selectedTvshowCandidate, mediaType,
    } = this.state;
    if ((mediaType === 'movie' && selectedMovieCandidate?.id) || (mediaType === 'tvshow' && selectedTvshowCandidate?.id)) {
      try {
        let result: DbMovie | DbTvshow | undefined;
        this.setState({ importing: true });
        if (mediaType === 'movie' && selectedMovieCandidate?.id) {
          result = await ctx.apiClient.importMovieDownload(downloads[0].path, selectedMovieCandidate.id, parseFloat(selectedMovieCandidate.release_date?.substring(0, 4) || ''), importedFilename);
        } else if (mediaType === 'tvshow' && selectedTvshowCandidate?.id) {
          for (const download of downloads) {
            // eslint-disable-next-line no-await-in-loop
            result = await ctx.apiClient.importTvshowDownload(download.path, selectedTvshowCandidate.id, importedFilename);
          }
        }
        this.setState({ importing: false });
        if (result) {
          onClose();
        }
      } catch (e) {
        // eslint-disable-next-line no-alert
        alert(e);
      }
    }
  }

  async handleSearchClick(evt?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (evt) {
      evt.preventDefault();
    }

    const { downloads } = this.props;
    const {
      title, year, mediaType, fileInfo, existingTvshows,
    } = this.state;
    this.setState((await searchCandidates(title, year, mediaType, downloads, fileInfo, existingTvshows) as ImportDownloadFormState));
  }

  handleCancelClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    const { onClose } = this.props;
    onClose();
    evt.preventDefault();
  }

  handleShowRawMediaInfoClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    const { showRawMediaInfo } = this.state;
    this.setState({ showRawMediaInfo: !showRawMediaInfo });
  }

  async autoParseFilename(path: string): Promise<void> {
    const parsedFilename = await parseFilename(path);
    this.setState(parsedFilename as ImportDownloadFormState, this.handleSearchClick.bind(this));
  }

  render(): JSX.Element {
    const {
      movieCandidates, tvshowCandidates, title, importing, year, mediaType, selectedMovieCandidate, selectedTvshowCandidate, importedFilename, fileInfo, showRawMediaInfo,
    } = this.state;
    const { downloads } = this.props;
    if (importing) {
      return (
        <div className="d-flex justify-content-center mt-5">
          Import &emsp;
          <Spinner animation="border" variant="light" />
        </div>
      );
    }
    let candidatesElement: JSX.Element = <div className="d-flex justify-content-center mt-5"><Spinner animation="border" variant="light" /></div>;
    if ((mediaType === 'movie' && movieCandidates && movieCandidates.length === 0) || (mediaType === 'tvshow' && tvshowCandidates && tvshowCandidates.length === 0)) {
      candidatesElement = <p className="text-muted">Aucun résultat</p>;
    } else if (mediaType === 'movie' && movieCandidates && movieCandidates.length > 0) {
      candidatesElement = (
        <div className="d-flex flex-wrap justify-content-evenly mt-3">
          {movieCandidates.map((candidate) => (
            <div key={candidate.id} className={`media-card movie ${selectedMovieCandidate?.id === candidate.id ? 'selected' : ''}`} onClick={this.handleMovieCandidateClick.bind(this, candidate)}>
              <span className="poster" style={{ backgroundImage: `url(${ctx.tmdbClient.baseUrl}w342${candidate.poster_path})` }} />
              <span className="title">{candidate.title}</span>
              <span className="infos d-flex justify-content-between">
                <span className="year">{candidate.release_date?.substring(0, 4)}</span>
                <span className="duration" onClick={(evt) => evt.stopPropagation()}>
                  id
                  {candidate.id}
                </span>
              </span>
            </div>
          ))}
        </div>
      );
    } else if (mediaType === 'tvshow' && tvshowCandidates && tvshowCandidates.length > 0) {
      candidatesElement = (
        <div className="d-flex flex-wrap justify-content-evenly mt-3">
          {tvshowCandidates.map((candidate) => (
            <div key={candidate.id} className={`media-card movie ${selectedTvshowCandidate?.id === candidate.id ? 'selected' : ''}`} onClick={this.handleTvshowCandidateClick.bind(this, candidate)}>
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

    if (showRawMediaInfo) {
      candidatesElement = (
        <Row>
          <Col sm={6}><pre>{JSON.stringify(fileInfo?.rawData, null, '  ')}</pre></Col>
          <Col sm={6}>{candidatesElement}</Col>
        </Row>
      );
    }

    return (
      <>
        <h4 className="mx-3 my-5">{ downloads[0].path.replace(ctx.config.seedboxPath, '') }</h4>
        <Form className="m-3">
          <Row className="justify-content-md-center mb-3">
            <Col>
              <InputGroup>
                <InputGroup.Text>Titre</InputGroup.Text>
                <Form.Control value={title} onChange={this.handleTitleChange.bind(this)} onKeyDown={(evt) => { if (evt.code === 'Enter') this.handleSearchClick(); }} />
                <InputGroup.Text>
                  <Form.Check inline checked={mediaType === 'movie'} onChange={() => this.setState({ mediaType: 'movie' })} label="Film" name="mediatype" type="radio" id="inline-radio-movie" />
                  <Form.Check inline checked={mediaType === 'tvshow'} onChange={() => this.setState({ mediaType: 'tvshow' })} label="Série" name="mediatype" type="radio" id="inline-radio-tvshow" />
                </InputGroup.Text>
              </InputGroup>
            </Col>
            <Col md="auto">
              <InputGroup>
                <InputGroup.Text>Année</InputGroup.Text>
                <Form.Control value={year} onChange={this.handleYearChange.bind(this)} style={{ width: '4rem' }} disabled={mediaType !== 'movie'} />
                <Button variant="outline-secondary" onClick={this.handleClearYear.bind(this)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
                  </svg>
                </Button>
              </InputGroup>
            </Col>
            <Col md="auto">
              <Button variant="dark" onClick={this.handleSearchClick.bind(this)}>Rechercher</Button>
            </Col>
          </Row>
          <Row className="justify-content-md-center mb-3">
            <Col>
              {mediaType === 'movie'
                ? (
                  <InputGroup>
                    <InputGroup.Text>{ctx.config.moviesRemotePath}</InputGroup.Text>
                    <Form.Control value={importedFilename} onChange={this.handleFilenameChange.bind(this)} onKeyDown={(evt) => { if (evt.code === 'Enter') this.handleImportClick(); }} />
                    <Button variant={showRawMediaInfo ? 'secondary' : 'outline-secondary'} onClick={this.handleShowRawMediaInfoClick.bind(this)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-info-lg" viewBox="0 0 16 16"><path d="m9.708 6.075-3.024.379-.108.502.595.108c.387.093.464.232.38.619l-.975 4.577c-.255 1.183.14 1.74 1.067 1.74.72 0 1.554-.332 1.933-.789l.116-.549c-.263.232-.65.325-.905.325-.363 0-.494-.255-.402-.704l1.323-6.208Zm.091-2.755a1.32 1.32 0 1 1-2.64 0 1.32 1.32 0 0 1 2.64 0Z" /></svg>
                    </Button>
                  </InputGroup>
                )
                : (
                  <InputGroup>
                    <InputGroup.Text className="flex-shrink-1 text-truncate" style={{ minWidth: '0', maxWidth: '33%' }} title={`${ctx.config.tvshowsRemotePath}\\`}>{`${ctx.config.tvshowsRemotePath}\\`}</InputGroup.Text>
                    <Form.Control value={importedFilename} onChange={this.handleFilenameChange.bind(this)} onKeyDown={(evt) => { if (evt.code === 'Enter') this.handleImportClick(); }} className="flex-grow-1" />
                    <InputGroup.Text className="flex-shrink-1 text-truncate" style={{ minWidth: '0', maxWidth: '33%' }} title={`\\${downloads[0].path.split('/').pop()}`}>{`\\${downloads[0].path.split('/').pop()}`}</InputGroup.Text>
                    <Button variant={showRawMediaInfo ? 'secondary' : 'outline-secondary'} onClick={this.handleShowRawMediaInfoClick.bind(this)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-info-lg" viewBox="0 0 16 16"><path d="m9.708 6.075-3.024.379-.108.502.595.108c.387.093.464.232.38.619l-.975 4.577c-.255 1.183.14 1.74 1.067 1.74.72 0 1.554-.332 1.933-.789l.116-.549c-.263.232-.65.325-.905.325-.363 0-.494-.255-.402-.704l1.323-6.208Zm.091-2.755a1.32 1.32 0 1 1-2.64 0 1.32 1.32 0 0 1 2.64 0Z" /></svg>
                    </Button>
                  </InputGroup>
                )}
            </Col>
            <Col md="auto">
              <Button onClick={this.handleImportClick.bind(this)}>Importer</Button>
              <Button variant="link" onClick={this.handleCancelClick.bind(this)}>Annuler</Button>
            </Col>
          </Row>
        </Form>
        {candidatesElement}
      </>
    );
  }
}
