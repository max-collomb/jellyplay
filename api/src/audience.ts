
export const getMovieAudiences = function (release_dates: any): number[] {
  const audiences: number[] = [];
  if (release_dates) {
    for (const country of release_dates) {
      if (country.iso_3166_1 == "US") {
        for (const date of country.release_dates) {
          switch (date.certification) {
            case "NR": break;                     // "No rating information."
            case "G": audiences.push(0); break; // "All ages admitted. There is no content that would be objectionable to most parents. This is one of only two ratings dating back to 1968 that still exists today."
            case "PG": audiences.push(10); break; // "Some material may not be suitable for children under 10. These films may contain some mild language, crude/suggestive humor, scary moments and/or violence. No drug content is present. There are a few exceptions to this rule. A few racial insults may also be heard."
            case "PG-13": audiences.push(12); break; // "Some material may be inappropriate for children under 13. Films given this rating may contain sexual content, brief or partial nudity, some strong language and innuendo, humor, mature themes, political themes, terror and/or intense action violence. However, bloodshed is rarely present. This is the minimum rating at which drug content is present."
            case "R": audiences.push(16); break; // "Under 17 requires accompanying parent or adult guardian 21 or older. The parent/guardian is required to stay with the child under 17 through the entire movie, even if the parent gives the child/teenager permission to see the film alone. These films may contain strong profanity, graphic sexuality, nudity, strong violence, horror, gore, and strong drug use. A movie rated R for profanity often has more severe or frequent language than the PG-13 rating would permit. An R-rated movie may have more blood, gore, drug use, nudity, or graphic sexuality than a PG-13 movie would admit."
            case "NC-17": audiences.push(18); break; // "These films contain excessive graphic violence, intense or explicit sex, depraved, abhorrent behavior, explicit drug abuse, strong language, explicit nudity, or any other elements which, at present, most parents would consider too strong and therefore off-limits for viewing by their children and teens. NC-17 does not necessarily mean obscene or pornographic in the oft-accepted or legal meaning of those words."
          }
        };
      } else if (country.iso_3166_1 == "FR") {
        for (const date of country.release_dates) {
          switch (date.certification) {
            case "U": audiences.push(0); break; // "(Tous publics) valid for all audiences."
            case "10": audiences.push(10); break; // "(Déconseillé aux moins de 10 ans) unsuitable for children younger than 10 (this rating is only used for TV); equivalent in theatres : \"avertissement\" (warning), some scenes may be disturbing to young children and sensitive people; equivalent on video : \"accord parental\" (parental guidance)."
            case "12": audiences.push(12); break; // "(Interdit aux moins de 12 ans) unsuitable for children younger than 12 or forbidden in cinemas for under 12."
            case "16": audiences.push(16); break; // "(Interdit aux moins de 16 ans) unsuitable for children younger than 16 or forbidden in cinemas for under 16."
            case "18": audiences.push(18); break; // "(Interdit aux mineurs) unsuitable for children younger than 18 or forbidden in cinemas for under 18."
          }
        };
      }
    }
  }
  return audiences;
}

export const getTvshowAudiences = function(release_dates: any): number[] {
  const audiences: number[] = [];
  if (release_dates) {
    for (const country of release_dates) {
      if (country.iso_3166_1 == "US") {
        switch (country.rating) {
          case "TV-NR": break;                     // "No rating information."
          case "TV-Y":                            // "This program is designed to be appropriate for all children."
          case "TV-Y7": audiences.push(0); break; // "This program is designed for children age 7 and above."
          case "TV-G":                            // "Most parents would find this program suitable for all ages."
          case "TV-PG": audiences.push(10); break; // "This program contains material that parents may find unsuitable for younger children."
          case "TV-14": audiences.push(12); break; // "This program contains some material that many parents would find unsuitable for children under 14 years of age."
          case "TV-MA": audiences.push(16); break; // "This program is specifically designed to be viewed by adults and therefore may be unsuitable for children under 17."
        }
      } else if (country.iso_3166_1 == "ES") {
        switch (country.rating) {
          case "NR": break;                        // "No rating information."
          case "TP":
          case "7": audiences.push(0); break;    // "Suitable for all ages."
          case "10": audiences.push(10); break;    // "Not recommended for children under 10. Not allowed in children's television series."
          case "12":
          case "13": audiences.push(12); break;    // "Not recommended for children under 12. Not allowed air before 10:00 p.m. Some channels and programs are subject to exception."
          case "16": audiences.push(16); break;    // "Not recommended for children under 16. Not allowed air before 10:30 p.m. Some channels and programs are subject to exception."
          case "18": audiences.push(18); break;    // "Not recommended for persons under 18. Allowed between midnight and 5 a.m. and only in some channels, access to these programs is locked by a personal password."
        }
      } else if (country.iso_3166_1 == "FR") {
        switch (country.rating) {
          case "NR": break;                        // "No rating information."
          case "10": audiences.push(10); break;    // "Not recommended for children under 10. Not allowed in children's television series."
          case "12": audiences.push(12); break;    // "Not recommended for children under 12. Not allowed air before 10:00 p.m. Some channels and programs are subject to exception."
          case "16": audiences.push(16); break;    // "Not recommended for children under 16. Not allowed air before 10:30 p.m. Some channels and programs are subject to exception."
          case "18": audiences.push(18); break;    // "Not recommended for persons under 18. Allowed between midnight and 5 a.m. and only in some channels, access to these programs is locked by a personal password."
        }
      }
    }
  }
  return audiences;
}