// ===== TILA =====
let workouts = [];
let filteredWorkouts = [];
let workoutChart = null;
let authToken = localStorage.getItem("token") || null;
let currentUsername = localStorage.getItem("username") || null;

const DISTANCE_TYPES = ["Juoksu", "Kävely"];

// ===== ALUSTUS =====
document.addEventListener("DOMContentLoaded", () => {
  if (authToken) {
    showApp();
    loadWorkouts();
  } else {
    showAuth();
  }

  document.getElementById("date").valueAsDate = new Date();

  document.getElementById("type").addEventListener("change", function () {
    if (DISTANCE_TYPES.includes(this.value)) {
      document.getElementById("distance-fields").style.display = "";
    } else {
      document.getElementById("distance-fields").style.display = "none";
      document.getElementById("dist-km").value = "";
      document.getElementById("dist-m").value = "";
    }
  });
});

// ===== AUTH-NÄKYMÄT =====
function showAuth() {
  document.getElementById("auth-view").style.display = "";
  document.getElementById("app-view").style.display = "none";
}

function showApp() {
  document.getElementById("auth-view").style.display = "none";
  document.getElementById("app-view").style.display = "";
  document.getElementById("header-username").textContent = currentUsername || "";
}

function showTab(tab) {
  document.getElementById("form-login").style.display = tab === "login" ? "" : "none";
  document.getElementById("form-register").style.display = tab === "register" ? "" : "none";
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
  document.getElementById("auth-error").style.display = "none";
}

function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg;
  el.style.display = "";
}

// ===== KIRJAUTUMINEN =====
async function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  if (!username || !password) return showAuthError("Täytä kaikki kentät.");

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return showAuthError(data.error || "Kirjautuminen epäonnistui.");

    authToken = data.token;
    currentUsername = data.username;
    localStorage.setItem("token", authToken);
    localStorage.setItem("username", currentUsername);
    showApp();
    loadWorkouts();
  } catch {
    showAuthError("Verkkovirhe. Tarkista yhteys palvelimeen.");
  }
}

// ===== REKISTERÖINTI =====
async function register() {
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  if (!username || !password) return showAuthError("Täytä kaikki kentät.");

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return showAuthError(data.error || "Rekisteröinti epäonnistui.");

    authToken = data.token;
    currentUsername = data.username;
    localStorage.setItem("token", authToken);
    localStorage.setItem("username", currentUsername);
    showApp();
    loadWorkouts();
  } catch {
    showAuthError("Verkkovirhe. Tarkista yhteys palvelimeen.");
  }
}

// ===== ULOSKIRJAUTUMINEN =====
function logout() {
  authToken = null;
  currentUsername = null;
  workouts = [];
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  showAuth();
}

// ===== API-APUFUNKTIO =====
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error("Istunto vanhentunut");
  }
  return res;
}

// ===== LATAA TREENIT =====
async function loadWorkouts() {
  try {
    const res = await apiFetch("/api/workouts");
    const data = await res.json();
    workouts = data.map((w) => ({
      ...w,
      distanceKm: w.distance_km,
      distanceM: w.distance_m,
      hasDistance: w.has_distance === 1,
    }));
    applyFilters();
  } catch (e) {
    if (e.message !== "Istunto vanhentunut") console.error(e);
  }
}

// ===== LISÄÄ TREENI =====
async function addWorkout() {
  const date = document.getElementById("date").value;
  const type = document.getElementById("type").value;
  const duration = parseInt(document.getElementById("duration").value, 10);
  const intensity = document.getElementById("intensity").value;
  const notes = document.getElementById("notes").value.trim();

  const errEl = document.getElementById("form-error");
  errEl.style.display = "none";

  if (!date || !type || !duration || !intensity) {
    errEl.textContent = "Täytä kaikki pakolliset kentät.";
    errEl.style.display = "";
    return;
  }

  const payload = { date, type, duration, intensity, notes };

  if (DISTANCE_TYPES.includes(type)) {
    const km = parseInt(document.getElementById("dist-km").value, 10) || 0;
    const m = parseInt(document.getElementById("dist-m").value, 10) || 0;
    payload.distance_km = km;
    payload.distance_m = m;
    payload.has_distance = km > 0 || m > 0;
  } else {
    payload.distance_km = 0;
    payload.distance_m = 0;
    payload.has_distance = false;
  }

  try {
    const res = await apiFetch("/api/workouts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || "Tallennus epäonnistui.";
      errEl.style.display = "";
      return;
    }

    workouts.unshift({
      ...data,
      distanceKm: data.distance_km,
      distanceM: data.distance_m,
      hasDistance: data.has_distance === 1,
    });

    // Reset form
    document.getElementById("type").value = "";
    document.getElementById("duration").value = "";
    document.getElementById("intensity").value = "";
    document.getElementById("notes").value = "";
    document.getElementById("dist-km").value = "";
    document.getElementById("dist-m").value = "";
    document.getElementById("distance-fields").style.display = "none";
    document.getElementById("date").valueAsDate = new Date();

    applyFilters();
  } catch (e) {
    if (e.message !== "Istunto vanhentunut") {
      errEl.textContent = "Verkkovirhe.";
      errEl.style.display = "";
    }
  }
}

// ===== POISTA TREENI =====
async function deleteWorkout(id) {
  try {
    const res = await apiFetch(`/api/workouts/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    workouts = workouts.filter((w) => w.id !== id);
    applyFilters();
  } catch (e) {
    if (e.message !== "Istunto vanhentunut") console.error(e);
  }
}

// ===== SUODATUS =====
function getPeriodStart(period) {
  const now = new Date();
  if (period === "Viikko") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  if (period === "Kuukausi") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "Vuosi") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function applyFilters() {
  const typeFilter = document.getElementById("filter-type").value;
  const intensityFilter = document.getElementById("filter-intensity").value;
  const periodFilter = document.getElementById("filter-period").value;
  const periodStart = getPeriodStart(periodFilter);

  filteredWorkouts = workouts.filter((w) => {
    const matchType = typeFilter === "Kaikki" || w.type === typeFilter;
    const matchIntensity = intensityFilter === "Kaikki" || w.intensity === intensityFilter;
    let matchPeriod = true;
    if (periodStart) {
      const wDate = new Date(w.date);
      matchPeriod = wDate >= periodStart;
    }
    return matchType && matchIntensity && matchPeriod;
  });

  renderTable();
  updateSummary();
  renderChart();
}

function clearFilters() {
  document.getElementById("filter-type").value = "Kaikki";
  document.getElementById("filter-intensity").value = "Kaikki";
  document.getElementById("filter-period").value = "Kaikki";
  applyFilters();
}

// ===== RENDERÖI TAULUKKO =====
function formatDistance(km, m) {
  if (!km && !m) return "–";
  const parts = [];
  if (km > 0) parts.push(`${km} km`);
  if (m > 0) parts.push(`${m} m`);
  return parts.join(" ");
}

function renderTable() {
  const tbody = document.getElementById("workout-tbody");
  tbody.innerHTML = "";

  if (filteredWorkouts.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Ei treenejä valituilla suodattimilla.</td></tr>`;
    return;
  }

  filteredWorkouts.forEach((w) => {
    const distCell = DISTANCE_TYPES.includes(w.type)
      ? (w.hasDistance ? formatDistance(w.distanceKm, w.distanceM) : "–")
      : "–";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${w.date}</td>
      <td>${w.type}</td>
      <td>${w.duration} min</td>
      <td>${distCell}</td>
      <td><span class="badge badge-${w.intensity}">${w.intensity}</span></td>
      <td>${w.notes || "–"}</td>
      <td><button class="btn-delete" onclick="deleteWorkout(${w.id})">Poista</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== YHTEENVETO =====
function totalMeters(arr, type) {
  return arr
    .filter((w) => w.type === type && w.hasDistance)
    .reduce((sum, w) => sum + (w.distanceKm || 0) * 1000 + (w.distanceM || 0), 0);
}

function metersToDisplay(totalM) {
  if (!totalM) return "0 m";
  const km = Math.floor(totalM / 1000);
  const m = totalM % 1000;
  return [km > 0 ? `${km} km` : null, m > 0 ? `${m} m` : null].filter(Boolean).join(" ");
}

function updateSummary() {
  const total = filteredWorkouts.length;
  const totalMin = filteredWorkouts.reduce((s, w) => s + w.duration, 0);
  const avg = total > 0 ? Math.round(totalMin / total) : 0;

  document.getElementById("total-workouts").textContent = total;
  document.getElementById("total-minutes").textContent = totalMin;
  document.getElementById("avg-minutes").textContent = avg;

  const runM = totalMeters(filteredWorkouts, "Juoksu");
  const walkM = totalMeters(filteredWorkouts, "Kävely");
  const hasDist = filteredWorkouts.some((w) => DISTANCE_TYPES.includes(w.type) && w.hasDistance);

  document.getElementById("distance-summary").style.display = hasDist ? "" : "none";
  if (hasDist) {
    document.getElementById("total-run-dist").textContent = metersToDisplay(runM);
    document.getElementById("total-walk-dist").textContent = metersToDisplay(walkM);
  }
}

// ===== KAAVIO =====
function renderChart() {
  const ctx = document.getElementById("workout-chart").getContext("2d");
  const typeMap = {};
  filteredWorkouts.forEach((w) => {
    typeMap[w.type] = (typeMap[w.type] || 0) + w.duration;
  });

  const labels = Object.keys(typeMap);
  const data = Object.values(typeMap);

  if (workoutChart) workoutChart.destroy();

  workoutChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Kokonaiskesto (min)",
        data,
        backgroundColor: "rgba(232,255,71,0.7)",
        borderColor: "rgba(232,255,71,1)",
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#888" },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#888" },
        },
      },
    },
  });
}

// Enter-näppäin kirjautumisessa
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const loginVisible = document.getElementById("form-login").style.display !== "none";
  const registerVisible = document.getElementById("form-register").style.display !== "none";
  const authVisible = document.getElementById("auth-view").style.display !== "none";
  if (!authVisible) return;
  if (loginVisible) login();
  else if (registerVisible) register();
});