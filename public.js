import { db, DB_PATH, ref, onValue, escapeHtml, buildSeasonRows } from "./firebase.js";

const connectionStatus = document.getElementById("connectionStatus");
const seasonBody = document.getElementById("seasonBody");
const leaderboardBody = document.getElementById("leaderboardBody");
const raceTabs = document.getElementById("raceTabs");
const raceSelect = document.getElementById("raceSelect");

let races = [];
let selectedRaceId = null;

function sortRaceResultsWithTiebreak(rows) {
  rows.sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    (a.totalTimeMs == null ? 999999999 : a.totalTimeMs) - (b.totalTimeMs == null ? 999999999 : b.totalTimeMs) ||
    a.driver.localeCompare(b.driver, "nl")
  );
  return rows;
}

function renderSeasonStand() {
  const rows = buildSeasonRows(races.filter(race => !race.isDraft));
  seasonBody.innerHTML = rows.length
    ? rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.driver)}</td>
        <td>${row.points}</td>
        <td>${row.sprints}</td>
        <td>${row.dropped}</td>
        <td>${row.bestSprint}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="empty">Nog geen data beschikbaar.</td></tr>';
}

function renderRaceTabs() {
  if (!raceTabs || !raceSelect) return;
  const eligibleRaces = races.filter(race => !race.isDraft);
  if (!eligibleRaces.length) {
    raceSelect.innerHTML = "";
    raceTabs.innerHTML = "";
    selectedRaceId = null;
    return;
  }
  if (!selectedRaceId || !eligibleRaces.find(r => r.id === selectedRaceId)) selectedRaceId = eligibleRaces[0].id;
  raceSelect.innerHTML = eligibleRaces.map(r => `<option value="${r.id}" ${r.id === selectedRaceId ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
  raceTabs.innerHTML = eligibleRaces.map(r => `<button class="race-tab ${r.id === selectedRaceId ? "active" : ""}" data-id="${r.id}">${escapeHtml(r.name)}</button>`).join("");
  raceSelect.onchange = () => { selectedRaceId = raceSelect.value; renderRaceTabs(); renderRaceTable(); };
  raceTabs.querySelectorAll(".race-tab").forEach(btn => {
    btn.onclick = () => { selectedRaceId = btn.dataset.id; renderRaceTabs(); renderRaceTable(); };
  });
}

function renderRaceTable() {
  const rows = [];
  const sourceRaces = races.filter(race => !race.isDraft).filter(race => race.id === selectedRaceId);
  sourceRaces.forEach(race => {
    (race.results || []).forEach(result => {
      rows.push({
        driver: result.driver,
        race: race.name,
        sprint1: result.sprint1Position,
        sprint2: result.sprint2Position,
        totalPoints: result.totalPoints || 0,
        sprint1Time: result.sprint1Time || "",
        sprint2Time: result.sprint2Time || "",
        totalTime: result.totalTime || "",
        totalTimeMs: result.totalTimeMs
      });
    });
  });
  sortRaceResultsWithTiebreak(rows);
  leaderboardBody.innerHTML = rows.length
    ? rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.driver)}</td>
        <td>${escapeHtml(row.race)}</td>
        <td>${row.sprint1}</td>
        <td>${row.sprint2}</td>
        <td>${row.totalPoints}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="empty">Geen data voor deze selectie.</td></tr>';
}

onValue(ref(db, DB_PATH), snapshot => {
  const data = snapshot.val() || {};
  races = Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
  renderSeasonStand();
  renderRaceTabs();
  renderRaceTable();
});

onValue(ref(db, ".info/connected"), snapshot => {
  connectionStatus.textContent = snapshot.val() === true ? "🟢 Live verbonden" : "🔴 Offline";
});
