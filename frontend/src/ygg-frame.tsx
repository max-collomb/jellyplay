import React from 'react';

import { ctx } from './common';

export const yggCategories: { [key: string]: string } = {
  movies: '2183', tvshows: '2184', emissions: '2182', animation: '2178', anime: '2179',
};

type YggFrameProps = {
  url: string;
  style: React.CSSProperties;
};

// function getRank(name: string, seeds: number, sizeStr: string): number {
//   if (name.includes('4k') || name.includes('2160p')) return 0;
//   if (name.includes('xvid') || name.includes('divx')) return 0;
//   if (name.includes('vfq') && !name.includes('vff')) return 0;
//   if (seeds < 5) return 0;

//   let size: number = parseFloat(sizeStr);
//   if (sizeStr.includes('Mo')) size /= 1024;
//   if (size > 5) return 0; // too big if more than 5Gb

//   let rank = 50 - size;
//   if (name.includes('h265') || name.includes('hevc')) rank += 1000;
//   else if (name.includes('h264')) rank += 500;

//   if (name.includes('hdlight')) rank += 1000;
//   else if (name.includes('1080p')) rank += 750;
//   else if (name.includes('720p')) rank += 250;
//   return rank;
// }

export class YggFrame extends React.Component<YggFrameProps, {}> {
  render(): JSX.Element {
    const { url, style } = this.props;
    return (
      <iframe
        title="YGG search"
        src={ctx.config.yggUrl + url}
        data-uploadurl="/ygg/download"
        data-onloaded={`
          function initYGG() {
            if (document.location.href.endsWith('/auth/login')) {
              document.querySelector("input[name = 'id']").value = '${ctx.config.yggUser}';
              document.querySelector("input[name = 'pass']").value = '${ctx.config.yggPwd}';
              $.ajax({
                type: 'POST',
                url: '/auth/process_login',
                data: new FormData(document.querySelector('.login-form')),
                contentType: false,
                processData: false,
                success: function (data) { window.location.href = '${ctx.config.yggUrl + url}'; }
              });
            } else {
              const style = document.createElement('style');
              style.textContent = ${'`'}.promo-container, .donate.pulse {
                display: none !important;
              }${'`'};
              document.head.append(style);
              $('#cat').remove();
              $('#top_panel, body > header, #top, #title, body > footer').hide();

              if (document.location.href.includes('/top/')) {
                $("section.content > h2").hide();
                $("section.content > h5").each(function() {
                  if (["Emission TV", "Film", "Série TV"].indexOf($(this).text().trim()) < 0) {
                    $(this).hide().next().hide();
                  }
                });
              }

              if (document.location.href.includes('/engine/search?')) {
                $('#title').hide();
                $(".search-criteria > tbody > tr > td:contains('Description')").parents('tr').hide();
                $(".search-criteria > tbody > tr > td:contains('Fichier')").parents('tr').hide();
                $(".search-criteria > tbody > tr > td:contains('Uploader')").parents('tr').hide();
                $(".search-criteria > tbody > tr > td:contains('langue')").parents('tr').hide();
                $(".search-criteria > tbody > tr > td:contains('systeme')").parents('tr').hide();
                $(".search-criteria > tbody > tr > td:contains('genre')").parents('tr').hide();
                setTimeout(function() { /* ça ne marche pas toujours, alors on retente 250ms plus tard */
                  $(".search-criteria > tbody > tr > td:contains('langue')").parents('tr').hide();
                  $(".search-criteria > tbody > tr > td:contains('systeme')").parents('tr').hide();
                  $(".search-criteria > tbody > tr > td:contains('genre')").parents('tr').hide();
                }, 250)
              }
            }
          }
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initYGG);
          } else {
            initYGG();
          }`}
        style={{ ...style, border: 'none' }}
      />
    );
  }
}
