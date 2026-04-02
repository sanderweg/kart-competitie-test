import { db, DB_PATH, REGISTRATIONS_PATH, ref, push, set, onValue, escapeHtml } from "./firebase.js";

const raceSelect = document.getElementById("raceSelect");
const naamInput = document.getElementById("naam");
const emailInput = document.getElementById("email");
const telefoonInput = document.getElementById("telefoon");
const submitBtn = document.getElementById("submitBtn");
const messageEl = document.getElementById("message");

let openRaces = [];

function setMessage(text, type = "") {
  messageEl.textContent = text || "";
  messageEl.className = type ? `message ${type}` : "message";
}

function renderRaceOptions() {
  if (!raceSelect) return;
  if (!openRaces.length) {
    raceSelect.innerHTML = '<option value="">Geen open races beschikbaar</option>';
    submitBtn.disabled = true;
    return;
  }

  raceSelect.innerHTML = openRaces.map(race => `
    <option value="${escapeHtml(race.id)}">${escapeHtml(race.name || 'Onbekende race')}</option>
  `).join("");
  submitBtn.disabled = false;
}

onValue(ref(db, DB_PATH), snapshot => {
  const data = snapshot.val() || {};
  openRaces = Object.values(data)
    .filter(race => race && race.isDraft)
    .sort((a, b) => new Date(`${a.date || ''}T${a.time || '00:00'}`) - new Date(`${b.date || ''}T${b.time || '00:00'}`));
  renderRaceOptions();
});

submitBtn.addEventListener("click", async () => {
  const naam = String(naamInput.value || "").trim();
  const email = String(emailInput.value || "").trim();
  const telefoon = String(telefoonInput.value || "").trim();
  const raceId = raceSelect.value;
  const race = openRaces.find(item => item.id === raceId);

  if (!raceId || !race) {
    setMessage("Er is op dit moment geen race beschikbaar om voor in te schrijven.", "error");
    return;
  }
  if (!naam || !email || !telefoon) {
    setMessage("Vul naam, e-mailadres en telefoonnummer in.", "error");
    return;
  }

  try {
    submitBtn.disabled = true;
    const newRef = push(ref(db, REGISTRATIONS_PATH));
    await set(newRef, {
      id: newRef.key,
      raceId: race.id,
      raceName: race.name || "",
      naam,
      email,
      telefoon,
      status: "nieuw",
      createdAt: Date.now()
    });

    naamInput.value = "";
    emailInput.value = "";
    telefoonInput.value = "";
    setMessage("Je inschrijving is ontvangen en staat nu in behandeling.", "success");
  } catch (error) {
    console.error(error);
    setMessage("Inschrijven mislukt. Probeer het opnieuw.", "error");
  } finally {
    submitBtn.disabled = !openRaces.length;
  }
});
