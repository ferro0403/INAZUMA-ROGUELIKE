(function (global) {
  "use strict";

  function normalizeUsername(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  function validateUsername(value) {
    const username = String(value ?? "").trim();
    if (username.length < 3 || username.length > 16) return { valid: false, message: "L’username deve contenere da 3 a 16 caratteri." };
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(username)) return { valid: false, message: "Usa una lettera iniziale e soltanto lettere, numeri o underscore." };
    return { valid: true, value: username, normalized: normalizeUsername(username), message: "" };
  }

  function validateRegistration({ username, email, password, passwordConfirmation } = {}) {
    const checkedUsername = validateUsername(username);
    if (!checkedUsername.valid) return checkedUsername;
    if (!String(email || "").trim()) return { valid: false, field: "email", message: "Inserisci un indirizzo email." };
    if (String(password || "").length < 8) return { valid: false, field: "password", message: "La password deve contenere almeno 8 caratteri." };
    if (password !== passwordConfirmation) return { valid: false, field: "passwordConfirmation", message: "Le password non coincidono." };
    return { valid: true, username: checkedUsername.value, usernameNormalized: checkedUsername.normalized, email: String(email).trim() };
  }

  function formatAuthError(error) {
    const code = String(error?.code || "");
    const messages = {
      "auth/email-already-in-use": "Questa email è già associata a un account.",
      "auth/invalid-credential": "Email o password non corrette.",
      "auth/invalid-email": "Inserisci un indirizzo email valido.",
      "auth/weak-password": "La password scelta non è abbastanza sicura.",
      "auth/too-many-requests": "Troppi tentativi. Attendi qualche minuto e riprova.",
      "auth/network-request-failed": "Connessione assente. Controlla la rete e riprova.",
      "auth/user-disabled": "Questo account è stato disabilitato.",
      "permission-denied": "Non è stato possibile creare il profilo. Verifica le regole Firestore.",
      "firestore/permission-denied": "Non è stato possibile creare il profilo. Verifica le regole Firestore.",
      "account/username-taken": "Username già utilizzato. Scegline un altro.",
      "account/cleanup-failed": "Creazione non completata e rollback non riuscito. Esci e contatta l’assistenza prima di riprovare.",
    };
    return messages[code] || "Operazione non riuscita. Riprova tra poco.";
  }

  global.InazumaAccountCore = Object.freeze({ normalizeUsername, validateUsername, validateRegistration, formatAuthError });
  if (typeof module !== "undefined" && module.exports) module.exports = global.InazumaAccountCore;
})(typeof globalThis !== "undefined" ? globalThis : this);
