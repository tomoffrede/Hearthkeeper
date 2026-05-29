// ── USERNAME HELPERS ──────────────────────────────────────────────────────
const EMAIL_DOMAIN = "@hearthkeeper.app";
function toEmail(u) {
  const trimmed = u.trim();
  return trimmed.includes("@") ? trimmed.toLowerCase() : trimmed.toLowerCase() + EMAIL_DOMAIN;
}
function fromEmail(e)  { return e ? e.replace(EMAIL_DOMAIN, "") : ""; }

// ── IMAGE HELPERS ─────────────────────────────────────────────────────────
// Returns an <img> tag, falling back to emoji text if image fails
function charImg(charId, size) {
  const c = CHARACTERS[charId];
  return `<img src="images/char-${charId}.png" alt="${c.name}"
    style="width:${size}px;height:${size}px;object-fit:cover;border-radius:${size>40?'50%':'8px'};image-rendering:pixelated;"
    onerror="this.parentElement.innerHTML='${c.emoji}'">`;
}

function keepImg(roomId, emoji) {
  return `<img src="images/keep-${roomId.replace('_','-')}.png" alt=""
    style="width:48px;height:48px;object-fit:contain;image-rendering:pixelated;"
    onerror="this.parentElement.innerHTML='${emoji}'">`;
}

function questImg(imgKey, fallback) {
  return `<img src="images/quest-${imgKey}.png" alt=""
    style="width:28px;height:28px;object-fit:contain;image-rendering:pixelated;vertical-align:middle;"
    onerror="this.parentElement.innerHTML='${fallback}'">`;
}

// Map quest ids to image keys
const QUEST_IMG_MAP = {
  q1:"dishes",  q2:"sink",    q3:"trash",   q4:"floors",
  q5:"floors",  q6:"oven",    q7:"floors",  q8:"floors",
  q9:"toilet",  q10:"sink",   q11:"oven",   q12:"laundry",
  q13:"oven",   q14:"trash",  q15:"shower", q16:"dusting",
  q17:"shower", q18:"fridge", q19:"sink",   q20:"shower",
  q21:"shower", q22:"laundry",q23:"dusting",q24:"floors",
  q25:"dishes", q26:"floors", q27:"sink",   q28:"oven",
  q29:"laundry",q30:"laundry",q31:"windows",q32:"trash",
  q33:"floors", q34:"windows",q35:"fridge", q36:"laundry",
  q37:"declutter",q38:"oven", q39:"declutter",q40:"dusting",
  q41:"laundry",q42:"dusting"
};

function questIcon(quest) {
  const key = QUEST_IMG_MAP[quest.id];
  if (key) return questImg(key, quest.emoji || "⚔️");
  if (quest.emoji) return quest.emoji; // custom quests keep emoji
  return "⚔️";
}

// ── STATE ─────────────────────────────────────────────────────────────────
let currentUser     = null;
let gameData        = null;
let pendingLevelUps = [];
let pendingLore     = [];
let lastCustomQuest = { name: "", freq: "one-off", freqDays: 0 };

const DEFAULT_STARTER_IDS = ["q1","q4","q7","q9","q12","q3"];

// ── HELPERS ───────────────────────────────────────────────────────────────
function daysSince(ts)  { return (Date.now() - ts) / 86400000; }

function isDue(q) {
  if (q.freq === "one-off") return !q.lastCompleted;
  if (!q.lastCompleted)    return true;
  return daysSince(q.lastCompleted) >= q.freqDays;
}

function daysOverdue(q) {
  if (q.freq === "one-off" || !q.lastCompleted) return null;
  const over = daysSince(q.lastCompleted) - q.freqDays;
  return over > 0 ? Math.floor(over) : null;
}

function daysUntilDue(q) {
  if (!q.lastCompleted || q.freq === "one-off") return null;
  const left = q.freqDays - daysSince(q.lastCompleted);
  return left > 0 ? Math.ceil(left) : null;
}

function getLevelFromXP(xp) {
  let lv = 1;
  for (let i = 1; i < LEVEL_TABLE.length; i++) {
    if (xp >= LEVEL_TABLE[i]) lv = i + 1; else break;
  }
  return Math.min(lv, 50);
}

function getProgress(xp, lv) {
  if (lv >= 50) return 100;
  const s = LEVEL_TABLE[lv-1], e = LEVEL_TABLE[lv];
  return Math.min(100, Math.round(((xp-s)/(e-s))*100));
}

function xpToNext(xp, lv) {
  return lv >= 50 ? 0 : LEVEL_TABLE[lv] - xp;
}

// ── FIREBASE DATA ─────────────────────────────────────────────────────────
async function loadGameData(uid) {
  const ref  = window.fbDoc(window.fbDb,"users",uid,"data","gamestate");
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
  await window.fbSetDoc(window.fbDoc(window.fbDb,"users",currentUser.uid,"data","gamestate"), gameData);
}

// ── SCREEN ROUTING ────────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById("loading-screen").style.display = "none";
  document.getElementById("auth-screen").style.display    = name==="auth" ? "flex"  : "none";
  document.getElementById("char-screen").style.display    = name==="char" ? "block" : "none";
  const app = document.getElementById("app");
  if (name==="app") app.classList.add("visible"); else app.classList.remove("visible");
}

// ── AUTH ──────────────────────────────────────────────────────────────────
window.switchAuthTab = function(tab) {
  document.getElementById("login-form").style.display    = tab==="login"    ? "block":"none";
  document.getElementById("register-form").style.display = tab==="register" ? "block":"none";
  document.querySelectorAll(".auth-tab").forEach((b,i) =>
    b.classList.toggle("active",(tab==="login"&&i===0)||(tab==="register"&&i===1)));
  document.getElementById("auth-error").textContent = "";
};

window.doLogin = async function() {
  const u = document.getElementById("login-username").value.trim();
  const p = document.getElementById("login-password").value;
  const e = document.getElementById("auth-error");
  e.textContent = "";
  if (!u) { e.textContent = "Please enter a username."; return; }
  try { await window.fbSignIn(window.fbAuth, toEmail(u), p); }
  catch(_) { e.textContent = "Incorrect username or password."; }
};

window.doRegister = async function() {
  const u = document.getElementById("reg-username").value.trim();
  const p = document.getElementById("reg-password").value;
  const e = document.getElementById("auth-error");
  e.textContent = "";
  if (!u) { e.textContent = "Please enter a username or email."; return; }
  const isEmail = u.includes("@");
  if (!isEmail) {
    if (u.length < 3) { e.textContent = "Username must be at least 3 characters."; return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(u)) { e.textContent = "Username: letters, numbers, _ and - only."; return; }
  }
  try { await window.fbCreateUser(window.fbAuth, toEmail(u), p); }
  catch(err) {
    if (err.code==="auth/email-already-in-use") e.textContent = "Username or email already registered.";
    else if (err.code==="auth/weak-password")   e.textContent = "Password must be at least 6 characters.";
    else if (err.code==="auth/invalid-email")   e.textContent = "That doesn't look like a valid email address.";
    else                                         e.textContent = "Registration failed. Please try again.";
  }
};

window.doSignOut = async function() { await window.fbSignOut(window.fbAuth); };

// ── DELETE ACCOUNT ────────────────────────────────────────────────────────
window.showDeleteConfirm = function() {
  document.getElementById("delete-confirm").style.display = "block";
  document.getElementById("delete-error").textContent = "";
  document.getElementById("delete-password").value = "";
};
window.hideDeleteConfirm = function() {
  document.getElementById("delete-confirm").style.display = "none";
};
window.doDeleteAccount = async function() {
  const pw  = document.getElementById("delete-password").value;
  const err = document.getElementById("delete-error");
  err.textContent = "";
  if (!pw) { err.textContent = "Please enter your password."; return; }
  try {
    const cred = window.fbEmailProvider.credential(currentUser.email, pw);
    await window.fbReauth(currentUser, cred);
    await window.fbDeleteDoc(window.fbDoc(window.fbDb,"users",currentUser.uid,"data","gamestate"));
    await window.fbDeleteUser(currentUser);
  } catch(e) {
    err.textContent = (e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")
      ? "Incorrect password." : "Deletion failed. Please try again.";
  }
};

// ── MODALS ────────────────────────────────────────────────────────────────
window.openModal  = id => { document.getElementById(id).style.display = "flex"; };
window.closeModal = id => { document.getElementById(id).style.display = "none"; };

// ── CHARACTER SELECT ──────────────────────────────────────────────────────
function renderCharSelect() {
  const grid = document.getElementById("char-grid");
  grid.innerHTML = "";
  Object.entries(CHARACTERS).forEach(([id,c]) => {
    const div = document.createElement("div");
    div.className = "char-card";
    div.dataset.charId = id;
    div.innerHTML = `
      <div class="char-sprite">${charImg(id,72)}</div>
      <h3>${c.name}</h3>
      <div class="char-epithet">${c.epithet}</div>
      <div class="char-bio">${c.bio}</div>`;
    div.addEventListener("click", () => {
      document.querySelectorAll(".char-card").forEach(c=>c.classList.remove("selected"));
      div.classList.add("selected");
      const btn = document.getElementById("char-confirm-btn");
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
  btn.disabled = true; btn.textContent = "Beginning your journey...";
  const starterQuests = DEFAULT_STARTER_IDS
    .map(id => DEFAULT_QUESTS.find(q=>q.id===id)).filter(Boolean)
    .map(q => ({...q, lastCompleted:null}));
  gameData = { character:charId, xp:0, level:1, quests:starterQuests, history:[], loreRead:[], createdAt:Date.now() };
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
  renderSettings();
  checkLoreUnlocks();
}

// ── HEADER ────────────────────────────────────────────────────────────────
function updateHeader() {
  if (!gameData) return;
  const lv    = gameData.level;
  const title = getTitleForLevel(gameData.character, lv);
  document.getElementById("header-avatar").innerHTML = charImg(gameData.character, 38);
  document.getElementById("header-name").textContent  = CHARACTERS[gameData.character].name;
  document.getElementById("header-title").textContent = `Lv.${lv} · ${title}`;
  document.getElementById("header-xp").textContent    = gameData.xp.toLocaleString() + " XP";
  document.getElementById("header-level").textContent = lv;
  const pct = getProgress(gameData.xp, lv);
  document.getElementById("header-xp-bar").style.width = pct + "%";
  document.getElementById("header-xp-next").textContent =
    lv < 50 ? xpToNext(gameData.xp,lv).toLocaleString()+" to lv."+(lv+1) : "Max Level!";
  const pl = document.getElementById("prog-label");
  const pf = document.getElementById("prog-fill");
  const pc = document.getElementById("prog-count");
  if (pl&&pf&&pc) {
    if (lv < 50) {
      const s=LEVEL_TABLE[lv-1], e=LEVEL_TABLE[lv];
      pl.textContent = `Level ${lv} → ${lv+1}`;
      pf.style.width = pct+"%";
      pc.textContent = `${(gameData.xp-s).toLocaleString()} / ${(e-s).toLocaleString()} XP`;
    } else {
      pl.textContent = "Max Level Reached"; pf.style.width="100%";
      pc.textContent = gameData.xp.toLocaleString()+" total XP";
    }
  }
}

// ── SETTINGS ──────────────────────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById("settings-username");
  if (el && currentUser) el.textContent = fromEmail(currentUser.email);
}

// ── NAVIGATION ────────────────────────────────────────────────────────────
const TABS = ["quests","add","keep","lore","history","settings"];
window.switchTab = function(tab) {
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("tab-"+tab)?.classList.add("active");
  const btn = document.querySelectorAll(".nav-btn")[TABS.indexOf(tab)];
  if (btn) btn.classList.add("active");
};

// ── QUEST BOARD ───────────────────────────────────────────────────────────
function renderQuestBoard() {
  const board = document.getElementById("quest-board");
  if (!board||!gameData) return;
  const hintDismissed = localStorage.getItem("hintDismissed");
  const hint = hintDismissed ? "" : `<div class="quest-hint-bar">You can add and manage quests in the <button class="hint-link" onclick="switchTab('add')">Manage Quests</button> tab.<button class="hint-close" onclick="dismissHint()" title="Close">✕</button></div>`;
  if (!gameData.quests.length) { board.innerHTML = hint+`<div class="empty-state">No quests yet.</div>`; return; }

  const overdue  = gameData.quests.filter(q=>daysOverdue(q)!==null);
  const dueNow   = gameData.quests.filter(q=>isDue(q)&&daysOverdue(q)===null);
  const oneOff   = gameData.quests.filter(q=>q.freq==="one-off"&&!q.lastCompleted);
  const upcoming = gameData.quests.filter(q=>!isDue(q)&&daysOverdue(q)===null&&q.freq!=="one-off");

  const card = (q,ov) => {
    const over=daysOverdue(q), until=daysUntilDue(q);
    return `<div class="quest-card${ov?" overdue":""}">
      <div class="quest-emoji">${questIcon(q)}</div>
      <div class="quest-info">
        <div class="quest-fantasy-name">${q.fantasy}</div>
        <div class="quest-real-name">${q.real}</div>
        <div class="quest-meta">
          <span class="freq-tag">${FREQ_LABELS[q.freq]||q.freq}</span>
          ${over?`<span class="overdue-label">⚠ ${over}d overdue</span>`:""}
          ${(!ov&&until)?`<span class="due-soon-label">in ${until}d</span>`:""}
        </div>
      </div>
      <div class="quest-xp">+${q.xp} XP</div>
      <button class="quest-done-btn" data-id="${q.id}">Done ✓</button>
      <div class="quest-menu-wrap">
        <button class="quest-menu-btn" data-id="${q.id}">⋯</button>
        <div class="quest-menu-dropdown" id="menu-${q.id}">
          <button class="quest-menu-item" data-id="${q.id}" onclick="openFreqEditor('${q.id}')">🔁 Change frequency</button>
          <button class="quest-menu-item delete" data-id="${q.id}">🗑 Remove quest</button>
        </div>
      </div>
    </div>`;
  };

  let html = hint;
  if (overdue.length)  html += `<div class="section-heading">⚠ Overdue</div>`       + overdue.map(q=>card(q,true)).join("");
  if (dueNow.length)   html += `<div class="section-heading">📋 Due Now</div>`       + dueNow.map(q=>card(q,false)).join("");
  if (oneOff.length)   html += `<div class="section-heading">✨ One-Off</div>`       + oneOff.map(q=>card(q,false)).join("");
  if (upcoming.length) html += `<div class="section-heading">🕰 Upcoming</div>`      + upcoming.map(q=>card(q,false)).join("");
  board.innerHTML = html;

  board.querySelectorAll(".quest-done-btn").forEach(btn=>
    btn.addEventListener("click",e=>{e.stopPropagation();completeQuest(btn.dataset.id,e);}));
  board.querySelectorAll(".quest-menu-btn").forEach(btn=>
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      const dd=document.getElementById("menu-"+btn.dataset.id);
      board.querySelectorAll(".quest-menu-dropdown.open").forEach(d=>{if(d!==dd)d.classList.remove("open");});
      dd.classList.toggle("open");
    }));
  board.querySelectorAll(".quest-menu-item.delete").forEach(btn=>
    btn.addEventListener("click",e=>{e.stopPropagation();deleteQuest(btn.dataset.id);}));
  document.addEventListener("click",()=>
    document.querySelectorAll(".quest-menu-dropdown.open").forEach(d=>d.classList.remove("open")));
}

async function deleteQuest(id) {
  gameData.quests = gameData.quests.filter(q=>q.id!==id);
  await saveGameData();
  renderQuestBoard(); renderSuggestedQuests();
}

// ── COMPLETE QUEST ────────────────────────────────────────────────────────
async function completeQuest(questId, event) {
  const quest = gameData.quests.find(q=>q.id===questId);
  if (!quest) return;
  const btn = event.currentTarget;
  btn.disabled=true; btn.textContent="✓";
  const oldLv = gameData.level;
  quest.lastCompleted = Date.now();
  gameData.xp        += quest.xp;
  gameData.level      = getLevelFromXP(gameData.xp);
  gameData.history.unshift({questId:quest.id,name:quest.fantasy,real:quest.real,emoji:quest.emoji||"⚔️",xp:quest.xp,completedAt:Date.now()});
  if (gameData.history.length>200) gameData.history=gameData.history.slice(0,200);
  for (let lv=oldLv+1;lv<=gameData.level;lv++) pendingLevelUps.push(lv);
  await saveGameData();
  spawnXPPop(event,quest.xp);
  updateHeader(); renderQuestBoard(); renderHistory(); renderKeep(); checkLoreUnlocks();
  if (pendingLevelUps.length) showNextLevelUp();
}

function spawnXPPop(event,xp) {
  const pop=document.createElement("div");
  pop.className="xp-pop"; pop.textContent=`+${xp} XP`;
  pop.style.left=(event.clientX-24)+"px"; pop.style.top=(event.clientY-12)+"px";
  document.body.appendChild(pop); setTimeout(()=>pop.remove(),1600);
}

// ── LEVEL UP ──────────────────────────────────────────────────────────────
function showNextLevelUp() {
  if (!pendingLevelUps.length) { showNextLore(); return; }
  const lv=pendingLevelUps.shift();
  const char=CHARACTERS[gameData.character];
  document.getElementById("levelup-icon").textContent    = "🎉";
  document.getElementById("levelup-heading").textContent = "Level Up!";
  document.getElementById("levelup-title").textContent   = `${char.name} · ${getTitleForLevel(gameData.character,lv)}`;
  document.getElementById("levelup-body").textContent    = LEVEL_UNLOCKS[lv]||`You have reached Level ${lv}. The keep grows stronger.`;
  document.getElementById("levelup-overlay").style.display = "flex";
}

window.closeLevelUp = function() {
  document.getElementById("levelup-overlay").style.display="none";
  if (pendingLevelUps.length) setTimeout(showNextLevelUp,300); else showNextLore();
};

// ── LORE ──────────────────────────────────────────────────────────────────
function checkLoreUnlocks() {
  if (!gameData) return;
  (LORE[gameData.character]||[]).forEach(s=>{
    if (gameData.level>=s.level&&!gameData.loreRead.includes(s.level)&&!pendingLore.find(p=>p.level===s.level))
      pendingLore.push(s);
  });
  const bell=document.getElementById("lore-bell");
  if (pendingLore.length) bell.classList.add("visible"); else bell.classList.remove("visible");
}

function showNextLore() {
  if (!pendingLore.length) return;
  const s=pendingLore[0];
  document.getElementById("lore-overlay-title").textContent    = s.title;
  document.getElementById("lore-overlay-subtitle").textContent = `Chapter unlocked at Level ${s.level}`;
  document.getElementById("lore-overlay-body").textContent     = s.text;
  document.getElementById("lore-overlay").style.display        = "flex";
}

window.openLoreBell = function() { if (pendingLore.length) showNextLore(); else switchTab("lore"); };

window.closeLoreOverlay = async function() {
  if (pendingLore.length) {
    const s=pendingLore.shift();
    if (!gameData.loreRead.includes(s.level)) { gameData.loreRead.push(s.level); await saveGameData(); }
  }
  document.getElementById("lore-overlay").style.display="none";
  const bell=document.getElementById("lore-bell");
  if (pendingLore.length) { bell.classList.add("visible"); setTimeout(showNextLore,350); }
  else bell.classList.remove("visible");
  renderLore();
};

function renderLore() {
  const list=document.getElementById("lore-list");
  if (!list||!gameData) return;
  let html="";
  (LORE[gameData.character]||[]).forEach(s=>{
    if (gameData.level>=s.level) {
      const imgHtml = s.image
        ? `<img src="${s.image}" alt="" class="lore-img" onerror="this.style.display='none'">`
        : "";
      html+=`<div class="lore-scroll">${imgHtml}<h3>${s.title}</h3><div class="lore-unlock-label">Unlocked at Level ${s.level}</div><p>${s.text}</p></div>`;
    } else
      html+=`<div class="lore-locked"><p>🔒 Unlocks at <span class="lock-level">Level ${s.level}</span></p></div>`;
  });
  list.innerHTML = html||`<div class="empty-state">Your story awaits.</div>`;
}

// ── KEEP ──────────────────────────────────────────────────────────────────
function renderKeep() {
  const grid=document.getElementById("keep-grid");
  if (!grid||!gameData) return;
  grid.innerHTML = KEEP_ROOMS.map(room=>{
    const locked=gameData.level<room.unlockLevel;
    const icon=`<div class="keep-room-icon">${keepImg(room.id,room.emoji)}</div>`;
    return `<div class="keep-room${locked?" locked":""}">
      ${icon}<h3>${room.name}</h3><p>${room.desc}</p>
      ${locked?`<div class="keep-lock-label">🔒 Unlocks at Level ${room.unlockLevel}</div>`:""}
    </div>`;
  }).join("");
}

// ── HISTORY ───────────────────────────────────────────────────────────────
function renderHistory() {
  const list=document.getElementById("history-list");
  if (!list||!gameData) return;
  if (!gameData.history?.length) {
    list.innerHTML=`<div class="empty-state">No quests completed yet.</div>`; return;
  }
  list.innerHTML = gameData.history.slice(0,150).map(h=>{
    const date=new Date(h.completedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
    return `<div class="history-item">
      <div class="history-emoji">${h.emoji}</div>
      <div class="history-info">
        <div class="history-name">${h.name}</div>
        <div class="history-real">${h.real}</div>
        <div class="history-date">${date}</div>
      </div>
      <div class="history-xp">+${h.xp} XP</div>
    </div>`;
  }).join("");
}

// ── SUGGESTED QUESTS ──────────────────────────────────────────────────────
function renderSuggestedQuests() {
  const list=document.getElementById("suggested-quests-list");
  if (!list||!gameData) return;
  const groups={
    "Daily":DEFAULT_QUESTS.filter(q=>q.freq==="daily"),
    "Twice a Week":DEFAULT_QUESTS.filter(q=>q.freq==="twice-weekly"),
    "Weekly":DEFAULT_QUESTS.filter(q=>q.freq==="weekly"),
    "Every 2 Weeks":DEFAULT_QUESTS.filter(q=>q.freq==="fortnightly"),
    "Monthly":DEFAULT_QUESTS.filter(q=>q.freq==="monthly"),
    "Every 3 Months":DEFAULT_QUESTS.filter(q=>q.freq==="quarterly"),
    "Every 6 Months":DEFAULT_QUESTS.filter(q=>q.freq==="biannual"),
    "Yearly":DEFAULT_QUESTS.filter(q=>q.freq==="yearly"),
  };
  let html="";
  Object.entries(groups).forEach(([label,quests])=>{
    if (!quests.length) return;
    html+=`<div class="suggested-group-title">${label}</div>`;
    quests.forEach(q=>{
      const added=gameData.quests.some(gq=>gq.id===q.id);
      const imgKey=QUEST_IMG_MAP[q.id];
      const icon=imgKey?questImg(imgKey,q.emoji||"⚔️"):(q.emoji||"⚔️");
      html+=`<div class="suggested-item">
        <span class="s-emoji">${icon}</span>
        <div class="s-info"><div class="s-name">${q.fantasy}</div><div class="s-real">${q.real}</div></div>
        <span class="s-xp">+${q.xp} XP</span>
        <button class="add-sug-btn" data-id="${q.id}" ${added?"disabled":""}>${added?"Added ✓":"+ Add"}</button>
      </div>`;
    });
  });
  list.innerHTML=html;
  list.querySelectorAll(".add-sug-btn:not(:disabled)").forEach(btn=>
    btn.addEventListener("click",()=>addSuggestedQuest(btn.dataset.id)));
}

async function addSuggestedQuest(questId) {
  const t=DEFAULT_QUESTS.find(q=>q.id===questId);
  if (!t||gameData.quests.some(q=>q.id===questId)) return;
  gameData.quests.push({...t,lastCompleted:null});
  await saveGameData(); renderSuggestedQuests(); renderQuestBoard();
}

// ── CUSTOM QUEST ──────────────────────────────────────────────────────────
const FREQ_DAYS={
  "one-off":0,"daily":1,"twice-weekly":3,"weekly":7,
  "fortnightly":14,"monthly":30,"quarterly":90,"biannual":180,"yearly":365
};

async function callOracle(name) {
  const res=await fetch("https://hearthkeeper-ai.tom-offrede.workers.dev/",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"grok-4-0709",max_tokens:200,messages:[{role:"user",
      content:`You are an XP oracle for a fantasy house-cleaning app. Assign XP (20–500) based on effort.
Rules: <5min=20-50, 5-15min=50-100, 15-45min=100-200, 45-90min=200-320, >90min=320-500. Unpleasant tasks get a small bonus.
Task: "${name}"
Respond ONLY with valid JSON: {"xp":150,"reason":"one sentence"}`}]})
  });
  const d=await res.json();
  return JSON.parse(d.choices?.[0]?.message?.content.replace(/```json|```/g,"").trim()||"{}");
}

function showResult(msg,isErr,retry) {
  const el=document.getElementById("custom-result");
  el.className="custom-result"+(isErr?" error":"");
  el.textContent=msg;
  if (retry) {
    const btn=document.createElement("button");
    btn.className="retry-btn"; btn.textContent="Try again";
    btn.onclick=()=>submitInner(lastCustomQuest.name,lastCustomQuest.freq);
    el.appendChild(btn);
  }
}

async function submitInner(name,freq) {
  const btn=document.getElementById("custom-submit-btn");
  btn.disabled=true; btn.textContent="Consulting the oracle...";
  showResult("",false,false);
  try {
    const parsed=await callOracle(name);
    const xp=Math.max(20,Math.min(500,Math.round(Number(parsed.xp))));
    gameData.quests.push({id:"custom_"+Date.now(),emoji:"✨",fantasy:name,real:name,
      xp,freq,freqDays:FREQ_DAYS[freq]||0,lastCompleted:null});
    await saveGameData(); renderQuestBoard(); renderSuggestedQuests();
    showResult(`✓ Quest added for ${xp} XP — ${parsed.reason}`,false,false);
    document.getElementById("custom-name").value="";
    document.getElementById("custom-freq").value="one-off";
  } catch(_) { showResult("The oracle couldn't be reached. Please try again.",true,true); }
  btn.disabled=false; btn.textContent="Add Quest ✨";
}

window.submitCustomQuest = async function() {
  const name=document.getElementById("custom-name").value.trim();
  const freq=document.getElementById("custom-freq").value;
  if (!name) { showResult("Please describe the task first.",true,false); return; }
  lastCustomQuest={name,freq};
  await submitInner(name,freq);
};

window.dismissHint = function() {
  localStorage.setItem("hintDismissed", "1");
  renderQuestBoard();
};

window.toggleXPTooltip = function(e) {
  e.stopPropagation();
  const t=document.getElementById("xp-tooltip");
  t.classList.toggle("visible");
  document.addEventListener("click",()=>t.classList.remove("visible"),{once:true});
};

// ── FREQUENCY EDITOR ──────────────────────────────────────────────────────
window.openFreqEditor = function(questId) {
  // Close any open menus
  document.querySelectorAll(".quest-menu-dropdown.open").forEach(d => d.classList.remove("open"));

  const quest = gameData.quests.find(q => q.id === questId);
  if (!quest) return;

  // Remove any existing editor
  document.getElementById("freq-editor-overlay")?.remove();

  const options = [
    { value:"one-off",      label:"One-off",       days:0   },
    { value:"daily",        label:"Daily",         days:1   },
    { value:"twice-weekly", label:"Twice a week",  days:3   },
    { value:"weekly",       label:"Weekly",        days:7   },
    { value:"fortnightly",  label:"Every 2 weeks", days:14  },
    { value:"monthly",      label:"Monthly",       days:30  },
    { value:"quarterly",    label:"Every 3 months",days:90  },
    { value:"biannual",     label:"Every 6 months",days:180 },
    { value:"yearly",       label:"Yearly",        days:365 },
  ];

  const optionsHtml = options.map(o =>
    `<option value="${o.value}" ${quest.freq === o.value ? "selected" : ""}>${o.label}</option>`
  ).join("");

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.id = "freq-editor-overlay";
  overlay.innerHTML = `
    <div class="overlay-box" style="max-width:380px">
      <h2 style="font-size:20px;margin-bottom:6px">Change Frequency</h2>
      <div class="overlay-subtitle" style="margin-bottom:18px">${quest.fantasy}</div>
      <div class="form-field">
        <label>How often?</label>
        <select id="freq-editor-select">${optionsHtml}</select>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="overlay-close" onclick="saveFreq('${questId}')">Save</button>
        <button class="settings-btn" onclick="document.getElementById('freq-editor-overlay').remove()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
};

window.saveFreq = async function(questId) {
  const quest = gameData.quests.find(q => q.id === questId);
  if (!quest) return;
  const select = document.getElementById("freq-editor-select");
  const freq   = select.value;
  const days   = { "one-off":0,"daily":1,"twice-weekly":3,"weekly":7,
    "fortnightly":14,"monthly":30,"quarterly":90,"biannual":180,"yearly":365 }[freq] || 0;
  quest.freq     = freq;
  quest.freqDays = days;
  document.getElementById("freq-editor-overlay").remove();
  await saveGameData();
  renderQuestBoard();
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────
window.showForgotPassword = function() {
  document.getElementById("forgot-form").style.display = "block";
  document.getElementById("forgot-msg").textContent = "";
  document.getElementById("forgot-email").value = "";
};

window.hideForgotPassword = function() {
  document.getElementById("forgot-form").style.display = "none";
};

window.doForgotPassword = async function() {
  const email = document.getElementById("forgot-email").value.trim();
  const msg   = document.getElementById("forgot-msg");
  msg.style.color = "var(--green)";
  msg.textContent = "";
  if (!email) { msg.style.color="var(--red)"; msg.textContent = "Please enter your email."; return; }
  try {
    await window.fbResetPassword(window.fbAuth, email);
    msg.textContent = "Reset link sent — check your inbox.";
  } catch(e) {
    msg.style.color = "var(--red)";
    msg.textContent = "No account found with that email, or an error occurred.";
  }
};

window.updateRegNote = function() {
  const u    = document.getElementById("reg-username").value.trim();
  const note = document.getElementById("reg-note");
  if (!u) { note.textContent = ""; return; }
  if (u.includes("@")) {
    note.style.color = "var(--green)";
    note.textContent = "✓ Registering with email — password recovery will be available.";
  } else {
    note.style.color = "var(--red)";
    note.textContent = "⚠ Registering with username only — if you forget your password, it cannot be recovered.";
  }
};

// ── BOOTSTRAP ─────────────────────────────────────────────────────────────
window.onAuthReady = function(user) {
  currentUser=user;
  if (!user) { showScreen("auth"); return; }
  loadGameData(user.uid).then(exists=>{
    if (exists) initApp(); else { renderCharSelect(); showScreen("char"); }
  });
};
