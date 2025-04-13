import { SeenStatus, MediaType } from './enums';
import { ParsedShow, ParsedMovie } from '@ctrl/video-filename-parser';
export { ParsedShow, ParsedMovie } from '@ctrl/video-filename-parser';

export type Config = {
  auth: string,
  moviesLocalPath: string;
  tvshowsLocalPath: string;
  tmpPath: string;
  tmdbApiKey: string;
  youtubeApiKey: string;
  ruTorrentURL: string;
  seedboxHost: string;
  seedboxPort: number;
  seedboxUser: string;
  seedboxPassword: string;
  seedboxPath: string;
  yggUrl: string;
  yggUser: string;
  yggPwd: string;
};

export type DbUser = {
  name: string;
  audience: number;
  admin: boolean;
  simplifiedUI: boolean;
  created: number;
};

export type UserWish = {
  userName: string;
  added: string; // date d'ajout
};

export type DbWish = {
  tmdbid: number;
  type: MediaType;
  title: string;
  posterPath: string;
  year: number;
  users: UserWish[];
};

export type DbCredit = {
  tmdbid: number;
  name: string;
  profilePath: string;
};

export type Cast = {
  tmdbid: number;
  character: string;
};

export type VideoInfo = {
  width: number;
  height: number;
  codec: string;
};

export type AudioInfo = {
  ch: number;
  codec: string;
  lang: string;
};

export type UserMovieStatus = {
  userName: string;
  seenTs: number[];
  currentStatus: SeenStatus;
  // seen: number[];
  // toSee: boolean;
  // notInterested: boolean;
  position: number;
};

export type DbMovie = {
  filename: string;
  tmdbid: number;
  title: string;
  originalTitle: string;
  year: number;
  duration: number;
  directors: number[];
  writers: number[];
  cast: Cast[];
  genres: string[];
  countries: string[];
  audience: number;
  created: number; // timestamp de création du fichier
  filesize: number;
  video: VideoInfo;
  audio: AudioInfo[];
  subtitles: string[];
  synopsys: string;
  backdropPath: string;
  posterPath: string;
  userStatus: UserMovieStatus[];
  searchableContent: string; // title + originalTitle + year + genre + countries => toLowerCase + removeAccent
  rating: number;
  ratingTs: number;
};

export type FileInfo = {
  created: number; // timestamp de création du fichier
  video: VideoInfo;
  audio: AudioInfo[];
  subtitles: string[];
  duration: number;
  filesize: number;
  rawData?: any;
};

export type UserEpisodeStatus = {
  userName: string;
  seenTs: number[];
  currentStatus: SeenStatus;
  position: number;
};

export type Episode = {
  tmdbid: number;
  filename: string;
  seasonNumber: number;
  episodeNumbers: number[];
  title: string;
  airDate: string;
  synopsys: string;
  duration: number;
  stillPath: string;
  created: number; // timestamp de création du fichier
  filesize: number;
  video: VideoInfo;
  audio: AudioInfo[];
  subtitles: string[];
  userStatus: UserEpisodeStatus[];
};

export type Season = {
  tmdbid: number;
  seasonNumber: number;
  episodeCount: number;
  year: number;
  synopsys: string;
  posterPath: string;
  cast: Cast[];
};

export type UserTvshowStatus = {
  userName: string;
  currentStatus: SeenStatus;
};

export type DbTvshow = {
  foldername: string;
  isSaga: boolean;
  tmdbid: number;
  title: string;
  originalTitle: string;
  countries: string[];
  synopsys: string;
  genres: string[];
  audience: number;
  backdropPath: string;
  posterPath: string;
  seasons: Season[];
  episodes: Episode[];
  userStatus: UserTvshowStatus[];
  createdMin: number;
  createdMax: number;
  airDateMin: string;
  airDateMax: string;
  searchableContent: string; // title + originalTitle + genre + countries => toLowerCase + removeAccent
  rating: number;
  ratingTs: number;
};

export type HomeLists = {
  inProgress: (DbMovie|DbTvshow)[];
  recentMovies: DbMovie[];
  recentTvshows: DbTvshow[];
};

export type ScanStatus = {
  logs: string;
  finished: boolean;
};

export type ParsedFilenameResponse = {
  title: string;
  year: string | null;
  fileInfo?: FileInfo;
  asMovie?: ParsedMovie;
  asTvshow?: ParsedShow;
  mediaInfo?: any;
  existingTvshows: { [key: string]: string };
};

export type AutoId = {
  username: string;
  mediaType: string;
  tvshowExists: boolean;
  tmdbId: number; // -1 => search to be done, 0 => not found
  filename: string;
  posterPath?: string;
  title?: string;
  audience: number;
  year: number;
};

export type DbDownload = {
  path: string;
  size: number;
  progress: number;
  started: number;
  finished: number;
  imported: boolean;
  ignored: boolean;
  autoId?: AutoId;
}

export type SeedboxTorrent = {
  name: string;
  size: number;
  hash: string;
  downloaded: number;
  uploaded: number;
  ratio: number;
  finished: number;
}

export type SeedboxFilter = {
  name: string;
  pattern: string;
  enabled: number;
}

export type Quota = {
  total: number;
  free: number;
}

export type Quotas = {
  seedbox: Quota;
  nas: Quota;
}

export type DataTables = {
  users?: Collection<DbUser>;
  wishes?: Collection<DbWish>;
  movies?: Collection<DbMovie>;
  tvshows?: Collection<DbTvshow>;
  credits?: Collection<DbCredit>;
  downloads?: Collection<DbDownload>;
};

export type ExtractedMovieInfos = {
  title: string;
  year: string|null;
  tmdbid: number|null;
};
