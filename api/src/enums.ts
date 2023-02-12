export enum MediaType {
  unknown = "unknown",
  movie   = "movie",
  tvshow  = "tvshow",
};

export enum SeenStatus {
  unknown = "unknown",
  toSee   = "toSee",
  seen    = "seen",
  wontSee = "wontSee",
};

export enum OrderBy {
  addedDesc    = "addedDesc",
  addedAsc     = "addedAsc",
  titleAsc     = "titleAsc",
  titleDesc    = "titleDesc",
  yearDesc     = "yearDesc",
  yearAsc      = "yearAsc",
  filenameAsc  = "filenameAsc",
  filenameDesc = "filenameDesc",
};
