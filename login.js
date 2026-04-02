import { auth, signInWithEmailAndPassword, onAuthStateChanged } from "./firebase.js";

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

function setMessage(text, type = "") {
  loginMessage.textContent = text || "";
  loginMessage.className = type ? "message " + type : "message";
}

onAuthStateChanged(auth, user => {
  if (user) window.location.href = "admin.html";
});

loginBtn.addEventListener("click", async () => {
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
    setMessage("Inloggen mislukt.", "error");
  }
});