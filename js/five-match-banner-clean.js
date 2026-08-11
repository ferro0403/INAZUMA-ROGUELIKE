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

  let scheduled = false;
  function scheduleUpgrade() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      upgradeVisibleBanner();
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
