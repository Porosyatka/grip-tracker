// ============================================================
// FIREBASE CONFIG — твои личные ключи
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc }
  from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGKnXnUlnFtAYihHpxy5vT6s08WD77Iqk",
  authDomain: "grip-tracker-19ac5.firebaseapp.com",
  projectId: "grip-tracker-19ac5",
  storageBucket: "grip-tracker-19ac5.firebasestorage.app",
  messagingSenderId: "963026553374",
  appId: "1:963026553374:web:199181d13d007b7e9efc0f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
// ЦВЕТА ДЛЯ ЖЁСТКОСТИ ЭСПАНДЕРА
// bg — фон тега, text — цвет текста, dot — цвет кружка в селекте
// ============================================================
const RESISTANCE_COLORS = {
  20: { bg: "#e8f4f8", text: "#2a7a9b", dot: "#64b5d9", label: "20 lb — Лёгкий" },
  30: { bg: "#e8f5e9", text: "#2e7d32", dot: "#66bb6a", label: "30 lb — Средний" },
  40: { bg: "#b3d9f5", text: "#1565c0", dot: "#42a5f5", label: "40 lb — Сильный" },
  50: { bg: "#ffe0b2", text: "#e65100", dot: "#ffa726", label: "50 lb — Очень сильный" },
  60: { bg: "#ffccbc", text: "#bf360c", dot: "#ff7043", label: "60 lb — Экстрим" },
};

// ============================================================
// СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================================
let currentUser = null;
let sessions = [];
let unsubscribe = null;
let reps = { L: 100, R: 100 };
let sets = 3;
let chart = null;
let selectedResistance = 40; // текущая выбранная жёсткость

// ============================================================
// КАСТОМНЫЙ СЕЛЕКТ — инициализация
// Строим список опций из объекта RESISTANCE_COLORS
// ============================================================
function initCustomSelect() {
  const optionsContainer = document.getElementById("resistance-options");
  const selectedDot = document.getElementById("selected-dot");
  const selectedLabel = document.getElementById("selected-label");

  // Строим HTML для каждой опции
  Object.entries(RESISTANCE_COLORS).forEach(([val, color]) => {
    const div = document.createElement("div");
    div.className = "custom-select-option" + (parseInt(val) === selectedResistance ? " selected" : "");
    div.innerHTML = `<span class="res-dot" style="background:${color.dot}"></span>${color.label}`;
    div.addEventListener("click", () => {
      selectedResistance = parseInt(val);
      document.getElementById("resistance").value = val;
      selectedDot.style.background = color.dot;
      selectedLabel.textContent = color.label;
      // Убираем selected у всех, ставим текущему
      document.querySelectorAll(".custom-select-option").forEach(o => o.classList.remove("selected"));
      div.classList.add("selected");
      closeSelect();
    });
    optionsContainer.appendChild(div);
  });

  // Устанавливаем начальное состояние (40 lb)
  const defaultColor = RESISTANCE_COLORS[40];
  selectedDot.style.background = defaultColor.dot;

  // Закрываем селект при клике вне него
  document.addEventListener("click", e => {
    if (!document.getElementById("resistance-select").contains(e.target)) {
      closeSelect();
    }
  });
}

window.toggleSelect = function() {
  const selected = document.getElementById("resistance-selected");
  const options = document.getElementById("resistance-options");
  selected.classList.toggle("open");
  options.classList.toggle("open");
};

function closeSelect() {
  document.getElementById("resistance-selected").classList.remove("open");
  document.getElementById("resistance-options").classList.remove("open");
}

// ============================================================
// АВТОРИЗАЦИЯ
// ============================================================
const provider = new GoogleAuthProvider();

document.getElementById("btn-login").addEventListener("click", () => {
  signInWithPopup(auth, provider).catch(err => showToast("Ошибка входа: " + err.message, true));
});

document.getElementById("btn-logout").addEventListener("click", () => {
  signOut(auth);
});

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app-screen").style.display = "block";
    document.getElementById("user-email").textContent = user.email;
    loadSessions();
  } else {
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app-screen").style.display = "none";
    if (unsubscribe) unsubscribe();
    sessions = [];
  }
});

// ============================================================
// ЗАГРУЗКА ДАННЫХ ИЗ FIREBASE
// ============================================================
function loadSessions() {
  const q = query(
    collection(db, "users", currentUser.uid, "sessions"),
    orderBy("timestamp", "desc")
  );

  unsubscribe = onSnapshot(q, snapshot => {
    sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderAll();
  });
}

// ============================================================
// СОХРАНЕНИЕ ТРЕНИРОВКИ
// ============================================================
document.getElementById("btn-log").addEventListener("click", async () => {
  const resistance = parseInt(document.getElementById("resistance").value);
  const now = new Date();

  const session = {
    timestamp: now.getTime(),
    date: now.toLocaleDateString("ru-RU"),
    time: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    repsL: reps.L,
    repsR: reps.R,
    sets: sets,
    resistance: resistance,
    totalL: reps.L * sets,
    totalR: reps.R * sets,
    total: (reps.L + reps.R) * sets
  };

  try {
    await addDoc(collection(db, "users", currentUser.uid, "sessions"), session);
    showToast("Записано!");
  } catch (err) {
    showToast("Ошибка сохранения", true);
  }
});

// ============================================================
// УДАЛЕНИЕ ТРЕНИРОВКИ
// ============================================================
async function deleteSession(id) {
  if (!confirm("Удалить эту тренировку?")) return;
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "sessions", id));
  } catch (err) {
    showToast("Ошибка удаления", true);
  }
}
window.deleteSession = deleteSession;

// ============================================================
// УПРАВЛЕНИЕ ПОВТОРЕНИЯМИ И ПОДХОДАМИ
// ============================================================
window.changeReps = function(hand, delta) {
  reps[hand] = Math.max(10, reps[hand] + delta);
  document.getElementById("reps-" + hand).textContent = reps[hand];
};

window.changeSets = function(delta) {
  sets = Math.max(1, Math.min(10, sets + delta));
  document.getElementById("sets-val").textContent = sets;
};

window.setPreset = function(btn, val) {
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  reps.L = val; reps.R = val;
  document.getElementById("reps-L").textContent = val;
  document.getElementById("reps-R").textContent = val;
  document.getElementById("reps-custom").value = "";
};

window.customReps = function(input) {
  const v = parseInt(input.value);
  if (v > 0) {
    reps.L = v; reps.R = v;
    document.getElementById("reps-L").textContent = v;
    document.getElementById("reps-R").textContent = v;
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
  }
};

// ============================================================
// ОТРИСОВКА ВСЕГО ИНТЕРФЕЙСА
// ============================================================
function renderAll() {
  renderStats();
  renderChart();
  renderHistory();
}

// activeHand — какая рука сейчас активна на графике ('L' или 'R')
let activeHand = 'L';

function renderStats() {
  const today = new Date().toLocaleDateString("ru-RU");

  // Считаем отдельно для каждой руки
  const totalL = sessions.reduce((a, s) => a + s.totalL, 0);
  const totalR = sessions.reduce((a, s) => a + s.totalR, 0);
  const todayL = sessions.filter(s => s.date === today).reduce((a, s) => a + s.totalL, 0);
  const todayR = sessions.filter(s => s.date === today).reduce((a, s) => a + s.totalR, 0);
  const bestL = sessions.reduce((a, s) => Math.max(a, s.repsL), 0);
  const bestR = sessions.reduce((a, s) => Math.max(a, s.repsR), 0);

  const fmt = v => v > 999 ? (v / 1000).toFixed(1) + "k" : v;

  document.getElementById("stat-today-L").textContent = fmt(todayL);
  document.getElementById("stat-today-R").textContent = fmt(todayR);
  document.getElementById("stat-total-L").textContent = fmt(totalL);
  document.getElementById("stat-total-R").textContent = fmt(totalR);
  document.getElementById("stat-best-L").textContent = bestL;
  document.getElementById("stat-best-R").textContent = bestR;
}

// ============================================================
// ПЕРЕКЛЮЧАТЕЛЬ РУК НА ГРАФИКЕ
// ============================================================
window.setActiveHand = function(hand, btn) {
  activeHand = hand;
  document.querySelectorAll(".hand-toggle-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderChart();
};

// ============================================================
// ГРАФИК ПРОГРЕССА
// Агрегируем данные по дням — суммируем все тренировки за день.
// Показываем обе руки, активная — яркая, неактивная — тусклая.
// Точки окрашены в цвет эспандера последней тренировки дня.
// ============================================================
function renderChart() {
  const ctx = document.getElementById("progress-chart").getContext("2d");

  // Группируем тренировки по дате
  // Результат: { "01.01.2025": { L: 600, R: 600, resistance: 40 }, ... }
  const byDay = {};
  [...sessions].reverse().forEach(s => {
    if (!byDay[s.date]) byDay[s.date] = { L: 0, R: 0, resistance: s.resistance };
    byDay[s.date].L += s.totalL;
    byDay[s.date].R += s.totalR;
    byDay[s.date].resistance = s.resistance; // берём жёсткость последней тренировки дня
  });

  const days = Object.keys(byDay).slice(-14); // последние 14 дней
  const labels = days;
  const dataL = days.map(d => byDay[d].L);
  const dataR = days.map(d => byDay[d].R);

  // Цвет точек по жёсткости эспандера
  const pointColors = days.map(d => {
    const color = RESISTANCE_COLORS[byDay[d].resistance] || RESISTANCE_COLORS[40];
    return color.dot;
  });

  if (chart) chart.destroy();

  // Активная рука — яркая линия, неактивная — тусклая
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "✋ Левая",
          data: dataL,
          borderColor: activeHand === 'L' ? "#e8ff00" : "#333",
          backgroundColor: activeHand === 'L' ? "rgba(232,255,0,0.06)" : "transparent",
          borderWidth: activeHand === 'L' ? 2 : 1,
          pointBackgroundColor: activeHand === 'L' ? pointColors : "#333",
          pointBorderColor: activeHand === 'L' ? pointColors : "#333",
          pointRadius: activeHand === 'L' ? 6 : 3,
          tension: 0.3,
          fill: activeHand === 'L',
        },
        {
          label: "🤚 Правая",
          data: dataR,
          borderColor: activeHand === 'R' ? "#e8ff00" : "#333",
          backgroundColor: activeHand === 'R' ? "rgba(232,255,0,0.06)" : "transparent",
          borderWidth: activeHand === 'R' ? 2 : 1,
          pointBackgroundColor: activeHand === 'R' ? pointColors : "#333",
          pointBorderColor: activeHand === 'R' ? pointColors : "#333",
          pointRadius: activeHand === 'R' ? 6 : 3,
          tension: 0.3,
          fill: activeHand === 'R',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // свою легенду рисуем сами
        tooltip: {
          backgroundColor: "#1a1a1a",
          titleColor: "#e8ff00",
          bodyColor: "#f0f0f0",
          borderColor: "#2a2a2a",
          borderWidth: 1,
        }
      },
      scales: {
        x: {
          ticks: { color: "#555", font: { family: "IBM Plex Mono", size: 10 } },
          grid: { color: "#1a1a1a" }
        },
        y: {
          beginAtZero: true,  // ось Y всегда начинается с 0
          ticks: { color: "#555", font: { family: "IBM Plex Mono", size: 10 } },
          grid: { color: "#1a1a1a" }
        }
      }
    }
  });

  renderChartLegend();
}

function renderChartLegend() {
  const legend = document.getElementById("chart-legend");
  if (!legend) return;
  legend.innerHTML = Object.entries(RESISTANCE_COLORS).map(([val, color]) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:10px;color:${color.text}">
      <span style="width:8px;height:8px;border-radius:50%;background:${color.dot};display:inline-block"></span>
      ${val} lb
    </span>`
  ).join("");
}

// ============================================================
// ИСТОРИЯ — компактная одна строка на запись
// ============================================================
function renderHistory() {
  const container = document.getElementById("history-list");

  if (sessions.length === 0) {
    container.innerHTML = `<div class="empty-state">НЕТ ЗАПИСЕЙ</div>`;
    return;
  }

  container.innerHTML = sessions.map(s => {
    const color = RESISTANCE_COLORS[s.resistance] || RESISTANCE_COLORS[40];
    return `
      <div class="session-row">
        <span class="session-date">${s.date} ${s.time}</span>
        <span class="resistance-tag" style="background:${color.bg};color:${color.text}">${s.resistance} lb</span>
        <span class="session-info">✋${s.totalL} 🤚${s.totalR} — <strong>${s.total}</strong> сж.</span>
        <button class="delete-btn" onclick="deleteSession('${s.id}')" title="Удалить">✕</button>
      </div>
    `;
  }).join("");
}

// ============================================================
// ТОСТ
// ============================================================
function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.background = isError ? "#ff4d00" : "#e8ff00";
  t.style.color = isError ? "#fff" : "#000";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
initCustomSelect();
