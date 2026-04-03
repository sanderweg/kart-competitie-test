// 🔥 DROPDOWN FIX VERSION

import { db, DB_PATH, ref, onValue, escapeHtml } from "./firebase.js";

const raceSelect = document.getElementById("raceSelect"); // ✅ FIXED ID

let openRaces = [];

function renderRaceOptions() {
  if (!raceSelect) return;

  if (!openRaces.length) {
    raceSelect.innerHTML = '<option value="">Geen races beschikbaar</option>';
    return;
  }

  raceSelect.innerHTML = openRaces.map(race => `
    <option value="${escapeHtml(race.id)}">${escapeHtml(race.name || "Onbekende race")}</option>
  `).join("");
}

// 🔥 FIX: removed isDraft filter
onValue(ref(db, DB_PATH), snapshot => {
  const data = snapshot.val() || {};
  openRaces = Object.values(data).filter(race => race); // ✅ FIXED
  renderRaceOptions();
});
