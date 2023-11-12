import React from 'react';

import {
  AudioInfo, Config, DbMovie, DbTvshow, DbUser, Episode, UserMovieStatus, UserEpisodeStatus, UserTvshowStatus, VideoInfo,
} from '../../api/src/types';
import { SeenStatus } from '../../api/src/enums';

import { apiClient, ApiClient } from './api-client';
import { router, Router } from './router';
import { tmdbClient, TmdbClient } from './tmdb-client';
import { youtubeClient, YoutubeClient } from './youtube-client';
import { YggClient, yggClient } from './ygg-client';
import { eventBus, EventBus } from './event-bus';

export type Context = {
  config: Config;
  user?: DbUser;
  eventBus: EventBus;
  router: Router;
  apiClient: ApiClient;
  tmdbClient: TmdbClient;
  youtubeClient: YoutubeClient;
  yggClient: YggClient;
};

export const ctx: Context = {
  config: {
    moviesLocalPath: '',
    moviesRemotePath: '',
    tvshowsLocalPath: '',
    tvshowsRemotePath: '',
    tmpPath: '',
    tmdbApiKey: '',
    youtubeApiKey: '',
    ruTorrentURL: '',
    seedboxHost: '',
    seedboxPort: 0,
    seedboxUser: '',
    seedboxPassword: '',
    seedboxPath: '',
    yggUrl: '',
    yggKey: '',
    flareSolverrUrl: '',
  },
  user: undefined,
  eventBus,
  router,
  apiClient,
  tmdbClient,
  youtubeClient,
  yggClient,
};

export function initContext(config: Config): Context {
  ctx.config = config;
  ctx.tmdbClient.init(config.tmdbApiKey, 'fr-FR');
  ctx.youtubeClient.init(config.youtubeApiKey);
  ctx.yggClient.init(config.yggUrl, config.yggKey);
  return ctx;
}

export enum ItemAction {
  play = 'play',
  open = 'open',
}

export interface CustomToggleProps {
  children: React.ReactNode;
  onClick: (evt: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const MoreToggle = React.forwardRef<HTMLAnchorElement, CustomToggleProps>(({ children, onClick }, ref: React.LegacyRef<HTMLAnchorElement>) => (
  <a
    href=""
    ref={ref}
    className="link-light me-3"
    onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
      <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
    </svg>
    { children }
  </a>
));

export const MultiItem = React.forwardRef<HTMLElement, CustomToggleProps>(({ children, onClick }, ref: React.LegacyRef<HTMLElement>) => <span ref={ref} className="d-block text-nowrap p-2" onClick={onClick}>{children}</span>);

export function cleanString(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function cleanFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function getMovieLanguage(movie: DbMovie): string {
  const found = movie.filename.match(/([vostfqi+]+)\]/i);
  if (found) {
    return found[1].toUpperCase();
  }
  return '';
}

export function getMovieDuration(movie: DbMovie): string {
  const found = movie.filename.match(/\[([0-9]+)'/i);
  if (found) {
    return `${Math.floor(parseFloat(found[1]) / 60)}h${(parseFloat(found[1]) % 60).toString().padStart(2, '0')}`;
  }
  return '';
}

export function getUserMovieStatus(movie: DbMovie, user?: DbUser): UserMovieStatus | null {
  for (const userStatus of movie.userStatus) {
    if (userStatus.userName === (user || ctx.user)?.name) {
      return userStatus;
      break;
    }
  }
  return null;
}

function getMoviePosition(movie: DbMovie): number {
  const userStatus: UserMovieStatus | null = getUserMovieStatus(movie);
  return userStatus?.position || 0;
}

export function getMovieProgress(movie: DbMovie): JSX.Element {
  const position: number = getMoviePosition(movie);
  return position > 0 ? <div className="progress-bar"><div style={{ width: `${Math.round(100 * (position / movie.duration))}%` }} /></div> : <></>;
}

export function playMovie(movie: DbMovie): void {
  const path = encodeURIComponent(`${ctx.config.moviesRemotePath}/${movie.filename}`);
  if (window._mpvSchemeSupported && ctx.user) {
    window._setPosition = ctx.apiClient.setMoviePosition.bind(ctx.apiClient, movie.filename, ctx.user.name);
    console.log(`mpv://${path}?pos=${getMoviePosition(movie)}`); // eslint-disable-line no-console
    document.location.href = `mpv://${path}?pos=${getMoviePosition(movie)}`;
  } else {
    navigator.clipboard.writeText(path).then(() => {
      alert('Le chemin a été copié dans le presse-papier'); // eslint-disable-line no-alert
    }, () => {
      alert('La copie du chemin dans le presse-papier a échoué'); // eslint-disable-line no-alert
    });
  }
}

export function playUrl(url: string): void {
  const path = encodeURIComponent(url);
  if (window._mpvSchemeSupported) {
    window._setPosition = () => {};
    console.log(`mpv://${path}?pos=0`); // eslint-disable-line no-console
    document.location.href = `mpv://${path}?pos=0`;
  } else {
    window.open(url);
  }
}

export function getSeasonCount(tvshow: DbTvshow): string {
  if (tvshow.seasons.length > 0) {
    if (tvshow.seasons.length > 1) {
      return `${tvshow.seasons.length} saisons`;
    }
    return '1 saison';
  }
  return '';
}

export function getEpisodeCount(tvshow: DbTvshow): string {
  if (tvshow.episodes.length > 0) {
    if (tvshow.episodes.length > 1) {
      return `${tvshow.episodes.length} épisodes`;
    }
    return '1 épisode';
  }
  return '';
}

export function getEpisodeByFilename(tvshow: DbTvshow, filename: string): Episode | null {
  for (const episode of tvshow.episodes) {
    if (episode.filename === filename) { return episode; }
  }
  return null;
}

export function getEpisodeDuration(episode: Episode): string {
  if (episode.duration) {
    const minutes = Math.trunc(episode.duration / 60);
    return (minutes >= 60 ? `${Math.floor(minutes / 60)}h` : '') + (minutes % 60).toString().padStart(2, '0') + (minutes >= 60 ? '' : 'm');
  }
  return '';
}

export function getTvshowUserStatus(tvshow: DbTvshow, user?: DbUser): UserTvshowStatus | null {
  for (const userStatus of tvshow.userStatus) {
    if (userStatus.userName === (user || ctx.user)?.name) {
      return userStatus;
      break;
    }
  }
  return null;
}

export function getEpisodeUserStatus(episode: Episode, user?: DbUser): UserEpisodeStatus | null {
  for (const userStatus of episode.userStatus) {
    if (userStatus.userName === (user || ctx.user)?.name) {
      return userStatus;
      break;
    }
  }
  return null;
}

export function getEpisodePosition(episode: Episode): number {
  const userStatus: UserEpisodeStatus | null = getEpisodeUserStatus(episode);
  return userStatus?.position || 0;
}

export function getEpisodeProgress(episode: Episode): JSX.Element {
  const position: number = getEpisodePosition(episode);
  return position > 0 ? <div className="progress-bar"><div style={{ width: `${Math.round(100 * (position / episode.duration))}%` }} /></div> : <></>;
}

export function selectCurrentEpisode(tvshow: DbTvshow): Episode | undefined {
  return tvshow.episodes
    .slice(0)
    .filter((e) => {
      const us: UserEpisodeStatus | null = getEpisodeUserStatus(e);
      return !us || (us && (((us.seenTs.length === 0) && (us.currentStatus !== SeenStatus.seen)) || (us.currentStatus === SeenStatus.toSee)));
    })
    .sort((a, b) => {
      if (a.seasonNumber === b.seasonNumber) return (a.episodeNumbers[0] || 0) - (b.episodeNumbers[0] || 0);
      return (a.seasonNumber === -1 ? 999 : a.seasonNumber) - (b.seasonNumber === -1 ? 999 : b.seasonNumber);
    })
    .shift();
}

export function selectCurrentSeason(tvshow: DbTvshow): number {
  const currentEpisode = selectCurrentEpisode(tvshow);
  if (currentEpisode) {
    return currentEpisode.seasonNumber || -1;
  }
  return tvshow.seasons[0]?.seasonNumber || -1;
}

export function renderFileSize(size: number): string {
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / 1024 ** i).toFixed(1)} ${['o', 'ko', 'Mo', 'Go', 'To'][i]}`;
}

export function renderVideoInfos(video: VideoInfo): JSX.Element {
  return (
    <>
      {video.width}
      {' '}
      &times;
      {' '}
      {video.height}
      {' '}
      {video.codec}
    </>
  );
}

export function renderAudioInfos(audios: AudioInfo[]): JSX.Element {
  return (
    <>
      {audios.map((audio, idx, all) => (
        // eslint-disable-next-line react/no-array-index-key
        <React.Fragment key={`${audio.lang}${idx}`}>
          {audio.lang}
          {' '}
          {audio.ch}
          ch
          {' '}
          {audio.codec}
          {' '}
          {idx < all.length - 1 ? ', ' : null}
        </React.Fragment>
      ))}
    </>
  );
}

export function playTvshow(tvshow: DbTvshow, episode: Episode | undefined): Episode | undefined {
  const ep = episode || selectCurrentEpisode(tvshow);
  if (ep) {
    const path = `${ctx.config.tvshowsRemotePath}/${tvshow.foldername}/${ep.filename}`;
    if (window._mpvSchemeSupported && ctx.user) {
      window._setPosition = ctx.apiClient.setEpisodePosition.bind(ctx.apiClient, tvshow.foldername, ep.filename, ctx.user?.name);
      console.log(`mpv://${encodeURIComponent(path)}?pos=${getEpisodePosition(ep)}`); // eslint-disable-line no-console
      document.location.href = `mpv://${encodeURIComponent(path)}?pos=${getEpisodePosition(ep)}`;
    } else {
      navigator.clipboard.writeText(path).then(() => {
        alert('Le chemin a été copié dans le presse-papier'); // eslint-disable-line no-alert
      }, () => {
        alert('La copie du chemin dans le presse-papier a échoué'); // eslint-disable-line no-alert
      });
    }
  }
  return episode;
}

/**
 * Convert a date to a relative time string, such as
 * "a minute ago", "in 2 hours", "yesterday", "3 months ago", etc.
 * using Intl.RelativeTimeFormat
 */
export function renderRelativeTimeString(date: Date | number, lang = navigator.language): string {
  // Allow dates or times to be passed
  const timeMs = typeof date === 'number' ? date : date.getTime();

  // Get the amount of seconds between the given date and now
  const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);

  // Array reprsenting one minute, hour, day, week, month, etc in seconds
  const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];

  // Array equivalent to the above but in the string representation of the units
  const units: Intl.RelativeTimeFormatUnit[] = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];

  // Grab the ideal cutoff unit
  const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(deltaSeconds));

  // Get the divisor to divide from the seconds. E.g. if our unit is "day" our divisor
  // is one day in seconds, so we can divide our seconds by this to get the # of days
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;

  // Intl.RelativeTimeFormat do its magic
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
}
