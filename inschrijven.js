// 🔥 FIXED VERSION - allows re-registration after approval/removal

import { db, ref, push, set, onValue, REGISTRATIONS_PATH } from "./firebase.js";

const form = document.getElementById("inschrijvenForm");
const naamInput = document.getElementById("naam");
const emailInput = document.getElementById("email");
const telefoonInput = document.getElementById("telefoon");
const raceSelect = document.getElementById("race");

let existingRegistrations = [];

onValue(ref(db, REGISTRATIONS_PATH), snapshot => {
  const data = snapshot.val();
  existingRegistrations = data ? Object.values(data) : [];
});

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function collectionHasDuplicate(collection, raceId, naam, email, telefoon) {
  return collection.some(item =>
    item && item.raceId === raceId && (
      normalizeText(item.naam) === normalizeText(naam) ||
      normalizeText(item.email) === normalizeText(email) ||
      normalizePhone(item.telefoon) === normalizePhone(telefoon)
    )
  );
}

// 🔥 FIX: history check removed
function hasDuplicateRegistration(raceId, naam, email, telefoon) {
  return collectionHasDuplicate(existingRegistrations, raceId, naam, email, telefoon);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const naam = naamInput.value;
  const email = emailInput.value;
  const telefoon = telefoonInput.value;
  const raceId = raceSelect.value;

  if (!raceId) {
    alert("Selecteer een race.");
    return;
  }

  if (hasDuplicateRegistration(raceId, naam, email, telefoon)) {
    alert("Je bent al ingeschreven voor deze race.");
    return;
  }

  try {
    await set(push(ref(db, REGISTRATIONS_PATH)), {
      naam,
      email,
      telefoon,
      raceId,
      status: "nieuw",
      createdAt: Date.now()
    });

    alert("Inschrijving succesvol!");
    form.reset();
  } catch (error) {
    console.error(error);
    alert("Er ging iets mis.");
  }
});
