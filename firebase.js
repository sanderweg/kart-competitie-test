import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, push, set, remove, onValue, get } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAHJ_U7_H7rO1CLDEmgYm2bY-956R2B3jI",
  authDomain: "karting-competitie.firebaseapp.com",
  databaseURL: "https://karting-competitie-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "karting-competitie",
  storageBucket: "karting-competitie.firebasestorage.app",
  messagingSenderId: "915335846004",
  appId: "1:915335846004:web:5fbc6592f60a93a9031921"
};

export const DB_PATH = "kartCompetitie/races";
export const CALENDAR_PATH = "kartCompetitie/calendar";
export const REGISTRATIONS_PATH = "kartCompetitie/inschrijvingen";
export const REGISTRATIONS_HISTORY_PATH = "kartCompetitie/inschrijvingenHistorie";
export const POINTS_MAP = {0:0,1:25,2:22,3:20,4:19,5:18,6:17,7:16,8:15,9:14,10:13,11:12,12:11,13:10,14:9,15:8,16:7,17:6,18:5,19:4,20:3,21:2,22:1};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

export { ref, push, set, remove, onValue, get, signInWithEmailAndPassword, signOut, onAuthStateChanged };

export function getPoints(position) {
  return POINTS_MAP[position] ?? 0;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDate(dateString) {
  if (!dateString) return "Geen datum";
  return new Date(dateString + "T00:00:00").toLocaleDateString("nl-NL");
}

export function mergeResults(sprint1Drivers, sprint2Drivers) {
  const totals = {};

  sprint1Drivers.forEach(driver => {
    const key = driver.name.toLowerCase();
    if (!totals[key]) {
      totals[key] = {
        driver: driver.name,
        sprint1Position: "-",
        sprint2Position: "-",
        sprint1Points: 0,
        sprint2Points: 0,
        totalPoints: 0,
        bestSprint: 999,
        sprint1Time: "",
        sprint2Time: "",
        totalTime: "",
        totalTimeMs: null
      };
    }
    totals[key].driver = driver.name;
    totals[key].sprint1Position = Number(driver.position);
    totals[key].sprint1Points = Number(driver.points);
    totals[key].totalPoints += Number(driver.points);
    if (Number(driver.position) > 0) {
      totals[key].bestSprint = Math.min(totals[key].bestSprint, Number(driver.position));
    }
  });

  sprint2Drivers.forEach(driver => {
    const key = driver.name.toLowerCase();
    if (!totals[key]) {
      totals[key] = {
        driver: driver.name,
        sprint1Position: "-",
        sprint2Position: "-",
        sprint1Points: 0,
        sprint2Points: 0,
        totalPoints: 0,
        bestSprint: 999,
        sprint1Time: "",
        sprint2Time: "",
        totalTime: "",
        totalTimeMs: null
      };
    }
    totals[key].driver = driver.name;
    totals[key].sprint2Position = Number(driver.position);
    totals[key].sprint2Points = Number(driver.points);
    totals[key].totalPoints += Number(driver.points);
    if (Number(driver.position) > 0) {
      totals[key].bestSprint = Math.min(totals[key].bestSprint, Number(driver.position));
    }
  });

  return Object.values(totals);
}

export function buildSeasonRows(races) {
  const allDrivers = {};
  const raceCount = races.length;

  races.forEach((race, raceIndex) => {
    (race.results || []).forEach(result => {
      const key = result.driver.toLowerCase();
      if (!allDrivers[key]) {
        allDrivers[key] = {
          driver: result.driver,
          bestSprint: 999,
          sprintPoints: Array(raceCount * 2).fill(0)
        };
      }
      allDrivers[key].driver = result.driver;
      allDrivers[key].sprintPoints[raceIndex * 2] = Number(result.sprint1Points || 0);
      allDrivers[key].sprintPoints[raceIndex * 2 + 1] = Number(result.sprint2Points || 0);
      if (Number(result.bestSprint || 999) < allDrivers[key].bestSprint) {
        allDrivers[key].bestSprint = Number(result.bestSprint || 999);
      }
    });
  });

  return Object.values(allDrivers).map(driver => {
    const sorted = [...driver.sprintPoints].sort((a, b) => a - b);
    const dropped = sorted.slice(0, 2);
    const counted = sorted.slice(2);
    const totalPoints = counted.reduce((sum, p) => sum + p, 0);

    return {
      driver: driver.driver,
      points: totalPoints,
      sprints: driver.sprintPoints.length,
      dropped: dropped.join(" + "),
      bestSprint: driver.bestSprint === 999 ? "-" : "P" + driver.bestSprint
    };
  }).sort((a, b) =>
    b.points - a.points ||
    (a.bestSprint === "-" ? 999 : Number(a.bestSprint.replace("P", ""))) - (b.bestSprint === "-" ? 999 : Number(b.bestSprint.replace("P", ""))) ||
    a.driver.localeCompare(b.driver, "nl")
  );
}


export function formatDateTime(dateString, timeString = "") {
  if (!dateString) return "Geen datum";
  const date = new Date(dateString + "T" + (timeString || "00:00:00"));
  const datePart = date.toLocaleDateString("nl-NL");
  if (!timeString) return datePart;
  return `${datePart} om ${timeString}`;
}
