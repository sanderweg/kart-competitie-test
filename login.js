import { auth, signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "./firebase.js";

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const sendResetMailBtn = document.getElementById("sendResetMailBtn");
const resetInfoBox = document.getElementById("resetInfoBox");
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

if (resetPasswordBtn) {
  resetPasswordBtn.addEventListener("click", () => {
    resetInfoBox.classList.toggle("hidden");
    setMessage("");
  });
}

if (sendResetMailBtn) {
  sendResetMailBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    if (!email) {
      setMessage("Vul eerst je admin e-mailadres in.", "error");
      emailInput.focus();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Als dit e-mailadres bestaat, is er een resetmail verstuurd.", "success");
      resetInfoBox.classList.add("hidden");
    } catch (error) {
      console.error(error);
      setMessage("Resetmail versturen mislukt.", "error");
    }
  });
}
