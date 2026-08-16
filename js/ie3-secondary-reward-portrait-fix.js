(function () {
  "use strict";

  const SEASON_ID = "ie1_s3";

  document.addEventListener("click", (event) => {
    const detailButton = event.target.closest?.("[data-ie3-secondary-detail]");
    if (!detailButton) return;

    const option = detailButton.closest(".pull-choice-option[data-profile-id]");
    if (!option) return;

    /*
     * Use the exact 2D portrait already rendered in the reward choice card.
     * This deliberately avoids frontFullbodyUrl/fullbodyUrl, which are the
     * 3D/full-body assets used elsewhere by the generic detail resolver.
     */
    const cardImage = option.querySelector("[data-player-id] img") || option.querySelector("img");
    let portraitUrl = cardImage?.currentSrc || cardImage?.src || "";

    if (!portraitUrl) {
      const profileId = option.dataset.profileId;
      const candidate = globalThis.ProfiledSeasonRuntime?.resolveProfile?.(SEASON_ID, profileId);
      portraitUrl = candidate?.portraitUrl || candidate?.imageUrl || candidate?.cardImageUrl || "";
    }

    if (!portraitUrl) return;

    queueMicrotask(() => {
      const detailModal = document.querySelector("#modal-root .player-detail-modal");
      const image = detailModal?.querySelector(".player-detail-visual img.player-fullbody");
      if (!image) return;

      image.src = portraitUrl;
      image.removeAttribute("data-fallback-index");
      image.removeAttribute("data-fallback-urls");
      image.classList.remove("player-fullbody--fullbody");
      image.classList.add("player-fullbody--portrait");
    });
  }, true);
})();
