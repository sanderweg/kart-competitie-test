import { auth, signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "./firebase.js";

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const loginMessage = document.getElementById("loginMessage");

function setMessage(text, type = "") {
  loginMessage.textContent = text || "";
  loginMessage.className = type ? "message " + type : "message";
}

function getFriendlyAuthError(error) {
  const code = error?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "Dit e-mailadres is ongeldig.";
    case "auth/missing-email":
      return "Vul eerst een e-mailadres in.";
    case "auth/user-not-found":
      return "Voor dit e-mailadres is geen account gevonden.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "E-mailadres of wachtwoord klopt niet.";
    case "auth/too-many-requests":
      return "Te veel pogingen. Wacht even en probeer opnieuw.";
    case "auth/operation-not-allowed":
      return "Zet in Firebase Authentication Email/Password aan.";
    case "auth/unauthorized-domain":
      return "Dit domein staat nog niet bij Authorized domains in Firebase.";
    default:
      return "Er ging iets mis. Probeer opnieuw.";
  }
}

onAuthStateChanged(auth, user => {
  if (user) window.location.href = "admin.html";
});

loginBtn?.addEventListener("click", async () => {
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      setMessage("Vul e-mailadres en wachtwoord in.", "error");
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "admin.html";
  } catch (error) {
    console.error(error);
    setMessage(getFriendlyAuthError(error), "error");
  }
});

resetPasswordBtn?.addEventListener("click", async () => {
  try {
    const email = emailInput.value.trim();
    if (!email) {
      setMessage("Vul eerst je admin e-mailadres in.", "error");
      return;
    }
    await sendPasswordResetEmail(auth, email);
    setMessage("Resetmail verstuurd. Controleer ook je spammap.", "success");
  } catch (error) {
    console.error(error);
    setMessage(getFriendlyAuthError(error), "error");
  }
});
