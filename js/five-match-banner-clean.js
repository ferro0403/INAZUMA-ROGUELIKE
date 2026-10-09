(function (global) {
  "use strict";

  function cloneEmblem(sourceLogo) {
    const wrapper = document.createElement("span");
    wrapper.className = "five-match-versus-emblem";
    const emblem = sourceLogo?.querySelector("img")?.cloneNode(true);
    if (emblem) {
      emblem.classList.remove("five-match-emblem");
      emblem.classList.add("five-match-versus-emblem-image");
      wrapper.appendChild(emblem);
    }
    return wrapper;
  }

  function buildSide(sourceTeam, side) {
    const panel = document.createElement("div");
    panel.className = `five-match-versus-side five-match-versus-side--${side}`;

    const name = document.createElement("strong");
    name.className = "five-match-versus-name";
    name.textContent = sourceTeam?.querySelector("strong")?.textContent?.trim() || (side === "user" ? "La tua squadra" : "Svincolati");

    panel.appendChild(name);
    panel.appendChild(cloneEmblem(sourceTeam?.querySelector(".five-match-logo")));
    return panel;
  }

  function rebuildBanner(root) {
    if (!root || root.dataset.cleanBannerApplied === "true") return;
    const teams = root.querySelectorAll(":scope > .five-match-team");
    if (teams.length !== 2) return;

    const clean = document.createElement("div");
    clean.className = "five-match-versus-card";
    clean.dataset.cleanBannerApplied = "true";
    clean.setAttribute("aria-label", `${teams[0].querySelector("strong")?.textContent?.trim() || "La tua squadra"} contro ${teams[1].querySelector("strong")?.textContent?.trim() || "Svincolati"}`);

    clean.appendChild(buildSide(teams[0], "user"));

    const center = document.createElement("div");
    center.className = "five-match-versus-center";
    center.setAttribute("aria-hidden", "true");
    center.innerHTML = "<span>VS</span>";
    clean.appendChild(center);

    clean.appendChild(buildSide(teams[1], "opponent"));
    root.replaceWith(clean);
  }

  function upgradeVisibleBanner() {
    document.querySelectorAll(".five-match-screen .five-match-hero > .five-match-vs").forEach(rebuildBanner);
  }

  function installRtgFeedPolish() {
    if (document.getElementById("rtg-feed-polish-hotfix")) return;
    const style = document.createElement("style");
    style.id = "rtg-feed-polish-hotfix";
    style.textContent = `
      .rtg-match-ticker-list > li.match-event--user {
        background:linear-gradient(90deg,#c7e8ff 0%,#e9f7ff 72%,#fff 100%)!important;
        box-shadow:inset 6px 0 0 #147dcc!important;
      }
      .rtg-match-ticker-list > li.match-event--opponent {
        background:linear-gradient(90deg,#ffd0cc 0%,#fff0ee 72%,#fff 100%)!important;
        box-shadow:inset 6px 0 0 #c9342d!important;
      }
      .rtg-match-ticker-list > li.match-event--user.is-latest {
        background:linear-gradient(90deg,#9fd8ff 0%,#dff2ff 70%,#fff4b8 100%)!important;
        border-bottom:3px solid #147dcc!important;
      }
      .rtg-match-ticker-list > li.match-event--opponent.is-latest {
        background:linear-gradient(90deg,#ffaaa3 0%,#ffe1de 70%,#fff4b8 100%)!important;
        border-bottom:3px solid #c9342d!important;
      }
      .rtg-match-ticker-list > li.match-event--user .match-event-kind { color:#0869b2!important; }
      .rtg-match-ticker-list > li.match-event--opponent .match-event-kind { color:#ad241e!important; }
    `;
    document.head.appendChild(style);
  }

  let lastRtgLatest = null;
  function followLatestRtgAction() {
    installRtgFeedPolish();
    const ticker = document.querySelector(".rtg-match-ticker-list");
    if (!ticker) {
      lastRtgLatest = null;
      return;
    }
    const latest = ticker.querySelector("li.is-latest") || ticker.lastElementChild;
    if (!latest) return;
    const signature = `${latest.querySelector(":scope > span")?.textContent || ""}|${latest.textContent || ""}`;
    if (signature === lastRtgLatest && ticker.scrollTop + ticker.clientHeight >= ticker.scrollHeight - 2) return;
    lastRtgLatest = signature;
    const scrollToLatest = () => {
      ticker.scrollTop = ticker.scrollHeight;
    };
    scrollToLatest();
    requestAnimationFrame(scrollToLatest);
    setTimeout(scrollToLatest, 0);
    setTimeout(scrollToLatest, 80);
  }

  let scheduled = false;
  function scheduleUpgrade() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      upgradeVisibleBanner();
      followLatestRtgAction();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleUpgrade, { once: true });
  } else {
    scheduleUpgrade();
  }

  const app = document.getElementById("app");
  if (app) {
    const observer = new MutationObserver(scheduleUpgrade);
    observer.observe(app, { childList: true, subtree: true });
  }

  global.FiveMatchBannerClean = { rebuildBanner, upgradeVisibleBanner };
})(globalThis);