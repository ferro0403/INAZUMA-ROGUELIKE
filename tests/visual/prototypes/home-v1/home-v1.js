const players = [
  { name: "Mark", role: "FW", overall: 78, rarity: "Buono", className: "good", portrait: "mark.svg" },
  { name: "Shindou", role: "MF", overall: 82, rarity: "Forte", className: "strong", portrait: "shindou.svg" },
  { name: "Fubuki", role: "DF", overall: 87, rarity: "Elite", className: "elite", portrait: "fubuki.svg", equipment: "Fascia" },
  { name: "Tenma", role: "FW", overall: 90, rarity: "Mondiale", className: "world", portrait: "tenma.svg" },
  { name: "Endo", role: "GK", overall: 91, rarity: "Leggenda", className: "legend", portrait: "endo.svg", equipment: "Guanti" },
];

const grid = document.querySelector("#player-grid");

grid.innerHTML = players
  .map(
    (player) => `
      <article class="player-card rarity-${player.className}">
        <div class="rarity-strip">
          <span>${player.rarity}</span>
          <strong>${player.role}</strong>
        </div>
        <img src="assets/${player.portrait}" alt="Ritratto placeholder di ${player.name}" />
        <div class="player-copy">
          <strong class="overall">${player.overall}</strong>
          <h3>${player.name}</h3>
        </div>
        ${
          player.equipment
            ? `<span class="equipment" title="${player.equipment}" aria-label="Equipaggiamento: ${player.equipment}">◆</span>`
            : ""
        }
      </article>
    `,
  )
  .join("");

document.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.remove("is-pressed");
    requestAnimationFrame(() => button.classList.add("is-pressed"));
  });
});

document.documentElement.dataset.prototypeReady = "true";
