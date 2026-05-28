// ── FIREBASE IMPORTS (loaded via index.html as modules) ──────────────────
// auth, db, and firebase functions are attached to window by index.html

// ── STATE ────────────────────────────────────────────────────────────────
let currentUser     = null;
let gameData        = null;
let pendingLevelUps = [];
let pendingLore     = [];

// Holds the last custom quest input so retry doesn't lose data
let lastCustomQuest = { name: "", freq: "one-off", freqDays: 0 };

// ── DEFAULT QUESTS PRE-LOADED FOR NEW USERS ───────────────────────────────
const DEFAULT_STARTER_IDS = ["q1", "q4", "q7", "q9", "q12", "q3"];
// dishes, tidy halls, vacuum, toilet, bed linens, trash

// ── HELPERS ──────────────────────────────────────────────────────────────
function daysSince(ts) {
  return (Date.now() - ts) / 86400000;
}

function isDue(quest) {
  if (quest.freq === "one-off") return !quest.lastCompleted;
  if (!quest.lastCompleted)    return true;
  return daysSince(quest.lastCompleted) >= quest.freqDays;
}

function daysOverdue(quest) {
  if (quest.freq === "one-off") return null;
  if (!quest.lastCompleted)    return null;
  const over = daysSince(quest.lastCompleted) - quest.freqDays;
  return over > 0 ? Math.floor(over) : null;
}

function daysUntilDue(quest) {
  if (!quest.lastCompleted || quest.freq === "one-off") return null;
  const left = quest.freqDays - daysSince(quest.lastCompleted);
  return left > 0 ? Math.ceil(left) : null;
}

function getLevelFromXP(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_TABLE.length; i++) {
    if (xp >= LEVEL_TABLE[i]) level = i + 1;
    else break;
  }
  return Math.min(level, 50);
}

function getProgressInLevel(xp, level) {
  if (level >= 50) return 100;
  const start = LEVEL_TABLE[level - 1];
  const end   = LEVEL_TABLE[level];
  return Math.min(100, Math.round(((xp - start) / (end - start)) * 100));
}

function xpToNextLevel(xp, level) {
  if (level >= 50) return 0;
  return LEVEL_TABLE[level] - xp;
}

// ── FIREBASE DATA ─────────────────────────────────────────────────────────
async function loadGameData(uid) {
  const ref  = window.fbDoc(window.fbDb, "users", uid, "data", "gamestate");
  const snap = await window.fbGetDoc(ref);
  if (snap.exists()) {
    gameData = snap.data();
    gameData.quests   = gameData.quests   || [];
    gameData.history  = gameData.history  || [];
    gameData.loreRead = gameData.loreRead || [];
    gameData.xp       = gameData.xp       || 0;
    gameData.level    = gameData.level    || 1;
    return true;
  }
  return false;
}

async function saveGameData() {
  if (!currentUser || !gameData) return;
  const ref = window.fbDoc(window.fbDb, "users", currentUser.uid, "data", "gamestate");
  await window.fbSetDoc(ref, gameData);
}

// ── SCREEN ROUTING ────────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById("loading-screen").style.display = "none";
  document.getElementById("auth-screen").style.display    = name === "auth" ? "flex"  : "none";
  document.getElementById("char-screen").style.display    = name === "char" ? "block" : "none";
  const app = document.getElementById("app");
  if (name === "app") app.classList.add("visible");
  else                app.classList.remove("visible");
}

// ── AUTH ──────────────────────────────────────────────────────────────────
window.switchAuthTab = function(tab) {
  document.getElementById("login-form").style.display    = tab === "login"    ? "block" : "none";
  document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
  document.querySelectorAll(".auth-tab").forEach((btn, i) => {
    btn.classList.toggle("active", (tab === "login" && i === 0) || (tab === "register" && i === 1));
  });
  document.getElementById("auth-error").textContent = "";
};

window.doLogin = async function() {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl    = document.getElementById("auth-error");
  errEl.textContent = "";
  try {
    await window.fbSignIn(window.fbAuth, email, password);
  } catch(e) {
    errEl.textContent = "Invalid email or password.";
  }
};

window.doRegister = async function() {
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl    = document.getElementById("auth-error");
  errEl.textContent = "";
  try {
    await window.fbCreateUser(window.fbAuth, email, password);
  } catch(e) {
    if (e.code === "auth/email-already-in-use") errEl.textContent = "Email already registered. Please sign in.";
    else if (e.code === "auth/weak-password")   errEl.textContent = "Password must be at least 6 characters.";
    else                                         errEl.textContent = "Registration failed. Please try again.";
  }
};

window.doSignOut = async function() {
  await window.fbSignOut(window.fbAuth);
};

// ── CHARACTER SELECT ──────────────────────────────────────────────────────
function renderCharSelect() {
  const grid = document.getElementById("char-grid");
  grid.innerHTML = "";
  Object.entries(CHARACTERS).forEach(([id, c]) => {
    const div = document.createElement("div");
    div.className      = "char-card";
    div.dataset.charId = id;
    div.innerHTML = `
      <div class="char-sprite">${c.emoji}</div>
      <h3>${c.name}</h3>
      <div class="char-epithet">${c.epithet}</div>
      <div class="char-bio">${c.bio}</div>
    `;
    div.addEventListener("click", () => {
      document.querySelectorAll(".char-card").forEach(c => c.classList.remove("selected"));
      div.classList.add("selected");
      const btn    = document.getElementById("char-confirm-btn");
      btn.disabled = false;
      btn.dataset.charId = id;
    });
    grid.appendChild(div);
  });
}

window.confirmCharacter = async function() {
  const btn    = document.getElementById("char-confirm-btn");
  const charId = btn.dataset.charId;
  if (!charId) return;
  btn.disabled    = true;
  btn.textContent = "Beginning your journey...";

  // Pre-load starter quests
  const starterQuests = DEFAULT_STARTER_IDS
    .map(id => DEFAULT_QUESTS.find(q => q.id === id))
    .filter(Boolean)
    .map(q => ({ ...q, lastCompleted: null }));

  gameData = {
    character: charId,
    xp:        0,
    level:     1,
    quests:    starterQuests,
    history:   [],
    loreRead:  [],
    createdAt: Date.now()
  };
  await saveGameData();
  initApp();
};

// ── APP INIT ──────────────────────────────────────────────────────────────
function initApp() {
  showScreen("app");
  updateHeader();
  renderQuestBoard();
  renderSuggestedQuests();
  renderKeep();
  renderLore();
  renderHistory();
  checkLoreUnlocks();
}

// ── HEADER ────────────────────────────────────────────────────────────────
function updateHeader() {
  if (!gameData) return;
  const char  = CHARACTERS[gameData.character];
  const level = gameData.level;
  const title = getTitleForLevel(gameData.character, level);

  document.getElementById("header-avatar").textContent = char.emoji;
  document.getElementById("header-name").textContent   = char.name;
  document.getElementById("header-title").textContent  = `Lv.${level} · ${title}`;
  document.getElementById("header-xp").textContent     = gameData.xp.toLocaleString() + " XP";
  document.getElementById("header-level").textContent  = level;

  const pct = getProgressInLevel(gameData.xp, level);
  document.getElementById("header-xp-bar").style.width = pct + "%";

  const toNext = xpToNextLevel(gameData.xp, level);
  document.getElementById("header-xp-next").textContent =
    level < 50 ? toNext.toLocaleString() + " to lv." + (level + 1) : "Max Level!";

  const progLabel = document.getElementById("prog-label");
  const progFill  = document.getElementById("prog-fill");
  const progCount = document.getElementById("prog-count");
  if (progLabel && progFill && progCount) {
    if (level < 50) {
      const start = LEVEL_TABLE[level - 1];
      const end   = LEVEL_TABLE[level];
      progLabel.textContent = `Level ${level} → ${level + 1}`;
      progFill.style.width  = pct + "%";
      progCount.textContent = `${(gameData.xp - start).toLocaleString()} / ${(end - start).toLocaleString()} XP`;
    } else {
      progLabel.textContent = "Max Level Reached";
      progFill.style.width  = "100%";
      progCount.textContent = gameData.xp.toLocaleString() + " total XP";
    }
  }
}

// ── NAVIGATION ────────────────────────────────────────────────────────────
const TAB_ORDER = ["quests", "add", "keep", "lore", "history"];

window.switchTab = function(tab) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  const panel = document.getElementById("tab-" + tab);
  if (panel) panel.classList.add("active");
  const idx  = TAB_ORDER.indexOf(tab);
  const btns = document.querySelectorAll(".nav-btn");
  if (btns[idx]) btns[idx].classList.add("active");
};

// ── QUEST BOARD ───────────────────────────────────────────────────────────
function renderQuestBoard() {
  const board = document.getElementById("quest-board");
  if (!board || !gameData) return;

  const quests = gameData.quests;

  // Hint bar — always shown
  const hintBar = `<div class="quest-hint-bar">
    You can add more quests — and create custom ones — in the
    <button class="hint-link" onclick="switchTab('add')">Add Quest</button> tab.
  </div>`;

  if (quests.length === 0) {
    board.innerHTML = hintBar + `<div class="empty-state">No quests yet. Head to Add Quest to begin.</div>`;
    return;
  }

  const overdue  = quests.filter(q => daysOverdue(q) !== null);
  const dueNow   = quests.filter(q => isDue(q) && daysOverdue(q) === null);
  const oneOff   = quests.filter(q => q.freq === "one-off" && !q.lastCompleted);
  const upcoming = quests.filter(q => !isDue(q) && daysOverdue(q) === null && q.freq !== "one-off");

  let html = hintBar;

  const card = (q, isOverdue) => {
    const over       = daysOverdue(q);
    const until      = daysUntilDue(q);
    const freqLbl    = FREQ_LABELS[q.freq] || q.freq;
    const overdueStr = over  ? `<span class="overdue-label">⚠ ${over}d overdue</span>` : "";
    const untilStr   = (!isOverdue && until) ? `<span class="due-soon-label">in ${until}d</span>` : "";
    return `
      <div class="quest-card${isOverdue ? " overdue" : ""}" data-quest-id="${q.id}">
        <div class="quest-emoji">${q.emoji || "⚔️"}</div>
        <div class="quest-info">
          <div class="quest-fantasy-name">${q.fantasy}</div>
          <div class="quest-real-name">${q.real}</div>
          <div class="quest-meta">
            <span class="freq-tag">${freqLbl}</span>
            ${overdueStr}${untilStr}
          </div>
        </div>
        <div class="quest-xp">+${q.xp} XP</div>
        <button class="quest-done-btn" data-quest-id="${q.id}">Done ✓</button>
        <div class="quest-menu-wrap">
          <button class="quest-menu-btn" data-quest-id="${q.id}" title="Options">⋯</button>
          <div class="quest-menu-dropdown" id="menu-${q.id}">
            <button class="quest-menu-item delete" data-quest-id="${q.id}">🗑 Remove quest</button>
          </div>
        </div>
      </div>`;
  };

  if (overdue.length)  html += `<div class="section-heading">⚠ Overdue Quests</div>`  + overdue.map(q => card(q, true)).join("");
  if (dueNow.length)   html += `<div class="section-heading">📋 Due Now</div>`         + dueNow.map(q => card(q, false)).join("");
  if (oneOff.length)   html += `<div class="section-heading">✨ One-Off Quests</div>`  + oneOff.map(q => card(q, false)).join("");
  if (upcoming.length) html += `<div class="section-heading">🕰 Upcoming</div>`        + upcoming.map(q => card(q, false)).join("");

  board.innerHTML = html;

  // Done buttons
  board.querySelectorAll(".quest-done-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      completeQuest(btn.dataset.questId, e);
    });
  });

  // Three-dot menu toggle
  board.querySelectorAll(".quest-menu-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id       = btn.dataset.questId;
      const dropdown = document.getElementById("menu-" + id);
      // Close all other open menus
      board.querySelectorAll(".quest-menu-dropdown.open").forEach(d => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    });
  });

  // Delete buttons
  board.querySelectorAll(".quest-menu-item.delete").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteQuest(btn.dataset.questId);
    });
  });

  // Close menus when clicking elsewhere
  document.addEventListener("click", closeAllMenus, { once: true });
}

function closeAllMenus() {
  document.querySelectorAll(".quest-menu-dropdown.open").forEach(d => d.classList.remove("open"));
}

// ── DELETE QUEST ──────────────────────────────────────────────────────────
async function deleteQuest(questId) {
  gameData.quests = gameData.quests.filter(q => q.id !== questId);
  await saveGameData();
  renderQuestBoard();
  renderSuggestedQuests();
}

// ── COMPLETE QUEST ────────────────────────────────────────────────────────
async function completeQuest(questId, event) {
  const quest = gameData.quests.find(q => q.id === questId);
  if (!quest) return;

  const btn = event.currentTarget;
  btn.disabled    = true;
  btn.textContent = "✓";

  const oldLevel      = gameData.level;
  quest.lastCompleted = Date.now();
  gameData.xp        += quest.xp;
  gameData.level      = getLevelFromXP(gameData.xp);

  gameData.history.unshift({
    questId:     quest.id,
    name:        quest.fantasy,
    real:        quest.real,
    emoji:       quest.emoji || "⚔️",
    xp:          quest.xp,
    completedAt: Date.now()
  });
  if (gameData.history.length > 200) gameData.history = gameData.history.slice(0, 200);

  for (let lv = oldLevel + 1; lv <= gameData.level; lv++) {
    pendingLevelUps.push(lv);
  }

  await saveGameData();
  spawnXPPop(event, quest.xp);
  updateHeader();
  renderQuestBoard();
  renderHistory();
  renderKeep();
  checkLoreUnlocks();

  if (pendingLevelUps.length > 0) showNextLevelUp();
}

function spawnXPPop(event, xp) {
  const pop = document.createElement("div");
  pop.className   = "xp-pop";
  pop.textContent = `+${xp} XP`;
  pop.style.left  = (event.clientX - 24) + "px";
  pop.style.top   = (event.clientY - 12) + "px";
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1600);
}

// ── LEVEL-UP OVERLAY ──────────────────────────────────────────────────────
function showNextLevelUp() {
  if (pendingLevelUps.length === 0) { showNextLore(); return; }
  const newLevel = pendingLevelUps.shift();
  const char     = CHARACTERS[gameData.character];
  const title    = getTitleForLevel(gameData.character, newLevel);
  const unlock   = LEVEL_UNLOCKS[newLevel] || null;

  document.getElementById("levelup-icon").textContent    = "🎉";
  document.getElementById("levelup-heading").textContent = "Level Up!";
  document.getElementById("levelup-title").textContent   = `${char.name} · ${title}`;
  document.getElementById("levelup-body").textContent    =
    unlock || `You have reached Level ${newLevel}. The keep grows stronger.`;

  document.getElementById("levelup-overlay").style.display = "flex";
}

window.closeLevelUp = function() {
  document.getElementById("levelup-overlay").style.display = "none";
  if (pendingLevelUps.length > 0) setTimeout(showNextLevelUp, 300);
  else showNextLore();
};

// ── LORE ──────────────────────────────────────────────────────────────────
function checkLoreUnlocks() {
  if (!gameData) return;
  const snippets = LORE[gameData.character] || [];
  snippets.forEach(s => {
    if (gameData.level >= s.level && !gameData.loreRead.includes(s.level)) {
      if (!pendingLore.find(p => p.level === s.level)) pendingLore.push(s);
    }
  });
  const bell = document.getElementById("lore-bell");
  if (pendingLore.length > 0) bell.classList.add("visible");
  else                         bell.classList.remove("visible");
}

function showNextLore() {
  if (pendingLore.length === 0) return;
  const s = pendingLore[0];
  document.getElementById("lore-overlay-title").textContent    = s.title;
  document.getElementById("lore-overlay-subtitle").textContent = `Chapter unlocked at Level ${s.level}`;
  document.getElementById("lore-overlay-body").textContent     = s.text;
  document.getElementById("lore-overlay").style.display        = "flex";
}

window.openLoreBell = function() {
  if (pendingLore.length > 0) showNextLore();
  else switchTab("lore");
};

window.closeLoreOverlay = async function() {
  if (pendingLore.length > 0) {
    const s = pendingLore.shift();
    if (!gameData.loreRead.includes(s.level)) {
      gameData.loreRead.push(s.level);
      await saveGameData();
    }
  }
  document.getElementById("lore-overlay").style.display = "none";
  const bell = document.getElementById("lore-bell");
  if (pendingLore.length > 0) {
    bell.classList.add("visible");
    setTimeout(showNextLore, 350);
  } else {
    bell.classList.remove("visible");
  }
  renderLore();
};

function renderLore() {
  const list = document.getElementById("lore-list");
  if (!list || !gameData) return;
  const snippets = LORE[gameData.character] || [];
  let html = "";
  snippets.forEach(s => {
    if (gameData.level >= s.level) {
      html += `
        <div class="lore-scroll">
          <h3>${s.title}</h3>
          <div class="lore-unlock-label">Unlocked at Level ${s.level}</div>
          <p>${s.text}</p>
        </div>`;
    } else {
      html += `
        <div class="lore-locked">
          <p>🔒 Unlocks at <span class="lock-level">Level ${s.level}</span></p>
        </div>`;
    }
  });
  list.innerHTML = html || `<div class="empty-state">Your story awaits.</div>`;
}

// ── KEEP ──────────────────────────────────────────────────────────────────
function renderKeep() {
  const grid = document.getElementById("keep-grid");
  if (!grid || !gameData) return;
  let html = "";
  KEEP_ROOMS.forEach(room => {
    const locked = gameData.level < room.unlockLevel;
    html += `
      <div class="keep-room${locked ? " locked" : ""}">
        <div class="keep-room-icon">${room.emoji}</div>
        <h3>${room.name}</h3>
        <p>${room.desc}</p>
        ${locked ? `<div class="keep-lock-label">🔒 Unlocks at Level ${room.unlockLevel}</div>` : ""}
      </div>`;
  });
  grid.innerHTML = html;
}

// ── HISTORY ───────────────────────────────────────────────────────────────
function renderHistory() {
  const list = document.getElementById("history-list");
  if (!list || !gameData) return;
  if (!gameData.history || gameData.history.length === 0) {
    list.innerHTML = `<div class="empty-state">No quests completed yet.<br>The chronicle awaits your deeds.</div>`;
    return;
  }
  let html = "";
  gameData.history.slice(0, 150).forEach(h => {
    const date = new Date(h.completedAt).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric"
    });
    html += `
      <div class="history-item">
        <div class="history-emoji">${h.emoji}</div>
        <div class="history-info">
          <div class="history-name">${h.name}</div>
          <div class="history-real">${h.real}</div>
          <div class="history-date">${date}</div>
        </div>
        <div class="history-xp">+${h.xp} XP</div>
      </div>`;
  });
  list.innerHTML = html;
}

// ── SUGGESTED QUESTS ──────────────────────────────────────────────────────
function renderSuggestedQuests() {
  const list = document.getElementById("suggested-quests-list");
  if (!list || !gameData) return;

  const groups = {
    "Daily":          DEFAULT_QUESTS.filter(q => q.freq === "daily"),
    "Twice a Week":   DEFAULT_QUESTS.filter(q => q.freq === "twice-weekly"),
    "Weekly":         DEFAULT_QUESTS.filter(q => q.freq === "weekly"),
    "Every 2 Weeks":  DEFAULT_QUESTS.filter(q => q.freq === "fortnightly"),
    "Monthly":        DEFAULT_QUESTS.filter(q => q.freq === "monthly"),
    "Every 3 Months": DEFAULT_QUESTS.filter(q => q.freq === "quarterly"),
    "Every 6 Months": DEFAULT_QUESTS.filter(q => q.freq === "biannual"),
    "Yearly":         DEFAULT_QUESTS.filter(q => q.freq === "yearly"),
  };

  let html = "";
  Object.entries(groups).forEach(([label, quests]) => {
    if (quests.length === 0) return;
    html += `<div class="suggested-group-title">${label}</div>`;
    quests.forEach(q => {
      const added = gameData.quests.some(gq => gq.id === q.id);
      html += `
        <div class="suggested-item">
          <span class="s-emoji">${q.emoji}</span>
          <div class="s-info">
            <div class="s-name">${q.fantasy}</div>
            <div class="s-real">${q.real}</div>
          </div>
          <span class="s-xp">+${q.xp} XP</span>
          <button class="add-sug-btn" data-quest-id="${q.id}" ${added ? "disabled" : ""}>
            ${added ? "Added ✓" : "+ Add"}
          </button>
        </div>`;
    });
  });

  list.innerHTML = html;
  list.querySelectorAll(".add-sug-btn:not(:disabled)").forEach(btn => {
    btn.addEventListener("click", () => addSuggestedQuest(btn.dataset.questId));
  });
}

async function addSuggestedQuest(questId) {
  const template = DEFAULT_QUESTS.find(q => q.id === questId);
  if (!template || gameData.quests.some(q => q.id === questId)) return;
  gameData.quests.push({ ...template, lastCompleted: null });
  await saveGameData();
  renderSuggestedQuests();
  renderQuestBoard();
}

// ── CUSTOM QUEST (AI-SCORED) ──────────────────────────────────────────────
// Frequency options for custom quests
const CUSTOM_FREQ_OPTIONS = [
  { value: "one-off",      label: "One-off",         days: 0   },
  { value: "daily",        label: "Daily",            days: 1   },
  { value: "twice-weekly", label: "Twice a week",     days: 3   },
  { value: "weekly",       label: "Weekly",           days: 7   },
  { value: "fortnightly",  label: "Every 2 weeks",    days: 14  },
  { value: "monthly",      label: "Monthly",          days: 30  },
  { value: "quarterly",    label: "Every 3 months",   days: 90  },
  { value: "biannual",     label: "Every 6 months",   days: 180 },
  { value: "yearly",       label: "Yearly",           days: 365 },
];

async function callGrokOracle(questName) {
  const response = await fetch("https://hearthkeeper-ai.tom-offrede.workers.dev/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "grok-4-0709",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `You are an XP oracle for a fantasy house-cleaning gamification app. A player has submitted a cleaning task. Based on the effort, time, and difficulty involved, assign an XP value between 20 and 500.

Rules:
- Very quick tasks under 5 minutes: 20–50 XP
- Quick tasks 5–15 minutes: 50–100 XP
- Medium tasks 15–45 minutes: 100–200 XP
- Long tasks 45–90 minutes: 200–320 XP
- Major undertakings over 90 minutes: 320–500 XP
- Deeply unpleasant tasks get a small bonus

Task: "${questName}"

Respond with ONLY a valid JSON object. No preamble, no markdown, no explanation outside the JSON.
Format: {"xp": 150, "reason": "one short sentence explaining the award"}`
      }]
    })
  });
  const data  = await response.json();
  const raw   = data.choices?.[0]?.message?.content || "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function showCustomResult(msg, isError, showRetry) {
  const resEl = document.getElementById("custom-result");
  resEl.className = "custom-result" + (isError ? " error" : "");
  resEl.innerHTML = msg;
  if (showRetry) {
    const retryBtn = document.createElement("button");
    retryBtn.className   = "retry-btn";
    retryBtn.textContent = "Try again";
    retryBtn.onclick     = () => submitCustomQuestInner(lastCustomQuest.name, lastCustomQuest.freq, lastCustomQuest.freqDays);
    resEl.appendChild(retryBtn);
  }
}

async function submitCustomQuestInner(name, freq, freqDays) {
  const btn = document.getElementById("custom-submit-btn");
  btn.disabled    = true;
  btn.textContent = "Consulting the oracle...";
  showCustomResult("", false, false);

  try {
    const parsed = await callGrokOracle(name);
    const xp = Math.max(20, Math.min(500, Math.round(Number(parsed.xp))));

    const newQuest = {
      id:            "custom_" + Date.now(),
      emoji:         "✨",
      fantasy:       name,
      real:          name,
      xp:            xp,
      freq:          freq,
      freqDays:      freqDays,
      lastCompleted: null
    };

    gameData.quests.push(newQuest);
    await saveGameData();
    renderQuestBoard();
    renderSuggestedQuests();

    showCustomResult(`✓ Quest added for ${xp} XP — ${parsed.reason}`, false, false);
    document.getElementById("custom-name").value  = "";
    document.getElementById("custom-freq").value  = "one-off";

  } catch(e) {
    showCustomResult("The oracle couldn't be reached. Please try again.", true, true);
  }

  btn.disabled    = false;
  btn.textContent = "Add Quest ✨";
}

window.submitCustomQuest = async function() {
  const nameEl = document.getElementById("custom-name");
  const freqEl = document.getElementById("custom-freq");
  const name   = nameEl.value.trim();
  const freq   = freqEl.value;
  const option = CUSTOM_FREQ_OPTIONS.find(o => o.value === freq) || CUSTOM_FREQ_OPTIONS[0];

  if (!name) {
    showCustomResult("Please describe the task first.", true, false);
    return;
  }

  // Store for potential retry
  lastCustomQuest = { name, freq, freqDays: option.days };
  await submitCustomQuestInner(name, freq, option.days);
};

// ── XP TOOLTIP ────────────────────────────────────────────────────────────
window.toggleXPTooltip = function(e) {
  e.stopPropagation();
  const tip = document.getElementById("xp-tooltip");
  tip.classList.toggle("visible");
  document.addEventListener("click", () => tip.classList.remove("visible"), { once: true });
};

// ── BOOTSTRAP ─────────────────────────────────────────────────────────────
window.onAuthReady = function(user) {
  currentUser = user;
  if (!user) {
    showScreen("auth");
    return;
  }
  loadGameData(user.uid).then(exists => {
    if (exists) initApp();
    else { renderCharSelect(); showScreen("char"); }
  });
};
