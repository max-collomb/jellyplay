import React from 'react';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Dropdown from 'react-bootstrap/Dropdown';
import Form from 'react-bootstrap/Form';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Stack from 'react-bootstrap/Stack';

import {
  DbDownload, SeedboxTorrent, SeedboxFilter, Quotas,
} from '../../api/src/types';
import { getMovieAudiences, getTvshowAudiences } from '../../api/src/audience';

import {
  ctx, renderFileSize, renderRelativeTimeString, parseFilename, playVideoFile, searchCandidates,
} from './common';
import ImportDownloadForm from './import-download-form';

type GroupedDownloads = {
  [key: string]: DbDownload[];
};

type DownloadsProps = {};
type DownloadsState = {
  downloads?: DbDownload[];
  torrents?: SeedboxTorrent[];
  showAllDownloads: boolean;
  showAllImportButtons: boolean;
  importingDownloads?: DbDownload[];
  autoImportingDownloads: string[];
  quotas?: Quotas;
  filters?: SeedboxFilter[];
};

export default class Downloads extends React.Component<DownloadsProps, DownloadsState> {
  timer: NodeJS.Timer | undefined = undefined;

  constructor(props: DownloadsProps) {
    super(props);
    this.state = { showAllDownloads: false, showAllImportButtons: false, autoImportingDownloads: [] };
    this.refreshDownloads();
    ctx.apiClient.getSeedboxQuota().then((quotas) => this.setState({ quotas }));
    ctx.apiClient.getSeedboxFilters().then((filters) => this.setState({ filters }));
  }

  componentDidMount(): void {
    this.timer = setInterval(this.refreshDownloads.bind(this), 3000);
  }

  componentDidUpdate() {
    if (ctx.apiClient.needRefresh('downloads')) {
      this.refreshDownloads();
    }
  }

  componentWillUnmount(): void {
    clearInterval(this.timer);
  }

  async handleIgnoreDownloadClick(path: string, evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    await ctx.apiClient.ignoreDownload(path);
    this.refreshDownloads();
  }

  async handleDeleteDownload(path: string, evt: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    evt.preventDefault();
    await ctx.apiClient.deleteDownload(path);
    this.refreshDownloads();
  }

  handleImportDownloadClick(downloads: DbDownload[], evt: React.MouseEvent<HTMLButtonElement>): void {
    evt.preventDefault();
    this.setState({ importingDownloads: downloads });
  }

  async handleAutoImportDownloadClick(downloads: DbDownload[], evt: React.MouseEvent<HTMLElement>): Promise<void> {
    evt.preventDefault();
    const { autoImportingDownloads } = this.state;
    const newImportingDownloads = [];
    for (const download of downloads) {
      if (!autoImportingDownloads.includes(download.path)) {
        autoImportingDownloads.push(download.path);
        newImportingDownloads.push(download);
      }
    }
    this.setState({ autoImportingDownloads });
    for (const download of newImportingDownloads) {
      if ((download.autoId?.mediaType === 'movie' || download.autoId?.mediaType === 'tvshow') && download.autoId?.tmdbId) {
        try {
          if (download.autoId?.mediaType === 'movie') {
            // eslint-disable-next-line no-await-in-loop
            const result = await ctx.apiClient.importMovieDownload(download.path, download.autoId?.tmdbId, download.autoId?.year, download.autoId?.filename, download.autoId?.audience);
            if (result) {
              this.refreshDownloads();
            }
          } else /* if (download.autoId?.mediaType === 'tvshow') */ {
            // eslint-disable-next-line no-await-in-loop
            const result = await ctx.apiClient.importTvshowDownload(download.path, download.autoId?.tmdbId, download.autoId?.filename, download.autoId?.audience);
            if (result) {
              this.refreshDownloads();
            }
          }
        } catch (e) {
          alert(e); // eslint-disable-line no-alert
        }
      }
    }
  }

  handleImportFormClose(): void {
    this.setState({ importingDownloads: undefined });
    this.refreshDownloads();
  }

  handleRemoveTorrent(hash: string): void {
    ctx.apiClient.removeSeedboxTorrent(hash).then(() => this.refreshDownloads.bind(this));
  }

  handleFilenameClick(path: string, evt: React.MouseEvent<HTMLElement>): void {
    evt.preventDefault();
    // console.log(`${ctx.config.tmpPath}/${path.split(/[\\/]/).pop()}`);
    playVideoFile(`${ctx.config.tmpPath}/${path.split(/[\\/]/).pop()}`);
  }

  async handleSetAudience(downloads: DbDownload[], audience: number, evt: React.MouseEvent<HTMLElement>): Promise<void> {
    evt.preventDefault();
    const promises = [];
    for (const download of downloads) {
      if (download.autoId) {
        promises.push(ctx.apiClient.setAutoId(download.path, { ...download.autoId, audience }));
      }
    }
    await Promise.all(promises);
    this.refreshDownloads();
  }

  refreshDownloads(): void {
    const { importingDownloads } = this.state;
    if (!importingDownloads) {
      ctx.apiClient.getDownloads().then((downloads) => { this.setState({ downloads }, this.autoIdentifyDownloads.bind(this)); });
      ctx.apiClient.getSeedboxDownloads().then((torrents) => { this.setState({ torrents }); });
    }
  }

  async autoIdentifyDownloads(): Promise<void> {
    const { downloads, autoImportingDownloads } = this.state;
    if (downloads) {
      const pendingDownloads = downloads.filter((dn) => dn.finished > 0 && !dn.imported && !dn.ignored);
      // nettoyage de la liste autoImportingDownloads (après un import réussi, par exemple)
      const pendingDownloadPathes = pendingDownloads.map((dn) => dn.path);
      const prunedAutoImportingDownloads = autoImportingDownloads.filter((path) => pendingDownloadPathes.includes(path));
      if (prunedAutoImportingDownloads.length !== autoImportingDownloads.length) {
        this.setState({ autoImportingDownloads: prunedAutoImportingDownloads });
      }
      // première boucle pour éviter d'identifier plusieurs fois les épisodes d'une même série
      for (const download of pendingDownloads) {
        if (!download.autoId) {
          if (download.finished > 0 && ['.avi', '.mkv', '.mp4', '.mpg', '.mpeg', '.wmv'].includes(download.path.substring(download.path.lastIndexOf('.')).toLowerCase())) {
            // première étape : on créé l'objet autoId avec le username en cours pour réserver l'autoIdentification. Un seul client fait l'auto-identification
            // eslint-disable-next-line no-await-in-loop
            await ctx.apiClient.setAutoId(download.path, {
              username: ctx.user?.name || '', mediaType: '', tvshowExists: false, tmdbId: -1, filename: '', audience: 999, year: 0,
            });
          }
        } else if (download.autoId.username && download.autoId.tmdbId === -1 && download.autoId.username === ctx.user?.name) {
          // deuxième étape : auto-identification
          // eslint-disable-next-line no-await-in-loop
          const parsedFilename = await parseFilename(download.path);
          // eslint-disable-next-line no-await-in-loop
          const results = await searchCandidates(parsedFilename.title, parsedFilename.year, parsedFilename.mediaType, [download], parsedFilename.fileInfo, parsedFilename.existingTvshows);
          if (parsedFilename.mediaType === 'movie' && results.selectedMovieCandidate && results.selectedMovieCandidate.id) {
            // eslint-disable-next-line no-await-in-loop
            const movieInfo: any = await ctx.tmdbClient.getMovie(results.selectedMovieCandidate.id);
            const audiences = getMovieAudiences(movieInfo?.release_dates?.results);
            // eslint-disable-next-line no-await-in-loop
            await ctx.apiClient.setAutoId(download.path, {
              username: ctx.user?.name || '',
              mediaType: 'movie',
              tvshowExists: false,
              tmdbId: results.selectedMovieCandidate.id,
              filename: results.importedFilename,
              posterPath: results.selectedMovieCandidate.poster_path,
              title: results.selectedMovieCandidate.title,
              audience: audiences.length ? Math.max.apply(null, audiences) : 999,
              year: parseFloat(results.selectedMovieCandidate.release_date?.substring(0, 4) || ''),
            });
          } else if (parsedFilename.mediaType === 'tvshow' && results.selectedTvshowCandidate && results.selectedTvshowCandidate.id) {
            // eslint-disable-next-line no-await-in-loop
            const tvshowInfo: any = await ctx.tmdbClient.getTvshow(results.selectedTvshowCandidate.id);
            const audiences = getTvshowAudiences(tvshowInfo?.content_ratings?.results);
            // eslint-disable-next-line no-await-in-loop
            await ctx.apiClient.setAutoId(download.path, {
              username: ctx.user?.name || '',
              mediaType: 'tvshow',
              tvshowExists: results.tvshowExists === true,
              tmdbId: results.selectedTvshowCandidate.id,
              filename: results.importedFilename,
              posterPath: results.selectedTvshowCandidate.poster_path,
              title: results.selectedTvshowCandidate.name,
              audience: audiences.length ? Math.max.apply(null, audiences) : 999,
              year: parseFloat(results.selectedTvshowCandidate.first_air_date?.substring(0, 4) || ''),
            });
          }
        }
      }
    }
  }

  render(): JSX.Element {
    const {
      downloads, showAllDownloads, showAllImportButtons, importingDownloads, torrents, filters, quotas, autoImportingDownloads,
    } = this.state;
    if (importingDownloads) {
      return <ImportDownloadForm downloads={importingDownloads} onClose={this.handleImportFormClose.bind(this)} />;
    }

    let seedboxQuotaProgressBar: JSX.Element = <></>;
    let nasQuotaProgressBar: JSX.Element = <div className="align-self-center flex-grow-1">&nbsp;</div>;
    if (quotas) {
      const seedboxQuotaUsed: number = Math.round(100 * ((quotas.seedbox.total - quotas.seedbox.free) / quotas.seedbox.total));
      seedboxQuotaProgressBar = (
        <>
          <div className="align-self-center">{`${renderFileSize(quotas.seedbox.free)} libres sur ${renderFileSize(quotas.seedbox.total)}`}</div>
          <ProgressBar variant={seedboxQuotaUsed < 50 ? 'success' : (seedboxQuotaUsed < 80 ? 'warning' : 'danger')} now={seedboxQuotaUsed} label={`${seedboxQuotaUsed}%`} className="mx-3 flex-grow-1 align-self-center" />
        </>
      );
      const nasQuotaUsed: number = Math.round(100 * ((quotas.nas.total - quotas.nas.free) / quotas.nas.total));
      nasQuotaProgressBar = (
        <>
          <div className="align-self-center">{`${renderFileSize(quotas.nas.free)} libres sur ${renderFileSize(quotas.nas.total)}`}</div>
          <ProgressBar variant={nasQuotaUsed < 90 ? 'success' : (nasQuotaUsed < 95 ? 'warning' : 'danger')} now={nasQuotaUsed} label={`${nasQuotaUsed}%`} className="mx-3 flex-grow-1 align-self-center" />
        </>
      );
    }

    const groupedDownloads: GroupedDownloads = {};
    (downloads || []).filter((dn) => (!dn.ignored && !dn.imported) || showAllDownloads).reverse().forEach((dn) => {
      let prefix: string = dn.path;
      let match = dn.path.match(/(.*?)S\d{1,2}E\d{1,3}(?!\d)/i);
      if (match) { prefix = match[1]; }
      match = dn.path.match(/(.*?)\d{1,2}x\d{2,3}(?!\d)/i);
      if (match) { prefix = match[1]; }
      if (!groupedDownloads[prefix]) { groupedDownloads[prefix] = []; }
      groupedDownloads[prefix].push(dn);
    });

    const downloadCards: JSX.Element[] = [];
    for (const prefix in groupedDownloads) {
      if (Object.prototype.hasOwnProperty.call(groupedDownloads, prefix)) {
        const showImportButton = groupedDownloads[prefix].length === 1 || showAllImportButtons;
        if (groupedDownloads[prefix].length > 1) {
          const groupIsBeingImported = groupedDownloads[prefix].every((dn) => autoImportingDownloads.includes(dn.path));
          const groupCanBeImported = groupedDownloads[prefix].every((dn) => dn.finished > 0 && !dn.imported && !dn.ignored);
          const hasAutoId = !groupedDownloads[prefix][0].imported && groupedDownloads[prefix][0].autoId && groupedDownloads[prefix][0].autoId?.tmdbId;
          const hasAudience = groupedDownloads[prefix][0].autoId?.audience && groupedDownloads[prefix][0].autoId?.audience !== 999;
          const tvshowExists = groupedDownloads[prefix][0].autoId?.tvshowExists === true;
          const path = (prefix.startsWith(ctx.config.seedboxPath)) ? prefix.substring(ctx.config.seedboxPath.length + 1) : prefix;
          downloadCards.push(
            <Card className="download-card" key={prefix}>
              <Stack direction="horizontal" gap={3}>
                {hasAutoId && groupCanBeImported && !showAllImportButtons
                  ? (
                    <div key={groupedDownloads[prefix][0].autoId?.tmdbId} className="media-card movie" onClick={() => ctx.router.navigateTo(`#/tmdb/${groupedDownloads[prefix][0].autoId?.mediaType}/${groupedDownloads[prefix][0].autoId?.tmdbId}/state/${JSON.stringify({ tabKey: 'cast' })}`)} title={`${groupedDownloads[prefix][0].autoId?.title} (${groupedDownloads[prefix][0].autoId?.year})\n${groupedDownloads[prefix][0].autoId?.filename}`}>
                      <span className="poster" style={groupedDownloads[prefix][0].autoId?.posterPath ? { backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w92${groupedDownloads[prefix][0].autoId?.posterPath})` } : { background: 'rgba(255,255,255,0.025)' }} />
                    </div>
                  )
                  : null}
                <Card.Body>
                  <div className="d-flex">
                    <span className="text-truncate text-muted" title={path}>{path}</span>
                  </div>
                  <div className="d-flex mt-3">
                    <span className={`me-3 align-self-center flex-shrink-0${hasAutoId && groupCanBeImported && !showAllImportButtons ? '' : ' d-none'}`}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8" /></svg></span>
                    <span className={`align-self-center flex-grow-1 text-truncate${hasAutoId && groupCanBeImported && !showAllImportButtons ? '' : ' invisible'}`} title={groupedDownloads[prefix][0].autoId?.filename}>{groupedDownloads[prefix][0].autoId?.filename}</span>
                    <div className={`align-self-center pe-2 ${!groupCanBeImported || showAllImportButtons || tvshowExists ? 'd-none' : ''}`}>
                      {[0, 10, 12, 16, 18, 999].map((a) => <a key={a} className={`audience-link ${groupedDownloads[prefix][0].autoId?.audience === a ? '' : 'inactive'} p-1${ctx.user?.admin ? '' : ' disabled'}`} onClick={this.handleSetAudience.bind(this, groupIsBeingImported ? [] : groupedDownloads[prefix], a)}><img src={`/images/classification/${a}.svg`} alt={`-${a}`} width="20" /></a>)}
                    </div>
                    <Dropdown as={ButtonGroup}>
                      <Button className="ms-auto align-self-center" disabled={!groupCanBeImported || showAllImportButtons || groupIsBeingImported || !hasAudience} variant="primary" onClick={hasAutoId ? this.handleAutoImportDownloadClick.bind(this, groupedDownloads[prefix]) : this.handleImportDownloadClick.bind(this, groupedDownloads[prefix])}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                        </svg>
                        &ensp;
                        { hasAutoId ? 'Importer' : 'Identifier et importer'}
                        { groupIsBeingImported ? <Spinner animation="border" size="sm" className="ms-2" /> : null }
                      </Button>
                      <Dropdown.Toggle split variant="primary" id="dropdown-custom-3" />
                      <Dropdown.Menu>
                        <Dropdown.Item eventKey="1" onClick={this.handleImportDownloadClick.bind(this, groupedDownloads[prefix])} disabled={!groupCanBeImported || showAllImportButtons}>Identifier et importer</Dropdown.Item>
                        <Dropdown.Item eventKey="2" onClick={() => this.setState({ showAllImportButtons: !showAllImportButtons })}>{showAllImportButtons ? 'Importer par lot' : 'Importer individuellement'}</Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                </Card.Body>
              </Stack>
            </Card>,
          );
        }
        for (const download of groupedDownloads[prefix]) {
          let { path } = download;
          if (download.path.startsWith(ctx.config.seedboxPath)) path = download.path.substring(ctx.config.seedboxPath.length + 1);
          const title = path;
          const isNew = !download.imported && !download.ignored;
          const isIgnored = !download.imported && download.ignored;
          const isBeingImported = autoImportingDownloads.includes(download.path);
          const hasAutoId = (groupedDownloads[prefix].length <= 1 || showAllImportButtons) && !download.imported && download.autoId && download.autoId.tmdbId;
          const tvshowExists = download.autoId?.tvshowExists === true;
          const hasAudience = download.autoId?.audience && download.autoId?.audience !== 999;
          if (path.includes('/')) path = path.substring(path.lastIndexOf('/') + 1);
          downloadCards.push(
            <Card className={`download-card${groupedDownloads[prefix].length > 1 ? ' grouped' : ''}`} key={path}>
              <Stack direction="horizontal">
                {hasAutoId
                  ? (
                    <div key={download.autoId?.tmdbId} className="media-card movie" onClick={() => ctx.router.navigateTo(`#/tmdb/${download.autoId?.mediaType}/${download.autoId?.tmdbId}/state/${JSON.stringify({ tabKey: 'cast' })}`)} title={`${download.autoId?.title} (${download.autoId?.year})\n${download.autoId?.filename}`}>
                      <span className="poster" style={download.autoId?.posterPath ? { backgroundImage: `url(${ctx.tmdbClient?.baseUrl}w92${download.autoId?.posterPath})` } : { background: 'rgba(255,255,255,0.025)' }} />
                    </div>
                  )
                  : null}
                <Card.Body>
                  <div className="d-flex overflow-hidden">
                    <a className="text-truncate text-muted" href="#" onClick={this.handleFilenameClick.bind(this, download.path)} title={title}>{path}</a>
                    <span className={`mx-3 flex-shrink-0${hasAutoId ? '' : ' d-none'}`}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8" /></svg></span>
                    <span className={`text-truncate flex-shrink-0${hasAutoId ? '' : ' d-none'}`} title={download.autoId?.filename}>{download.autoId?.filename}</span>
                  </div>
                  <div className="d-flex mt-3">
                    <span className="align-self-center">{renderFileSize(download.size)}</span>
                    {download.finished < 0
                      ? (
                        <>
                          <ProgressBar variant="primary" now={download.progress} label={`${download.progress.toFixed(1)}%`} className="flex-grow-1 align-self-center mx-3" />
                          <Button variant="danger" onClick={this.handleDeleteDownload.bind(this, download.path)} title="Supprimer (re-télécharger)" disabled={!ctx.user?.admin}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-x-circle-fill" viewBox="0 0 16 16">
                              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />
                            </svg>
                          </Button>
                        </>
                      )
                      : (
                        <>
                          <span className="opacity-50 mx-3 flex-grow-1 align-self-center" title={(new Date(download.finished)).toLocaleString()}>{renderRelativeTimeString(download.finished)}</span>
                          {(isIgnored
                            ? <Button className="ms-auto align-self-center" variant="link" onClick={this.handleIgnoreDownloadClick.bind(this, download.path)}>Importer</Button>
                            : (
                              <>
                                <div className={`align-self-center pe-2 ${showImportButton && !tvshowExists && isNew ? '' : 'd-none'}`}>
                                  {[0, 10, 12, 16, 18, 999].map((a) => <a key={a} className={`audience-link ${download.autoId?.audience === a ? '' : 'inactive'} p-1${ctx.user?.admin ? '' : ' disabled'}`} onClick={this.handleSetAudience.bind(this, isBeingImported ? [] : [download], a)}><img src={`/images/classification/${a}.svg`} alt={`-${a}`} width="20" /></a>)}
                                </div>
                                <Dropdown as={ButtonGroup} className={showImportButton ? '' : 'd-none'}>
                                  <Button variant="primary" className={isNew ? '' : ' invisible'} disabled={isBeingImported || !hasAudience} onClick={hasAutoId ? this.handleAutoImportDownloadClick.bind(this, [download]) : this.handleImportDownloadClick.bind(this, [download])}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                                      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                                      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                                    </svg>
                                      &ensp;
                                    {hasAutoId ? 'Importer' : 'Identifier et importer'}
                                    {isBeingImported ? <Spinner animation="border" size="sm" className="ms-2" /> : null}
                                  </Button>
                                  <Dropdown.Toggle split variant="primary" id="dropdown-custom-2" />
                                  <Dropdown.Menu>
                                    <Dropdown.Item eventKey="1" onClick={this.handleImportDownloadClick.bind(this, [download])} disabled={!isNew}>Identifier et importer</Dropdown.Item>
                                    <Dropdown.Item eventKey="2" onClick={this.handleIgnoreDownloadClick.bind(this, download.path)} disabled={download.imported}>Ignorer</Dropdown.Item>
                                    <Dropdown.Item eventKey="3" onClick={this.handleDeleteDownload.bind(this, download.path)} disabled={!ctx.user?.admin}>Supprimer (re-télécharger)</Dropdown.Item>
                                  </Dropdown.Menu>
                                </Dropdown>
                              </>
                            ))}
                        </>
                      )}
                  </div>
                </Card.Body>
              </Stack>
            </Card>,
          );
        }
      }
    }

    return (
      <Row>
        <Col xs={6} className="p-3">
          <div className="border">
            <h5 className="my-3 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#555" className="bi bi-cloud-download" viewBox="0 0 16 16">
                <path d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
                <path d="M7.646 15.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 14.293V5.5a.5.5 0 0 0-1 0v8.793l-2.146-2.147a.5.5 0 0 0-.708.708l3 3z" />
              </svg>
              &emsp;Seedbox
            </h5>
            <Card className="download-card" key="0-refresh">
              <Card.Body style={{ height: '4.5em' }} className="d-flex">{seedboxQuotaProgressBar}</Card.Body>
            </Card>
            {
                (torrents || []).map((torrent) => (
                  <Card className="download-card seedbox" key={torrent.hash}>
                    <Card.Body>
                      <div className="text-truncate" title={torrent.name}>{torrent.name}</div>
                      <div className="d-flex mt-3">
                        <span className="align-self-center">{renderFileSize(torrent.size)}</span>
                        <span className="opacity-50 mx-3 align-self-center" title={(new Date(torrent.finished * 1000)).toLocaleString()}>{renderRelativeTimeString(torrent.finished * 1000)}</span>
                        {
                          torrent.downloaded < torrent.size
                            ? (
                              <ProgressBar variant="secondary" now={100 * (torrent.downloaded / torrent.size)} label={`${(100 * (torrent.downloaded / torrent.size)).toFixed(1)}%`} className="flex-grow-1 align-self-center mx-3" />
                            ) : (
                              <span className="mx-3 align-self-center flex-grow-1 text-end">
                                ratio&nbsp;
                                <span style={{ color: torrent.ratio < 0.5 ? 'red' : (torrent.ratio < 1 ? 'rgb(255, 110, 0)' : 'rgb(170, 255, 0)') }}>{torrent.ratio}</span>
                                <Button variant="danger" title="Supprimer" onClick={this.handleRemoveTorrent.bind(this, torrent.hash)} disabled={!ctx.user?.admin} className="ms-3">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-x-circle-fill" viewBox="0 0 16 16">
                                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z" />
                                  </svg>
                                </Button>
                              </span>
                            )
                        }
                      </div>
                    </Card.Body>
                  </Card>
                ))
              }
          </div>
          <div className="mt-5 border">
            <h5 className="my-3 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#555" className="bi bi-rss" viewBox="0 0 16 16">
                <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z" />
                <path d="M5.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m-3-8.5a1 1 0 0 1 1-1c5.523 0 10 4.477 10 10a1 1 0 1 1-2 0 8 8 0 0 0-8-8 1 1 0 0 1-1-1m0 4a1 1 0 0 1 1-1 6 6 0 0 1 6 6 1 1 0 1 1-2 0 4 4 0 0 0-4-4 1 1 0 0 1-1-1" />
              </svg>
              &emsp;Filtres RSS
            </h5>
            {
              (filters || []).map((filter) => (
                <Card className="download-card seedbox" key={filter.name}>
                  <Card.Body>
                    <div className="d-flex mt-3">
                      <div className="text-truncate" title={filter.name}>{filter.name}</div>
                      <div className="mx-3 align-self-center flex-grow-1 text-end"><Form.Check disabled type="switch" checked={filter.enabled === 1} /></div>
                    </div>
                    <div className="opacity-50 text-truncate font-monospace" title={filter.pattern}>{filter.pattern}</div>
                  </Card.Body>
                </Card>
              ))
            }
          </div>

        </Col>
        <Col xs={6} className="p-3 ps-0">
          <div className="border">
            <h5 className="my-3 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#555" className="bi bi-hdd-rack" viewBox="0 0 16 16">
                <path d="M4.5 5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM3 4.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm2 7a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm-2.5.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />
                <path d="M2 2a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1v2H2a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1V7h1a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2zm13 2v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1zm0 7v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1zm-3-4v2H4V7h8z" />
              </svg>
              &emsp;NAS
            </h5>
            <Card className="download-card" key="0-refresh">
              <Card.Body style={{ height: '4.5em' }} className="d-flex">
                {nasQuotaProgressBar}
                <ButtonGroup>
                  <Button variant="dark" onClick={() => ctx.apiClient.checkSeedbox()} title="Télécharger nouveaux fichiers depuis la seedbox">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-cloud-download" viewBox="0 0 16 16">
                      <path d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
                      <path d="M7.646 15.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 14.293V5.5a.5.5 0 0 0-1 0v8.793l-2.146-2.147a.5.5 0 0 0-.708.708l3 3z" />
                    </svg>
                  </Button>
                  <Button variant="dark" onClick={() => this.setState({ showAllDownloads: !showAllDownloads })} title={showAllDownloads ? 'Afficher seulement les nouveaux' : 'Afficher tout'}>
                    {showAllDownloads
                      ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                        </svg>
                      )
                      : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-slash" viewBox="0 0 16 16">
                          <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                          <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z" />
                          <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z" />
                        </svg>
                      )}
                  </Button>
                </ButtonGroup>
              </Card.Body>
            </Card>
            { downloadCards }
          </div>
        </Col>
      </Row>
    );
  }
}
