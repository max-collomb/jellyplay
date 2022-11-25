import React from 'react';

import { AudioInfo, Config, DbMovie, DbTvshow, DbUser, Episode, UserMovieStatus, UserEpisodeStatus, UserTvshowStatus, VideoInfo } from '../../api/src/types';
import { SeenStatus } from '../../api/src/enums';
import apiClient from './api-client';

export enum ItemAction {
  play = "play",
  open = "open",
};

export interface CustomToggleProps {
  children?: React.ReactNode;
  onClick: (evt: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const MoreToggle = React.forwardRef<HTMLAnchorElement, CustomToggleProps>(({ children, onClick }, ref: React.LegacyRef<HTMLAnchorElement>) => (
  <a href="" ref={ref} className="link-light me-3" onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }}>
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16">
      <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
    </svg>
  </a>
));

export const MultiItem = React.forwardRef<HTMLElement, CustomToggleProps>(({ children, onClick }, ref: React.LegacyRef<HTMLElement>) => {
    return <span ref={ref} className="d-block text-nowrap p-2" onClick={onClick}>{children}</span>;
  },
);

export function cleanString(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function getMovieLanguage(movie: DbMovie): string {
  let found = movie.filename.match(/([vostfqi\+]+)\]/i);
  if (found) {
    return found[1].toUpperCase();
  }
  return "";
}

export function getMovieDuration(movie: DbMovie): string {
  let found = movie.filename.match(/\[([0-9]+)'/i);
  if (found) {
    return Math.floor(parseFloat(found[1]) / 60) + 'h' + (parseFloat(found[1]) % 60).toString().padStart(2, '0');
  }
  return "";
}

export function getUserMovieStatus(movie: DbMovie, user: DbUser): UserMovieStatus|null {
    for (let userStatus of movie.userStatus) {
      if (userStatus.userName == user.name) {
        return userStatus;
        break;
      }
    }
    return null;
  }

function getMoviePosition(movie: DbMovie, user: DbUser): number {
  let userStatus: UserMovieStatus|null = getUserMovieStatus(movie, user);
  return userStatus?.position || 0;
}

export function getMovieProgress(movie: DbMovie, user: DbUser): JSX.Element {
  let position: number = getMoviePosition(movie, user);
  return position > 0 ? <div className="progress-bar"><div style={{ width: Math.round(100 * position / movie.duration) + '%' }}></div></div> : <></>;
}

export function playMovie(config: Config, movie: DbMovie, user: DbUser, callback: Function): void {
  const path = encodeURIComponent(`${config.moviesRemotePath}/${movie.filename}`);
  if (window._mpvSchemeSupported) {
    window._setPosition = apiClient.setMoviePosition.bind(apiClient, movie, user.name, callback);
    console.log(`mpv://${path}?pos=${getMoviePosition(movie, user)}`);
    document.location.href = `mpv://${path}?pos=${getMoviePosition(movie, user)}`;
  } else {
    navigator.clipboard.writeText(path).then(function() {
      alert(`Le chemin a été copié dans le presse-papier`);
    }, function() {
      alert(`La copie du chemin dans le presse-papier a échoué`);
    });
  }
}

export function getSeasonCount(tvshow: DbTvshow): string {
  if (tvshow.seasons.length > 0) {
    if (tvshow.seasons.length > 1) {
      return `${tvshow.seasons.length} saisons`;
    } else {
      return "1 saison";
    }
  }
  return "";
}

export function getEpisodeCount(tvshow: DbTvshow): string {
  if (tvshow.episodes.length > 0) {
    if (tvshow.episodes.length > 1) {
      return `${tvshow.episodes.length} épisodes`;
    } else {
      return "1 épisode";
    }
  }
  return "";
}

export function getEpisodeDuration(episode: Episode): string {
  if (episode.duration) {
    const minutes = Math.trunc(episode.duration / 60);
    return (minutes >= 60 ? Math.floor(minutes / 60) + 'h' : '') + (minutes % 60).toString().padStart(2, '0') + (minutes >= 60 ? '' : 'm');
  }
  return "";
}

export function getTvshowUserStatus(tvshow: DbTvshow, user: DbUser): UserTvshowStatus|null {
  for (let userStatus of tvshow.userStatus) {
    if (userStatus.userName == user.name) {
      return userStatus;
      break;
    }
  }
  return null;
}

export function getEpisodeUserStatus(episode: Episode, user: DbUser): UserEpisodeStatus|null {
  for (let userStatus of episode.userStatus) {
    if (userStatus.userName == user.name) {
      return userStatus;
      break;
    }
  }
  return null;
}

export function getEpisodePosition(episode: Episode, user: DbUser): number {
  let userStatus: UserEpisodeStatus|null = getEpisodeUserStatus(episode, user);
  return userStatus?.position || 0;
}

export function getEpisodeProgress(episode: Episode, user: DbUser): JSX.Element {
  let position: number = getEpisodePosition(episode, user);
  return position > 0 ? <div className="progress-bar"><div style={{ width: Math.round(100 * position / episode.duration) + '%' }}></div></div> : <></>;
}

export function selectCurrentEpisode(tvshow: DbTvshow, user: DbUser): Episode|undefined {
  return tvshow.episodes
          .slice(0)
          .filter(e => {
            const us: UserEpisodeStatus|null = getEpisodeUserStatus(e, user);
            return !us || (us && ((us.seenTs.length == 0) && (us.currentStatus != SeenStatus.seen) || (us.currentStatus == SeenStatus.toSee)));
          })
          .sort((a, b) => {
            if (a.seasonNumber == b.seasonNumber)
              return (a.episodeNumbers[0] || 0) - (b.episodeNumbers[0] || 0);
            else
              return (a.seasonNumber == -1 ? 999 : a.seasonNumber) - (b.seasonNumber == -1 ? 999 : b.seasonNumber);
          })
          .shift();
}

export function selectCurrentSeason(tvshow: DbTvshow, user: DbUser): number {
  const currentEpisode = selectCurrentEpisode(tvshow, user);
  if (currentEpisode) {
    return currentEpisode.seasonNumber || -1;
  } else {
    return tvshow.seasons[0]?.seasonNumber || -1;
  }
}

export function renderFileSize(size: number): string {
  var i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(1) + ' ' + ['o', 'ko', 'Mo', 'Go', 'To'][i];
}

export function renderVideoInfos(video: VideoInfo): JSX.Element {
  return <>{video.width} &times; {video.height} {video.codec}</>;
}

export function renderAudioInfos(audios: AudioInfo[]): JSX.Element {
  return <React.Fragment>{audios.map((audio, idx, all) => <React.Fragment key={idx}>{audio.lang} {audio.ch}ch {audio.codec} {idx < all.length - 1 ? ", " : null}</React.Fragment>)}</React.Fragment>;
}

export function playTvshow(config: Config, tvshow: DbTvshow, episode: Episode|undefined, user: DbUser, callback: Function): Episode|undefined {
  if (! episode) {
    episode = selectCurrentEpisode(tvshow, user);
  }
  if (episode) {
    const path = `${config.tvshowsRemotePath}/${tvshow.foldername}/${episode.filename}`;
    if (window._mpvSchemeSupported) {
      window._setPosition = apiClient.setEpisodePosition.bind(apiClient, tvshow, episode, user.name, () => callback(episode));
      document.location.href = `mpv://${encodeURIComponent(path)}?pos=${getEpisodePosition(episode, user)}`;
    } else {
      navigator.clipboard.writeText(path).then(function() {
        alert(`Le chemin a été copié dans le presse-papier`);
      }, function() {
        alert(`La copie du chemin dans le presse-papier a échoué`);
      });
    }
  }
  return episode;
}
