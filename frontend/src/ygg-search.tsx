import React from 'react';

import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import InputGroup from 'react-bootstrap/InputGroup';

import { ctx } from './common';
import { YggResult } from '../../api/src/ygg-proxy';
import { yggClient } from './ygg-client';

const torrentDownloaded: string[] = [];

type YggSearchProps = {
  search: string;
  isAnim: boolean;
};
type YggSearchState = {
  search: string;
  results: YggResult[];
  yggItemDetails?: YggResult;
  loading: boolean;
  showMore: boolean;
  isAnim: boolean;
};

export default class YggSearch extends React.Component<YggSearchProps, YggSearchState> {
  constructor(props: YggSearchProps) {
    super(props);
    this.state = {
      search: props.search,
      results: [],
      loading: false,
      showMore: false,
      isAnim: !!props.isAnim,
    };
  }

  componentDidMount() {
    this.search();
  }

  componentDidUpdate(prevProps: YggSearchProps) {
    const { search } = this.props;
    if (prevProps.search !== search && search !== '') {
      this.setState({ search });
      this.search();
    }
  }

  handleSearchChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ search: evt.target.value });
  }

  handleSearchClick(evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    this.search();
  }

  handleYggDetailsClick(yggItem: YggResult, evt: React.MouseEvent<HTMLAnchorElement>): void {
    evt.preventDefault();
    if (ctx.yggClient.isCloudFlareActive) {
      document.location.href = `browser://${encodeURIComponent(yggItem.url)}`;
      return;
    }
    const { yggItemDetails } = this.state;
    this.setState({ yggItemDetails: yggItemDetails?.id === yggItem.id ? undefined : yggItem });
  }

  async handleYggDownloadClick(yggItem: YggResult, evt: React.MouseEvent<HTMLAnchorElement>): Promise<void> {
    evt.preventDefault();
    if (ctx.yggClient.isCloudFlareActive) {
      alert('Le téléchargement ne fonctionne pas pour le moment.\nUtliser la liste d\'envies'); // eslint-disable-line no-alert
      return;
    }
    if (await ctx.yggClient.download(yggItem.downloadUrl)) {
      torrentDownloaded.push(yggItem.id);
      this.forceUpdate();
    } else {
      alert('Une erreur est survenue'); // eslint-disable-line no-alert
    }
  }

  handleToggleShowMore(evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    const { showMore } = this.state;
    this.setState({ showMore: !showMore });
  }

  async search() {
    const { search, isAnim } = this.state;
    if (search?.length) {
      this.setState({ results: [], loading: true });
      const results = await ctx.yggClient.search(search, isAnim ? yggClient.categories.anim : yggClient.categories.movies);
      this.setState({
        loading: false,
        results,
      });
    }
  }

  render(): JSX.Element {
    const {
      search, results, loading, showMore, yggItemDetails, isAnim,
    } = this.state;
    return (
      <div>
        <Form className="m-3">
          <Row className="justify-content-md-center">
            <Col>
              <InputGroup className="mb-2">
                <InputGroup.Text>Titre</InputGroup.Text>
                <Form.Control value={search} onChange={this.handleSearchChange.bind(this)} />
                <InputGroup.Text><Form.Check type="checkbox" id="is-anim" label="Animation" checked={isAnim} onChange={() => this.setState({ isAnim: !isAnim })} /></InputGroup.Text>
              </InputGroup>
            </Col>
            <Col md="auto">
              <Button type="submit" className="mb-2" onClick={this.handleSearchClick.bind(this)}>Rechercher</Button>
            </Col>
          </Row>
        </Form>

        <table className="table table-bordered table-striped" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th>Nom</th>
              <th style={{ width: '100px' }}>Age</th>
              <th style={{ width: '100px' }}>Taille</th>
              <th style={{ width: '75px' }}>Seed</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result: YggResult) => (
              <React.Fragment key={result.id}>
                <tr className={showMore || result.rank > 0 ? '' : 'd-none'}>
                  <td>
                    <div className="d-flex">
                      <Badge bg="primary" className="align-self-center me-3">{ctx.yggClient.getCategoryNameById(result.category)}</Badge>
                      <a href={result.url} onClick={this.handleYggDetailsClick.bind(this, result)} className="flex-grow-1 text-truncate align-self-center">{result.name}</a>
                      {torrentDownloaded.includes(result.id) ? <Button variant="dark" className="mx-3" disabled title="Téléchargement en cours sur la seedbox">Téléchargement...</Button> : <a href="#" className="btn btn-success mx-3" onClick={this.handleYggDownloadClick.bind(this, result)}>Télécharger</a>}
                      <a href={`browser://${encodeURIComponent(result.url)}`} className="align-self-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-box-arrow-up-right" viewBox="0 0 16 16">
                          <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
                          <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
                        </svg>
                      </a>
                    </div>
                  </td>
                  <td className="text-truncate" style={{ verticalAlign: 'middle' }}>{result.age.replace(/ /g, '\u00A0')}</td>
                  <td className="text-truncate" style={{ verticalAlign: 'middle' }}>{result.size}</td>
                  <td className="text-truncate" style={{ verticalAlign: 'middle' }}>{result.seeds}</td>
                </tr>
                {result.id === yggItemDetails?.id
                  ? (
                    <tr>
                      <td colSpan={4}>
                        <iframe id="ygg-iframe" src={`/ygg/details?url=${encodeURIComponent(result.url)}`} style={{ width: '100%', height: '75vh', maxHeight: '1000px' }} title="details" />
                      </td>
                    </tr>
                  )
                  : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <div className="text-ent mt-3">
          <Button variant="dark" onClick={this.handleToggleShowMore.bind(this)}>
            {showMore ? 'Afficher moins' : 'Afficher plus'}
          </Button>
        </div>

        { loading
          ? <div className="text-center"><Spinner animation="border" variant="light" /></div>
          : null }
      </div>
    );
  }
}
