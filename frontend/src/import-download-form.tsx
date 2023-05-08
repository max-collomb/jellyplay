import React from 'react';

import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';
import { MovieResult } from 'moviedb-promise/dist/request-types';

import { DbDownload, FileInfo /* , ParsedShow, ParsedMovie */ } from '../../api/src/types';

import { ctx } from './common';

type ImportDownloadFormProps = {
  download: DbDownload;
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
  candidates?: MovieResult[];
  selectedCandidate?: MovieResult;
  importing: boolean;
  showRawMediaInfo: boolean;
};

export default class ImportDownloadForm extends React.Component<ImportDownloadFormProps, ImportDownloadFormState> {
  constructor(props: ImportDownloadFormProps) {
    super(props);
    const { download } = this.props;
    this.state = {
      title: '',
      year: '',
      importedFilename: '',
      importing: false,
      mediaType: 'movie',
      showRawMediaInfo: false,
    };
    ctx.apiClient.parseFilename(download.path)
      .then((data) => {
        const state: ImportDownloadFormState = { ...this.state };
        state.fileInfo = data.fileInfo;
        if (/S\d+E\d+/i.test(download.path)) {
          state.mediaType = 'tvshow';
          state.title = data.asTvshow?.title || data.title;
          state.year = '';
        } else {
          state.mediaType = 'movie';
          state.title = data.asMovie?.title || data.title;
          state.year = data.asMovie?.year || data.year || '';
        }
        this.setState(state, this.handleSearchClick.bind(this));
      });
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
    this.setState({ candidates: undefined, year: '' }, this.handleSearchClick.bind(this));
    evt.preventDefault();
  }

  async handleCandidateClick(candidate: MovieResult, evt: React.MouseEvent<HTMLElement>): Promise<void> {
    this.setState({
      selectedCandidate: candidate,
      importedFilename: this.generateFilename(candidate.title || '', candidate.release_date?.substring(0, 4) || '', candidate.original_language || ''),
    });
    // const { onClose } = this.props;
    // let { movie } = this.props;
    // if (candidate.id) {
    //   movie = await ctx.apiClient.fixMovieMetadata(movie.filename, candidate.id);
    // }
    // onClose();
    evt.preventDefault();
  }

  async handleImportClick(evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    const { download, onClose } = this.props;
    const { importedFilename, selectedCandidate } = this.state;
    this.setState({ importing: true });
    if (selectedCandidate?.id) {
      try {
        const movie = await ctx.apiClient.importMovieDownload(download.path, selectedCandidate.id, parseFloat(selectedCandidate.release_date?.substring(0, 4) || ''), importedFilename);
        if (movie) {
          onClose();
        }
      } catch (e) {
        // eslint-disable-next-line no-alert
        alert(e);
      }
      this.setState({ importing: false });
    }
  }

  async handleSearchClick(evt?: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    if (evt) {
      evt.preventDefault();
    }
    const { title, year } = this.state;
    const candidates: MovieResult[] | undefined = await ctx.tmdbClient.getMovieCandidates(title, year);
    const state: ImportDownloadFormState = { ...this.state, candidates };
    if (candidates && candidates.length > 0) {
      state.selectedCandidate = candidates[0];
      state.importedFilename = this.generateFilename(candidates[0].title || '', candidates[0].release_date?.substring(0, 4) || '', candidates[0].original_language || '');
    }
    this.setState(state);
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

  generateFilename(title: string, year: string, originalLang: string): string {
    const { fileInfo } = this.state;
    const { download } = this.props;
    const path = download.path.toLowerCase();
    const duration = Math.round((fileInfo?.duration || 0) / 60);
    let definition = ' ';
    const width = fileInfo?.video.width || 0;
    const height = fileInfo?.video.height || 0;
    if (width > 3800 || height > 2000) {
      definition = ' 2160p ';
    } else if (width > 1900 || height > 1000) {
      definition = ' 1080p ';
    } else if (width > 1200 || height > 700) {
      definition = ' 720p ';
    }
    let hasFR = false;
    let hasEN = false;
    fileInfo?.audio.forEach((a) => {
      if (a.lang.toLowerCase().startsWith('fr')) {
        hasFR = true;
      } else if (a.lang.toLowerCase().startsWith('en') || a.lang.toLowerCase().includes('anglais')) {
        hasEN = true;
      }
    });
    let hasFRsubs = false;
    fileInfo?.subtitles.forEach((s) => {
      if (s.toLowerCase().startsWith('fr')) {
        hasFRsubs = true;
      }
    });
    let vf = 'vf';
    if (originalLang === 'fr') {
      vf = 'vof';
    } else if (path.includes('vfq')) {
      vf = 'vfq';
    } else if (path.includes('vff') || path.includes('truefrench')) {
      vf = 'vff';
    }
    let language = '';
    if (hasFR && hasEN && hasFRsubs) {
      language = `${vf}+vost`;
    } else if (hasFR && !hasEN) {
      language = vf;
    } else if (hasEN && hasFRsubs) {
      language = 'vost';
    }
    return `${title} (${year}) [${duration}'${definition}${language}]${path.substring(path.lastIndexOf('.'))}`;
  }

  render(): JSX.Element {
    const {
      candidates, title, importing, year, mediaType, selectedCandidate, importedFilename, fileInfo, showRawMediaInfo,
    } = this.state;
    const { download } = this.props;
    if (importing) {
      return (
        <div className="d-flex justify-content-center mt-5">
          Import &emsp;
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
            <div key={candidate.id} className={`media-card movie ${selectedCandidate?.id === candidate.id ? 'selected' : ''}`} onClick={this.handleCandidateClick.bind(this, candidate)}>
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
        <h4 className="mx-3 my-5">{ download.path }</h4>
        <Form className="m-3">
          <Row className="justify-content-md-center mb-3">
            <Col>
              <InputGroup>
                <InputGroup.Text>Titre</InputGroup.Text>
                <Form.Control value={title} onChange={this.handleTitleChange.bind(this)} />
                <InputGroup.Text>
                  <Form.Check inline checked={mediaType === 'movie'} onChange={() => {}} label="Film" name="mediatype" type="radio" id="inline-radio-movie" />
                  <Form.Check inline checked={mediaType === 'tvshow'} onChange={() => { }} label="Série" name="mediatype" type="radio" id="inline-radio-tvshow" />
                </InputGroup.Text>
              </InputGroup>
            </Col>
            <Col md="auto">
              <InputGroup>
                <InputGroup.Text>Année</InputGroup.Text>
                <Form.Control value={year} onChange={this.handleYearChange.bind(this)} style={{ width: '4rem' }} />
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
              <InputGroup>
                <InputGroup.Text>{ctx.config.tmpPath}</InputGroup.Text>
                <Form.Control value={importedFilename} onChange={this.handleFilenameChange.bind(this)} />
                <Button variant={showRawMediaInfo ? 'secondary' : 'outline-secondary'} onClick={this.handleShowRawMediaInfoClick.bind(this)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-info-lg" viewBox="0 0 16 16"><path d="m9.708 6.075-3.024.379-.108.502.595.108c.387.093.464.232.38.619l-.975 4.577c-.255 1.183.14 1.74 1.067 1.74.72 0 1.554-.332 1.933-.789l.116-.549c-.263.232-.65.325-.905.325-.363 0-.494-.255-.402-.704l1.323-6.208Zm.091-2.755a1.32 1.32 0 1 1-2.64 0 1.32 1.32 0 0 1 2.64 0Z" /></svg>
                </Button>
              </InputGroup>
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
