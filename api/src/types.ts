export type Config = {
  moviesLocalPath: string;
  moviesRemotePath: string;
  tvshowsLocalPath: string;
  tvshowsRemotePath: string;
  tmdbApiKey: string;
};

export type DbUser = {
  name: string;
  audience: number;
  admin: boolean;
};

export type DbCredit = {
  tmdbid: number;
  name: string;
  profilePath: string;
};

type Cast = {
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
  seen: number[];
  toSee: boolean;
  notInterested: boolean;
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
  created: string; // date de création du fichier
  filesize: number;
  video: VideoInfo;
  audio: AudioInfo[];
  subtitles: string[];
  synopsys: string;
  backdropPath: string;
  posterPath: string;
  userStatus: UserMovieStatus[];
  searchableContent: string; // title + originalTitle + year + genre + countries => toLowerCase + removeAccent
};

export type UserEpisodeStatus = {
  userName: string;
  seen: number[];
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
  created: string; // date de création du fichier
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
  notInterested: boolean;
  currentFilename: string;
  position: number;
};

export type DbTvshow = {
  foldername: string;
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
  createdMin: string;
  createdMax: string;
  airDateMin: string;
  airDateMax: string;
  searchableContent: string; // title + originalTitle + genre + countries => toLowerCase + removeAccent
};

export type ParsedFilename = {
  title: string;
  year: string | null;
};

export type DataTables = {
  users?: Collection<DbUser>;
  movies?: Collection<DbMovie>;
  tvshows?: Collection<DbTvshow>;
  credits?: Collection<DbCredit>;
};

export enum OrderBy {
  addedDesc = "addedDesc",
  addedAsc  = "addedAsc",
  titleAsc  = "titleAsc",
  titleDesc = "titleDesc",
  yearDesc  = "yearDesc",
  yearAsc   = "yearAsc",
};
