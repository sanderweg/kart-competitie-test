import { db, DB_PATH, REGISTRATIONS_PATH, REGISTRATIONS_HISTORY_PATH, ref, push, set, onValue, get, escapeHtml } from "./firebase.js";

const MAX_RACE_PARTICIPANTS = 22;

const raceSelect = document.getElementById("raceSelect");
const naamInput = document.getElementById("naam");
const emailInput = document.getElementById("email");
const telefoonInput = document.getElementById("telefoon");
const submitBtn = document.getElementById("submitBtn");
const messageEl = document.getElementById("message");

let openRaces = [];
let existingRegistrations = [];
let registrationHistory = [];
let isSubmitting = false;

function setMessage(text, type = "") {
  if (!messageEl) return;
  messageEl.textContent = text || "";
  messageEl.className = type ? `message ${type}` : "message";
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function renderRaceOptions() {
  if (!raceSelect) return;

  if (!openRaces.length) {
    raceSelect.innerHTML = '<option value="">Geen open races beschikbaar</option>';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  raceSelect.innerHTML = openRaces.map(race => `
    <option value="${escapeHtml(race.id)}">${escapeHtml(race.name || "Onbekende race")}</option>
  `).join("");

  if (submitBtn) submitBtn.disabled = false;
}

function getApprovedNameKeysForRace(race) {
  const keys = new Set();
  if (!race) return keys;

  [...(race.sprint1Drivers || []), ...(race.sprint2Drivers || [])].forEach(driver => {
    const key = normalizeText(driver?.name);
    if (key) keys.add(key);
  });

  return keys;
}

function getFilledMainSpots(raceId, raceData = null, registrationsData = null) {
  const race = raceData || openRaces.find(item => item.id === raceId);
  const registrations = registrationsData || existingRegistrations;
  const approvedCount = getApprovedNameKeysForRace(race).size;
  const pendingCount = registrations.filter(item => item.raceId === raceId && item.status !== "reserve").length;
  return approvedCount + pendingCount;
}

function raceAlreadyContainsParticipant(race, naam) {
  const normalizedNaam = normalizeText(naam);
  return getApprovedNameKeysForRace(race).has(normalizedNaam);
}

function collectionHasDuplicate(items, raceId, naam, email, telefoon) {
  const normalizedNaam = normalizeText(naam);
  const normalizedEmail = normalizeText(email);
  const normalizedTelefoon = normalizePhone(telefoon);

  return items.some(item =>
    item && item.raceId === raceId && (
      normalizeText(item.naam) === normalizedNaam ||
      normalizeText(item.email) === normalizedEmail ||
      normalizePhone(item.telefoon) === normalizedTelefoon
    )
  );
}

// Historie blokkeert niet meer. Alleen huidige race-deelnemers en open inschrijvingen blokkeren.
function hasDuplicateRegistration(raceId, naam, email, telefoon, raceData = null, registrationsData = null) {
  const registrations = registrationsData || existingRegistrations;
  const race = raceData || openRaces.find(item => item.id === raceId);

  if (raceAlreadyContainsParticipant(race, naam)) return true;
  if (collectionHasDuplicate(registrations, raceId, naam, email, telefoon)) return true;

  return false;
}

// Alleen concept-races tonen
onValue(ref(db, DB_PATH), snapshot => {
  const data = snapshot.val() || {};
  openRaces = Object.values(data)
    .filter(race => race && race.isDraft === true)
    .sort((a, b) => new Date(`${a.date || ""}T${a.time || "00:00"}`) - new Date(`${b.date || ""}T${b.time || "00:00"}`));

  renderRaceOptions();
});

onValue(ref(db, REGISTRATIONS_PATH), snapshot => {
  const data = snapshot.val() || {};
  existingRegistrations = Object.values(data);
});

onValue(ref(db, REGISTRATIONS_HISTORY_PATH), snapshot => {
  const data = snapshot.val() || {};
  registrationHistory = Object.values(data);
});

submitBtn?.addEventListener("click", async () => {
  if (isSubmitting) return;

  const naam = String(naamInput?.value || "").trim();
  const email = String(emailInput?.value || "").trim();
  const telefoon = String(telefoonInput?.value || "").trim();
  const raceId = raceSelect?.value || "";
  const race = openRaces.find(item => item.id === raceId);

  if (!raceId || !race) {
    setMessage("Er is op dit moment geen concept-race beschikbaar om voor in te schrijven.", "error");
    return;
  }

  if (!naam || !email || !telefoon) {
    setMessage("Vul naam, e-mailadres en telefoonnummer in.", "error");
    return;
  }

  try {
    isSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    const [freshRaceSnapshot, freshRegistrationsSnapshot] = await Promise.all([
      get(ref(db, `${DB_PATH}/${raceId}`)),
      get(ref(db, REGISTRATIONS_PATH))
    ]);

    const freshRace = freshRaceSnapshot.val() || race;
    const freshRegistrations = Object.values(freshRegistrationsSnapshot.val() || {});

    if (hasDuplicateRegistration(raceId, naam, email, telefoon, freshRace, freshRegistrations)) {
      window.alert("Deze naam, dit e-mailadres of dit telefoonnummer is al aangemeld voor deze race.");
      setMessage("Deze naam, dit e-mailadres of dit telefoonnummer is al gebruikt voor deze race.", "error");
      return;
    }

    const filledMainSpots = getFilledMainSpots(raceId, freshRace, freshRegistrations);
    const nextStatus = filledMainSpots >= MAX_RACE_PARTICIPANTS ? "reserve" : "nieuw";

    const newRef = push(ref(db, REGISTRATIONS_PATH));
    const payload = {
      id: newRef.key,
      raceId: freshRace.id || race.id,
      raceName: freshRace.name || race.name || "",
      naam,
      email,
      telefoon,
      status: nextStatus,
      createdAt: Date.now()
    };

    await set(newRef, payload);
    existingRegistrations = [...existingRegistrations, payload];

    if (naamInput) naamInput.value = "";
    if (emailInput) emailInput.value = "";
    if (telefoonInput) telefoonInput.value = "";

    if (nextStatus === "reserve") {
      window.alert("Deze race zit vol. Je bent op de reservelijst geplaatst.");
      setMessage("Deze race zit vol. Je inschrijving is opgeslagen op de reservelijst.", "success");
    } else {
      setMessage("Je inschrijving is ontvangen en staat nu in behandeling.", "success");
    }
  } catch (error) {
    console.error(error);
    setMessage("Inschrijven mislukt. Probeer het opnieuw.", "error");
  } finally {
    isSubmitting = false;
    if (submitBtn) submitBtn.disabled = !openRaces.length;
  }
});
