(function (global) {
  "use strict";
  const PRESENTATION = Object.freeze({
    ie1: {
      coverUrl:
        "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiTljpQy0-8hZqy9NP7BmOZwijtzN9VGYbXEN4bR2bPW8GiaccWADFA3RAlYclPfO8HSr9aEgR8H_NWF-al-1MLXlH6ToD-mMNUKwTsaSKlKvUCEY1xzg_2auQvhA3usKf5qPwV8Iawi6pm/s1600/wallpapers_inazuma11_1_1024x768.jpg",
      focalPoint: "center",
    },
    ie1_s2: {
      coverUrl:
        "https://static.wikia.nocookie.net/inazuma-eleven/images/9/9b/%28Artwork%29_Aliea_Gakuen_captains.jpg/revision/latest?cb=20120722223451",
      focalPoint: "center 42%",
    },
    ie1_s3: {
      coverUrl:
        "https://static.wikia.nocookie.net/inazuma-eleven-fanon/images/6/67/Inazuma-boys-inazuma-eleven-35597232-1600-1200_%281%29.jpg/revision/latest?cb=20140310150638",
      focalPoint: "center",
    },
    ie2: {
      coverUrl:
        "https://www.akibagamers.it/wp-content/uploads/2019/12/inazuma-eleven-great-road-of-heroes-cover.jpg",
      focalPoint: "center 38%",
    },
  });
  global.SeasonSelectionView = {
    create({ escapeHtml, sectionRootButton }) {
      function seasonCoverMarkup(season) {
        const db = global.SeasonRegistry?.database?.(season.id)?.presentation;
        const p = db?.menuImageUrl
          ? {
              coverUrl: db.menuImageUrl,
              focalPoint: db.menuImageFocalPoint || "center",
            }
          : PRESENTATION[season.id];
        return p
          ? `<img class="season-cover-art" src="${escapeHtml(p.coverUrl)}" alt="" style="object-position:${escapeHtml(p.focalPoint)}" loading="lazy" decoding="async" onerror="this.hidden=true;this.closest('.season-select-card').classList.add('season-cover-fallback')">`
          : "";
      }
      function seasonSelectCardMarkup({ season, savedRun, isLastPlayed }) {
        const active = savedRun && global.RunState.isActiveRun(savedRun);
        const actions = active
          ? `<button type="button" class="btn btn-yellow" data-season-continue="${escapeHtml(season.id)}">CONTINUA</button><button type="button" class="btn btn-ghost" data-season-new="${escapeHtml(season.id)}">INIZIA</button><button type="button" class="btn season-delete-button" data-season-delete="${escapeHtml(season.id)}">ELIMINA</button>`
          : `<button type="button" class="btn btn-yellow" data-season-new="${escapeHtml(season.id)}">INIZIA NUOVA RUN</button>`;
        const modifier = active
          ? `season-select-card--active ${isLastPlayed ? "season-select-card--last" : ""}`
          : "season-select-card--empty";
        const subtitle = active
          ? ""
          : '<p class="season-card-subtitle">Costruisci la squadra e affronta la scalata.</p>';
        return `<article class="home-hub-card season-select-card ${modifier}">${seasonCoverMarkup(season)}<div class="season-card-content"><div class="season-card-head"><div><p class="season-card-kicker">SEASON ${escapeHtml(season.displaySeasonNumber)}</p><h2>${escapeHtml(season.name)}</h2>${subtitle}</div></div><div class="home-card-actions season-card-actions">${actions}</div></div></article>`;
      }
      return {
        seasonCoverMarkup,
        seasonSelectCardMarkup,
        screen: (cards) =>
          `<main class="home-screen modern-home season-select-screen"><header class="season-select-topbar">${sectionRootButton("seasonSelection", "season-select-home-button")}<div><p class="eyebrow">MODALITÀ</p><h1>SELEZIONA SEASON</h1><p class="season-select-subtitle">Scegli la tua storia e riprendi la scalata.</p></div><span class="season-select-topbar-spacer" aria-hidden="true"></span></header><section class="home-choice-grid season-choice-grid">${cards}</section></main>`,
      };
    },
  };
})(globalThis);
