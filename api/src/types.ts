export type DbUser = {
  name: string,
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

export type DbMovie = {
  filename: string,
  tmdbid: number,
  title: string,
  originalTitle: string,
  year: number,
  duration: number,
  directors: number[],
  writers: number[],
  cast: Cast[],
  genres: string[],
  countries: string[],
  audience: number,
  created: string; // date de création du fichier
  filesize: number,
  video: VideoInfo,
  audio: AudioInfo[],
  subtitles: string[],
  synopsys: string,
  backdropPath: string,
  posterPath: string,
};

export type DbTvshow = {
  foldername: string,
  tmdbid: number,
  title: string,
  filenames: string[],
};

export type DataTables = {
  users?: Collection<DbUser>,
  movies?: Collection<DbMovie>,
  tvshows?: Collection<DbTvshow>,
  credits?: Collection<DbCredit>
};
