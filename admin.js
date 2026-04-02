import { auth, db, DB_PATH, REGISTRATIONS_PATH, REGISTRATIONS_HISTORY_PATH, ref, push, set, remove, onValue, signOut, onAuthStateChanged, getPoints, formatDate, formatDateTime, escapeHtml, mergeResults, buildSeasonRows } from "./firebase.js";

const raceNameInput = document.getElementById("raceName");
const raceDateInput = document.getElementById("raceDate");
const raceTimeInput = document.getElementById("raceTime");
const raceLocationInput = document.getElementById("raceLocation");
const raceNoteInput = document.getElementById("raceNote");
const sprint1DriversList = document.getElementById("sprint1DriversList");
const sprint2DriversList = document.getElementById("sprint2DriversList");
const messageEl = document.getElementById("message");
const leaderboardBody = document.getElementById("leaderboardBody");
const seasonBody = document.getElementById("seasonBody");
const historyList = document.getElementById("historyList");
const connectionStatus = document.getElementById("connectionStatus");
const authStatus = document.getElementById("authStatus");
const formTitle = document.getElementById("formTitle");
const editBadge = document.getElementById("editBadge");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const logoutBtn = document.getElementById("logoutBtn");
const addSprint1DriverBtn = document.getElementById("addSprint1DriverBtn");
const addSprint2DriverBtn = document.getElementById("addSprint2DriverBtn");
const saveRaceBtn = document.getElementById("saveRaceBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const resetFormBtn = document.getElementById("resetFormBtn");
const exportBtn = document.getElementById("exportBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const driverSuggestions = document.getElementById("driverSuggestions");
const raceTabs = document.getElementById("raceTabs");
const raceSelect = document.getElementById("raceSelect");
const inschrijvingenList = document.getElementById("inschrijvingenList");


let races = [];
let registrations = [];
let currentUser = null;
let editingRaceId = null;
let selectedRaceId = null;
const MAX_RACE_PARTICIPANTS = 22;

function setMessage(text, type = "") {
  messageEl.textContent = text || "";
  messageEl.className = type ? "message " + type : "message";
}

function setControlsEnabled(enabled) {
  [raceNameInput, raceDateInput, raceTimeInput, raceLocationInput, raceNoteInput, addSprint1DriverBtn, addSprint2DriverBtn, saveRaceBtn, saveDraftBtn, resetFormBtn, clearAllBtn].forEach(el => { if (el) el.disabled = !enabled; });
  document.querySelectorAll(".driver-name,.driver-position,.remove-driver").forEach(el => { el.disabled = !enabled; });
}

function updateAuthUi() {
  if (currentUser) {
    authStatus.textContent = `🔓 Ingelogd als ${currentUser.email}`;
    logoutBtn.disabled = false;
    setControlsEnabled(true);
  } else {
    authStatus.textContent = "🔒 Niet ingelogd";
    logoutBtn.disabled = true;
    setControlsEnabled(false);
    setMessage("Log eerst in via de beheerder login om races te wijzigen.", "");
  }
}

function updateEditUi() {
  const editing = !!editingRaceId;
  formTitle.textContent = editing ? "Uitslag bewerken" : "Nieuwe race";
  editBadge.classList.toggle("hidden", !editing);
  cancelEditBtn.classList.toggle("hidden", !editing);
  saveRaceBtn.textContent = editing ? "Wijzigingen opslaan" : "Race opslaan";
}

function normalizeDriverName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function refreshDriverSuggestions() {
  if (!driverSuggestions) return;
  const seen = new Set();
  const names = [];
  races.forEach(race => {
    [...(race.sprint1Drivers || []), ...(race.sprint2Drivers || [])].forEach(driver => {
      const clean = String(driver.name || "").trim().replace(/\s+/g, " ");
      const key = normalizeDriverName(clean);
      if (clean && !seen.has(key)) {
        seen.add(key);
        names.push(clean);
      }
    });
  });
  names.sort((a, b) => a.localeCompare(b, "nl"));
  driverSuggestions.innerHTML = names.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function getDriverSuggestionNames() {
  if (!driverSuggestions) return [];
  return [...driverSuggestions.querySelectorAll("option")].map(option => option.value).filter(Boolean);
}

function attachAutocompleteBehavior(input) {
  if (!input || input.dataset.autocompleteAttached === "true") return;
  input.dataset.autocompleteAttached = "true";

  input.addEventListener("input", () => {
    const typed = String(input.value || "").replace(/\s+/g, " ").trim();
    if (!typed) return;
    const matches = getDriverSuggestionNames().filter(name => normalizeDriverName(name).startsWith(normalizeDriverName(typed)));
    if (matches.length === 1) {
      const match = matches[0];
      if (normalizeDriverName(match) !== normalizeDriverName(typed)) {
        input.value = match;
        input.setSelectionRange(typed.length, match.length);
      }
    }
  });

  input.addEventListener("blur", () => {
    const typed = String(input.value || "").replace(/\s+/g, " ").trim();
    if (!typed) return;
    const exact = getDriverSuggestionNames().find(name => normalizeDriverName(name) === normalizeDriverName(typed));
    if (exact) input.value = exact;
  });
}

function addDriverRow(targetList, name = "", position = "") {
  const row = document.createElement("div");
  row.className = "driver-row";
  row.innerHTML = `
    <div class="field">
      <label>Driver naam</label>
      <input type="text" class="driver-name" list="driverSuggestions" autocomplete="on" placeholder="Bijv. Max" value="${escapeHtml(name)}" />
    </div>
    <div class="field">
      <label>Positie</label>
      <input type="number" class="driver-position" min="0" max="22" placeholder="Bijv. 1" value="${position}" />
    </div>
    <div class="field">
      <label>Punten</label>
      <input type="number" class="driver-points-preview" disabled />
    </div>
    <button type="button" class="remove-driver">Verwijderen</button>
  `;

  const positionInput = row.querySelector(".driver-position");
  const pointsInput = row.querySelector(".driver-points-preview");

  const updatePreview = () => {
    const pos = Number(positionInput.value);
    pointsInput.value = positionInput.value !== "" ? getPoints(pos) : "";
  };

  positionInput.addEventListener("input", updatePreview);
  row.querySelector(".remove-driver").addEventListener("click", () => {
    if (!currentUser) return;
    row.remove();
    if (!targetList.children.length) addDriverRow(targetList);
    setControlsEnabled(!!currentUser);
  });

  attachAutocompleteBehavior(row.querySelector(".driver-name"));
  updatePreview();
  targetList.appendChild(row);
  setControlsEnabled(!!currentUser);
}

function getDriversFromList(targetList) {
  return [...targetList.querySelectorAll(".driver-row")]
    .map(row => {
      const rawName = row.querySelector(".driver-name").value;
      const name = String(rawName || "").trim().replace(/\s+/g, " ");
      const posText = row.querySelector(".driver-position").value.trim();
      const position = posText === "" ? NaN : Number(posText);
      return { name, position, points: getPoints(position) };
    })
    .filter(driver => driver.name !== "" || !Number.isNaN(driver.position));
}

function validateSprint(drivers, label) {
  if (!drivers.length) return `${label} heeft nog geen drivers.`;
  const invalid = drivers.find(d => !d.name || Number.isNaN(d.position) || d.position < 0 || d.position > 22);
  if (invalid) return `${label} heeft een driver zonder geldige naam of positie (0 t/m 22).`;
  const positions = drivers.map(d => d.position).filter(p => p !== 0);
  for (let i = 0; i < positions.length; i++) {
    if (positions.indexOf(positions[i]) !== i) return `${label}: positie ${positions[i]} is dubbel ingevuld.`;
  }
  const names = drivers.map(d => d.name.toLowerCase());
  for (let i = 0; i < names.length; i++) {
    if (names.indexOf(names[i]) !== i) return `${label}: dezelfde driver staat dubbel.`;
  }
  return "";
}

function parseTimeToMs(timeText) {
  const value = String(timeText || "").trim().replace(",", ".");
  if (!value) return null;
  const parts = value.split(":");
  let minutes = 0;
  let secondsText = value;
  if (parts.length === 2) {
    minutes = Number(parts[0]);
    secondsText = parts[1];
  } else if (parts.length > 2) {
    return null;
  }
  const seconds = Number(secondsText);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  return Math.round((minutes * 60 + seconds) * 1000);
}

function formatMsToTime(ms) {
  if (ms == null || Number.isNaN(ms)) return "";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}


function applyFastestTimeTiebreak(results, existingRace = null) {
  const byPoints = new Map();
  results.forEach(result => {
    const key = Number(result.totalPoints || 0);
    if (!byPoints.has(key)) byPoints.set(key, []);
    byPoints.get(key).push(result);
  });

  byPoints.forEach(group => {
    if (group.length < 2) return;

    group.forEach(result => {
      const existing = (existingRace?.results || []).find(r => String(r.driver).toLowerCase() === String(result.driver).toLowerCase());
      if (existing?.totalTimeMs != null) {
        result.sprint1Time = existing.sprint1Time || "";
        result.sprint2Time = existing.sprint2Time || "";
        result.totalTime = existing.totalTime || "";
        result.totalTimeMs = existing.totalTimeMs;
      }
    });

    group.forEach(result => {
      if (result.totalTimeMs != null) return;

      let sprint1Ms = null;
      let sprint2Ms = null;

      while (true) {
        const input1 = window.prompt(`Gelijke punten in deze race voor ${result.driver}.\nVul Sprint 1 tijd in (bijv. 1:02.345).`, result.sprint1Time || "");
        if (input1 === null) {
          sprint1Ms = 999999999;
          result.sprint1Time = "";
          break;
        }
        const ms1 = parseTimeToMs(input1);
        if (ms1 != null) {
          sprint1Ms = ms1;
          result.sprint1Time = formatMsToTime(ms1);
          break;
        }
        window.alert("Ongeldige Sprint 1 tijd. Gebruik bijvoorbeeld 1:02.345");
      }

      while (true) {
        const input2 = window.prompt(`Gelijke punten in deze race voor ${result.driver}.\nVul Sprint 2 tijd in (bijv. 1:02.345).`, result.sprint2Time || "");
        if (input2 === null) {
          sprint2Ms = 999999999;
          result.sprint2Time = "";
          break;
        }
        const ms2 = parseTimeToMs(input2);
        if (ms2 != null) {
          sprint2Ms = ms2;
          result.sprint2Time = formatMsToTime(ms2);
          break;
        }
        window.alert("Ongeldige Sprint 2 tijd. Gebruik bijvoorbeeld 1:02.345");
      }

      result.totalTimeMs = sprint1Ms + sprint2Ms;
      result.totalTime = formatMsToTime(result.totalTimeMs);
    });
  });

  return results;
}

function sortRaceResultsWithTiebreak(rows) {
  rows.sort((a, b) =>
    b.totalPoints - a.totalPoints ||
    (a.totalTimeMs == null ? 999999999 : a.totalTimeMs) - (b.totalTimeMs == null ? 999999999 : b.totalTimeMs) ||
    a.driver.localeCompare(b.driver, "nl")
  );
  return rows;
}


function loadRaceIntoForm(race) {
  if (!currentUser) return;
  editingRaceId = race.id;
  raceNameInput.value = race.name || "";
  raceDateInput.value = race.date || "";
  if (raceTimeInput) raceTimeInput.value = race.time || "";
  if (raceLocationInput) raceLocationInput.value = race.location || "";
  if (raceNoteInput) raceNoteInput.value = race.note || "";
  sprint1DriversList.innerHTML = "";
  sprint2DriversList.innerHTML = "";
  (race.sprint1Drivers || []).forEach(driver => addDriverRow(sprint1DriversList, driver.name, driver.position));
  (race.sprint2Drivers || []).forEach(driver => addDriverRow(sprint2DriversList, driver.name, driver.position));
  if (!(race.sprint1Drivers || []).length) addDriverRow(sprint1DriversList);
  if (!(race.sprint2Drivers || []).length) addDriverRow(sprint2DriversList);
  updateEditUi();
  window.scrollTo({ top: 0, behavior: "smooth" });
  setMessage(`Je bewerkt nu: ${race.name}`, "success");
}


function collectRacePayload(validateForFinal = true) {
  const raceName = raceNameInput.value.trim();
  const raceDate = raceDateInput.value;
  const raceTime = raceTimeInput?.value || "";
  const raceLocation = String(raceLocationInput?.value || "").trim();
  const raceNote = String(raceNoteInput?.value || "").trim();
  const sprint1Drivers = getDriversFromList(sprint1DriversList);
  const sprint2Drivers = getDriversFromList(sprint2DriversList);

  if (!raceName) return { error: "Vul eerst een racenaam in." };
  if (!raceDate) return { error: "Kies eerst een datum." };

  if (validateForFinal) {
    const sprint1Error = validateSprint(sprint1Drivers, "Sprint 1");
    if (sprint1Error) return { error: sprint1Error };
    const sprint2Error = validateSprint(sprint2Drivers, "Sprint 2");
    if (sprint2Error) return { error: sprint2Error };
  }

  const normalizedSprint1 = sprint1Drivers
    .filter(d => d.name !== "" || !Number.isNaN(d.position))
    .map(d => ({
      ...d,
      position: Number.isNaN(d.position) ? "" : d.position,
      points: Number.isNaN(d.position) ? 0 : d.points
    }));

  const normalizedSprint2 = sprint2Drivers
    .filter(d => d.name !== "" || !Number.isNaN(d.position))
    .map(d => ({
      ...d,
      position: Number.isNaN(d.position) ? "" : d.position,
      points: Number.isNaN(d.position) ? 0 : d.points
    }));

  return {
    raceName,
    raceDate,
    raceTime,
    raceLocation,
    raceNote,
    normalizedSprint1,
    normalizedSprint2
  };
}

async function saveDraftRace() {
  if (!currentUser) {
    setMessage("Log eerst in om een concept op te slaan.", "error");
    return;
  }

  try {
    const payload = collectRacePayload(false);
    if (payload.error) return setMessage(payload.error, "error");

    const existingRace = editingRaceId ? races.find(r => r.id === editingRaceId) : null;
    const results = existingRace?.results || [];
    const raceId = editingRaceId || push(ref(db, DB_PATH)).key;

    await set(ref(db, DB_PATH + "/" + raceId), {
      id: raceId,
      name: payload.raceName,
      date: payload.raceDate,
      time: payload.raceTime,
      location: payload.raceLocation,
      note: payload.raceNote,
      sprint1Drivers: payload.normalizedSprint1,
      sprint2Drivers: payload.normalizedSprint2,
      results,
      isDraft: true,
      createdAt: existingRace?.createdAt || Date.now(),
      createdBy: currentUser.email || currentUser.uid
    });

    const wasEditing = !!editingRaceId;
    resetForm(false);
    setMessage(wasEditing ? "Concept bijgewerkt." : "Concept opgeslagen. Deze race staat nu ook in de agenda.", "success");
  } catch (error) {
    console.error(error);
    setMessage("Concept opslaan mislukt.", "error");
  }
}

async function saveRace() {
  if (!currentUser) {
    setMessage("Log eerst in om races op te slaan.", "error");
    return;
  }

  try {
    const payload = collectRacePayload(true);
    if (payload.error) return setMessage(payload.error, "error");

    let results = mergeResults(payload.normalizedSprint1, payload.normalizedSprint2);
    const existingRace = editingRaceId ? races.find(r => r.id === editingRaceId) : null;
    results = applyFastestTimeTiebreak(results, existingRace);

    const raceId = editingRaceId || push(ref(db, DB_PATH)).key;
    await set(ref(db, DB_PATH + "/" + raceId), {
      id: raceId,
      name: payload.raceName,
      date: payload.raceDate,
      time: payload.raceTime,
      location: payload.raceLocation,
      note: payload.raceNote,
      sprint1Drivers: payload.normalizedSprint1,
      sprint2Drivers: payload.normalizedSprint2,
      results,
      isDraft: false,
      createdAt: Date.now(),
      createdBy: currentUser.email || currentUser.uid
    });

    const wasEditing = !!editingRaceId;
    resetForm(false);
    setMessage(wasEditing ? "Uitslag succesvol bijgewerkt." : "Race succesvol opgeslagen.", "success");
  } catch (error) {
    console.error(error);
    setMessage("Opslaan mislukt.", "error");
  }
}

function resetForm(clearMessage = true) {
  editingRaceId = null;
  raceNameInput.value = "";
  raceDateInput.value = "";
  if (raceTimeInput) raceTimeInput.value = "";
  if (raceLocationInput) raceLocationInput.value = "";
  if (raceNoteInput) raceNoteInput.value = "";
  sprint1DriversList.innerHTML = "";
  sprint2DriversList.innerHTML = "";
  addDriverRow(sprint1DriversList);
  addDriverRow(sprint1DriversList);
  addDriverRow(sprint2DriversList);
  addDriverRow(sprint2DriversList);
  updateEditUi();
  setControlsEnabled(!!currentUser);
  if (clearMessage) setMessage("");
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
    : '<tr><td colspan="6" class="empty">Nog geen data in de database.</td></tr>';
}

function renderRaceTabs() {
  if (!raceTabs || !raceSelect) return;
  const eligibleRaces = races.filter(race => !race.isDraft).map(race => ({ id: race.id, label: race.name }));
  if (!eligibleRaces.length) {
    raceSelect.innerHTML = "";
    raceTabs.innerHTML = "";
    selectedRaceId = null;
    return;
  }
  if (!selectedRaceId || !eligibleRaces.find(r => r.id === selectedRaceId)) selectedRaceId = eligibleRaces[0].id;
  raceSelect.innerHTML = eligibleRaces.map(tab => `<option value="${tab.id}" ${tab.id === selectedRaceId ? "selected" : ""}>${escapeHtml(tab.label)}</option>`).join("");
  raceTabs.innerHTML = eligibleRaces.map(tab => `<button type="button" class="race-tab ${tab.id === selectedRaceId ? "active" : ""}" data-id="${tab.id}">${escapeHtml(tab.label)}</button>`).join("");
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

function renderHistory() {
  if (!races.length) {
    historyList.innerHTML = '<div class="empty">Nog geen racegeschiedenis beschikbaar.</div>';
    return;
  }

  historyList.innerHTML = races.map(race => {
    const sprint1Items = (race.sprint1Drivers || []).slice().sort((a, b) => Number(a.position) - Number(b.position))
      .map(driver => `<li>P${driver.position || "-"} · ${escapeHtml(driver.name)} · ${driver.points || 0} punten</li>`).join("");
    const sprint2Items = (race.sprint2Drivers || []).slice().sort((a, b) => Number(a.position) - Number(b.position))
      .map(driver => `<li>P${driver.position || "-"} · ${escapeHtml(driver.name)} · ${driver.points || 0} punten</li>`).join("");

        const actions = currentUser ? `

      <div class="race-actions">
        <button type="button" class="secondary edit-race-btn" data-id="${race.id}">Uitslag bewerken</button>
        <button type="button" class="danger delete-race-btn" data-id="${race.id}">Race verwijderen</button>
      </div>` : "";

    return `
      <article class="race-item">
        <div class="race-top">
          <div>
            <h3>${escapeHtml(race.name)}</h3>
            <div class="race-meta">${escapeHtml(formatDateTime(race.date, race.time))} · 2 sprint races van 10 minuten${race.isDraft ? " · Concept" : ""}${race.location ? " · " + escapeHtml(race.location) : ""}</div>
            ${race.note ? `<div class="race-meta">${escapeHtml(race.note)}</div>` : ""}
          </div>
          ${actions}
        </div>
        <div class="split-columns">
          <div><h4>Sprint 1</h4><ol class="race-drivers">${sprint1Items}</ol></div>
          <div><h4>Sprint 2</h4><ol class="race-drivers">${sprint2Items}</ol></div>
        </div>      </article>
    `;
  }).join("");

  document.querySelectorAll(".edit-race-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const race = races.find(r => r.id === btn.dataset.id);
      if (race) loadRaceIntoForm(race);
    });
  });

  document.querySelectorAll(".delete-race-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!currentUser) return;
      if (!confirm("Weet je zeker dat je deze race wilt verwijderen?")) return;
      try {
        await remove(ref(db, DB_PATH + "/" + btn.dataset.id));
        if (editingRaceId === btn.dataset.id) resetForm(false);
        setMessage("Race verwijderd.", "success");
      } catch (error) {
        console.error(error);
        setMessage("Verwijderen mislukt.", "error");
      }
    });
  });
}

async function clearAllData() {
  if (!currentUser) {
    setMessage("Log eerst in om alles te wissen.", "error");
    return;
  }
  if (!confirm("Alles wissen? Alle races worden verwijderd.")) return;
  try {
    await remove(ref(db, DB_PATH));
    resetForm(false);
    setMessage("Alle data is verwijderd.", "success");
  } catch (error) {
    console.error(error);
    setMessage("Wissen mislukt.", "error");
  }
}

function exportData() {
  if (!races.length) return setMessage("Geen data om te exporteren.", "error");
  const blob = new Blob([JSON.stringify(races, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kart-competitie-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  setMessage("Export gestart.", "success");
}

function buildRaceDriverEntry(registration, existingDriver = null) {
  return {
    ...(existingDriver || {}),
    name: registration.naam,
    position: existingDriver?.position ?? "",
    points: existingDriver?.points ?? 0
  };
}

function getRaceParticipantCount(race, excludeName = "") {
  const excluded = normalizeDriverName(excludeName);
  const names = new Set();
  [...(race?.sprint1Drivers || []), ...(race?.sprint2Drivers || [])].forEach(driver => {
    const key = normalizeDriverName(driver?.name);
    if (!key || key === excluded) return;
    names.add(key);
  });
  return names.size;
}

async function archiveProcessedRegistration(registration, status) {
  await set(ref(db, `${REGISTRATIONS_HISTORY_PATH}/${registration.id}`), {
    ...registration,
    status,
    processedAt: Date.now()
  });
}

async function syncRegistrationToRace(registration, nextStatus) {
  const race = races.find(item => item.id === registration.raceId);
  if (!race) throw new Error("Race niet gevonden");

  const registrationNameKey = normalizeDriverName(registration.naam);
  const sprint1Drivers = Array.isArray(race.sprint1Drivers) ? [...race.sprint1Drivers] : [];
  const sprint2Drivers = Array.isArray(race.sprint2Drivers) ? [...race.sprint2Drivers] : [];

  const sprint1Index = sprint1Drivers.findIndex(item => normalizeDriverName(item?.name) === registrationNameKey);
  const sprint2Index = sprint2Drivers.findIndex(item => normalizeDriverName(item?.name) === registrationNameKey);

  if (nextStatus === "goedgekeurd") {
    if (sprint1Index >= 0) {
      sprint1Drivers[sprint1Index] = buildRaceDriverEntry(registration, sprint1Drivers[sprint1Index]);
    } else {
      sprint1Drivers.push(buildRaceDriverEntry(registration));
    }

    if (sprint2Index >= 0) {
      sprint2Drivers[sprint2Index] = buildRaceDriverEntry(registration, sprint2Drivers[sprint2Index]);
    } else {
      sprint2Drivers.push(buildRaceDriverEntry(registration));
    }
  } else if (nextStatus === "afgewezen") {
    if (sprint1Index >= 0) sprint1Drivers.splice(sprint1Index, 1);
    if (sprint2Index >= 0) sprint2Drivers.splice(sprint2Index, 1);
  }

  await set(ref(db, `${DB_PATH}/${race.id}`), {
    ...race,
    sprint1Drivers,
    sprint2Drivers
  });
}

function sortRegistrations(items) {
  return [...items].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function formatRegistrationDate(value) {
  if (!value) return "Onbekend";
  try {
    return new Date(Number(value)).toLocaleString("nl-NL");
  } catch {
    return "Onbekend";
  }
}

function renderRegistrations() {
  if (!inschrijvingenList) return;
  if (!registrations.length) {
    inschrijvingenList.innerHTML = '<div class="empty">Nog geen inschrijvingen ontvangen.</div>';
    return;
  }

  const statusLabels = {
    nieuw: 'Nieuw',
    goedgekeurd: 'Goedgekeurd',
    reserve: 'Reserve',
    afgewezen: 'Afgewezen'
  };

  inschrijvingenList.innerHTML = sortRegistrations(registrations).map(item => `
    <article class="race-item">
      <div class="race-top">
        <div>
          <h3>${escapeHtml(item.naam || 'Onbekend')}</h3>
          <div class="race-meta">Race: ${escapeHtml(item.raceName || '-')}</div>
          <div class="race-meta">E-mail: ${escapeHtml(item.email || '-')}</div>
          <div class="race-meta">Telefoon: ${escapeHtml(item.telefoon || '-')}</div>
          <div class="race-meta">Ontvangen: ${escapeHtml(formatRegistrationDate(item.createdAt))}</div>
          <div class="race-meta">Status: <strong>${escapeHtml(statusLabels[item.status] || item.status || 'nieuw')}</strong></div>
        </div>
        ${currentUser ? `
        <div class="race-actions">
          <button type="button" class="secondary registration-status-btn" data-id="${item.id}" data-status="goedgekeurd">Goedkeuren</button>
          <button type="button" class="secondary registration-status-btn" data-id="${item.id}" data-status="reserve">Reserve</button>
          <button type="button" class="danger registration-status-btn" data-id="${item.id}" data-status="afgewezen">Afwijzen</button>
        </div>` : ''}
      </div>
    </article>
  `).join('');

  document.querySelectorAll('.registration-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!currentUser) return;
      const registrationId = btn.dataset.id;
      const nextStatus = btn.dataset.status;
      const registration = registrations.find(item => item.id === registrationId);
      if (!registration) return;
      try {
        if (nextStatus === "goedgekeurd") {
          const race = races.find(item => item.id === registration.raceId);
          if (!race) throw new Error("Race niet gevonden");
          const currentCount = getRaceParticipantCount(race, registration.naam);
          if (currentCount >= MAX_RACE_PARTICIPANTS) {
            await set(ref(db, `${REGISTRATIONS_PATH}/${registrationId}`), {
              ...registration,
              status: "reserve"
            });
            setMessage(`Race ${race.name} zit vol. ${registration.naam} staat nu op de reservelijst.`, 'error');
            return;
          }
        }

        await syncRegistrationToRace(registration, nextStatus);
        if (nextStatus === "goedgekeurd" || nextStatus === "afgewezen") {
          await archiveProcessedRegistration(registration, nextStatus);
          await remove(ref(db, `${REGISTRATIONS_PATH}/${registrationId}`));
          setMessage(`Inschrijving van ${registration.naam} is verwerkt en uit de inschrijvingenlijst verwijderd.`, 'success');
        } else {
          await set(ref(db, `${REGISTRATIONS_PATH}/${registrationId}`), {
            ...registration,
            status: nextStatus
          });
          setMessage(`Inschrijving van ${registration.naam} is bijgewerkt naar ${nextStatus}.`, 'success');
        }
      } catch (error) {
        console.error(error);
        setMessage('Status bijwerken mislukt.', 'error');
      }
    });
  });
}

addSprint1DriverBtn.addEventListener("click", () => addDriverRow(sprint1DriversList));
addSprint2DriverBtn.addEventListener("click", () => addDriverRow(sprint2DriversList));
saveRaceBtn.addEventListener("click", saveRace);
saveDraftBtn.addEventListener("click", saveDraftRace);
resetFormBtn.addEventListener("click", () => resetForm(true));
cancelEditBtn.addEventListener("click", () => resetForm(true));
exportBtn.addEventListener("click", exportData);
clearAllBtn.addEventListener("click", clearAllData);
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  currentUser = null;
  updateAuthUi();
  renderHistory();
  renderRegistrations();
});

onAuthStateChanged(auth, user => {
  currentUser = user || null;
  updateAuthUi();
  renderHistory();
  renderRegistrations();
});

onValue(ref(db, DB_PATH), snapshot => {
  const data = snapshot.val() || {};
  races = Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
  refreshDriverSuggestions();
  renderSeasonStand();
  renderRaceTabs();
  renderRaceTable();
  renderHistory();
});

onValue(ref(db, REGISTRATIONS_PATH), snapshot => {
  const data = snapshot.val() || {};
  registrations = Object.values(data).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  renderRegistrations();
});

onValue(ref(db, ".info/connected"), snapshot => {
  connectionStatus.textContent = snapshot.val() === true ? "🟢 Live verbonden" : "🔴 Offline";
}, () => {
  connectionStatus.textContent = "🔴 Offline";
});

resetForm();

