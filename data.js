const CHARACTERS = {
  cael: {
    name: "Cael",
    emoji: "🌿",
    epithet: "The Wandering Hearthkeeper",
    bio: "Once a traveling herbalist who roamed the forest roads trading remedies and recipes, Cael finally settled into an old stone cottage at the edge of a village after years of rootlessness. The place was a ruin — overgrown, dusty, forgotten. But Cael saw something others didn't: the warmth of a home waiting to be reclaimed. Every scrubbed floor and cleared shelf is an act of reclaiming peace.",
    companion: "🦔",
    companionName: "a hedgehog",
    tierTitles: [
      "Wandering Newcomer",
      "Hearthside Settler",
      "Keeper of the Quiet Hearth",
      "Elder of the Homely Arts",
      "Wanderer No More",
      "Hearthkeeper of Legend",
      "The One Who Finally Arrived"
    ]
  },
  soren: {
    name: "Soren",
    emoji: "⚔️",
    epithet: "The Disgraced Knight",
    bio: "Soren was once a knight of the Ember Order, sworn to protect the realm's great keeps. After a dispute with a corrupt commander, Soren renounced the Order and retreated to a crumbling country manor. With no wars left to fight, Soren now turns that same disciplined focus inward — maintaining the manor as a personal code of honour. To Soren, a clean home is a fortress of the self.",
    companion: "🐦‍⬛",
    companionName: "a raven",
    tierTitles: [
      "Disgraced Arrival",
      "Manor's Steward",
      "Knight of the Swept Floor",
      "Sworn Keeper of the Manor",
      "Knight of the Immaculate Keep",
      "The Undefeated Steward",
      "The Knight Who Found Peace"
    ]
  },
  pip: {
    name: "Pip",
    emoji: "🧪",
    epithet: "The Apprentice Alchemist",
    bio: "Pip was thrown out of the Academy of Arcane Sciences for conducting unsanctioned experiments — mostly involving mushrooms and a lot of smoke. Now living in a converted mill cottage, Pip approaches cleaning not as a chore but as a puzzle: if the workspace is optimised, surely the great discoveries will follow. Each organised shelf is one step closer to the formula that changes everything.",
    companion: "🦎",
    companionName: "a salamander",
    tierTitles: [
      "Expelled Apprentice",
      "Apprentice of Order",
      "Alchemist of Domestic Order",
      "Grand Experimentalist of Tidiness",
      "Master of the Optimised Workspace",
      "Archmage of Domestic Science",
      "The Greatest Discovery Was Home"
    ]
  },
  wren: {
    name: "Wren",
    emoji: "🦊",
    epithet: "The Forest Warden",
    bio: "Wren spent a decade living among the woodland spirits as a guardian of the old forest paths. When the spirits asked Wren to serve as their emissary to the human villages, Wren was given a small warden's cottage at the forest's edge. Wren now tends the space with the same reverence shown to the forest — understanding that a home, like a forest, has its own living balance that must be actively maintained.",
    companion: "🦊",
    companionName: "a fox",
    tierTitles: [
      "Forest Stranger",
      "Warden of the Threshold",
      "Guardian of the Forest Edge",
      "Warden of the Inner and Outer",
      "High Warden of Hearthwood",
      "Elder Warden of the Ancient Hearth",
      "Where the Forest Meets the Hearth"
    ]
  },
  thistle: {
    name: "Thistle",
    emoji: "🧙",
    epithet: "The Village Hedge-Witch",
    bio: "Thistle is the village's unofficial hedge-witch — not powerful enough for the great towers of magic, but endlessly useful: fixing ailments, settling disputes, brewing remedies. The cottage serves as workshop, clinic, and home all at once, which means it gets absolutely destroyed on a regular basis. Thistle cleans not out of love for tidiness, but because a cluttered workspace is a dangerous one — and reputation is everything.",
    companion: "🐈‍⬛",
    companionName: "a black cat",
    tierTitles: [
      "Hedge Witch of No Account",
      "Witch of Modest Repute",
      "Witch of Considerable Reputation",
      "Witch of the Well-Swept Cottage",
      "Grand Witch of the Spotless Cottage",
      "The Witch Whose Cottage Gleams",
      "The Witch Whose Name Became Legend"
    ]
  }
};

// Cumulative XP required to reach each level.
// Index = level (1-indexed). LEVEL_TABLE[0] = 0 (start of level 1).
// LEVEL_TABLE[1] = 200 means you need 200 XP total to reach level 2, etc.
const LEVEL_TABLE = [
  0,       // level 1 starts at 0
  200,     // level 2
  550,     // level 3
  1050,    // level 4
  1750,    // level 5
  2650,    // level 6
  3850,    // level 7
  5050,    // level 8
  6250,    // level 9
  7450,    // level 10
  8650,    // level 11
  10850,   // level 12
  13050,   // level 13
  15050,   // level 14
  17050,   // level 15
  19050,   // level 16
  21050,   // level 17
  23050,   // level 18
  25050,   // level 19
  27050,   // level 20
  29050,   // level 21
  32550,   // level 22
  36050,   // level 23
  39550,   // level 24
  43050,   // level 25
  46550,   // level 26
  50050,   // level 27
  53550,   // level 28
  57050,   // level 29
  60550,   // level 30
  64050,   // level 31
  69550,   // level 32
  75050,   // level 33
  80550,   // level 34
  86050,   // level 35
  91550,   // level 36
  97050,   // level 37
  102550,  // level 38
  108050,  // level 39
  113550,  // level 40
  119050,  // level 41
  127050,  // level 42
  135050,  // level 43
  143050,  // level 44
  151050,  // level 45
  159050,  // level 46
  167050,  // level 47
  175050,  // level 48
  183050,  // level 49
  191050   // level 50 (max)
];

// Returns 0-indexed tier (0–6) for a given level
function getTierForLevel(level) {
  if (level <= 5)  return 0; // The Awakening
  if (level <= 12) return 1; // First Foundations
  if (level <= 20) return 2; // The Keeper's Path
  if (level <= 30) return 3; // Hearth & Discipline
  if (level <= 40) return 4; // The Seasoned Warden
  if (level <= 49) return 5; // Elder of the Keep
  return 6;                  // The Eternal Hearthkeeper
}

// Returns the character-specific title for a given level
function getTitleForLevel(characterId, level) {
  const char = CHARACTERS[characterId];
  if (!char) return "";
  return char.tierTitles[getTierForLevel(level)];
}

const FREQ_LABELS = {
  "daily":        "Daily",
  "twice-weekly": "2× Week",
  "weekly":       "Weekly",
  "fortnightly":  "Every 2 Weeks",
  "monthly":      "Monthly",
  "quarterly":    "Every 3 Months",
  "biannual":     "Every 6 Months",
  "yearly":       "Yearly",
  "one-off":      "One-Off"
};

// What unlocks at specific levels (used for level-up overlay messages)
const LEVEL_UNLOCKS = {
  9:  "The Lore tab is now unlocked. Your story begins.",
  41: "Legacy Quests have been unlocked — five great final challenges await.",
  50: "You have reached the pinnacle. The Eternal Hearthkeeper."
};

// Levels that award a Keep Token
const TOKEN_LEVELS = new Set([
  2,3,4,5,6,7,8,9,10,11,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50
]);

const KEEP_ROOMS = [
  { id:"main_hall", name:"The Main Hall",       emoji:"🏛️", desc:"The heart of the keep. Cold and cobwebbed when you arrived, but yours from the first day.", unlockLevel:1  },
  { id:"hearth",    name:"The Hearth",           emoji:"🔥", desc:"A fire burns here now. The keep breathes.",                                                  unlockLevel:3  },
  { id:"kitchen",   name:"The Kitchen",          emoji:"🍳", desc:"Where sustenance is prepared. Smells of herbs and honest effort.",                           unlockLevel:6  },
  { id:"bedroom",   name:"The Bedchamber",       emoji:"🛏️", desc:"A place of rest, earned through honest work.",                                               unlockLevel:11 },
  { id:"garden",    name:"The Garden",           emoji:"🌱", desc:"A weed patch for now. But there are seeds of something better here.",                        unlockLevel:14 },
  { id:"bathroom",  name:"The Bathing Chamber",  emoji:"🛁", desc:"Clean water, clean stone. A small luxury that took real effort.",                            unlockLevel:17 },
  { id:"exterior",  name:"The Cottage Exterior", emoji:"🏡", desc:"Seen from outside for the first time. Your keep has a shape, a face, a presence.",           unlockLevel:20 },
  { id:"study",     name:"The Study",            emoji:"📚", desc:"A room for thought and record-keeping. The shelves await filling.",                          unlockLevel:22 },
  { id:"cellar",    name:"The Cellar",           emoji:"🪨", desc:"Deep and cool. What secrets does the old stone hold?",                                       unlockLevel:28 },
  { id:"tower",     name:"The Tower",            emoji:"🗼", desc:"A personal sanctuary, high above the rest of the keep.",                                     unlockLevel:32 }
];

// Returns "stage1", "stage2", or "stage3" from saved room upgrade data
function getRoomStage(roomId, roomStages) {
  const s = (roomStages || {})[roomId] || 0;
  if (s >= 2) return "stage3";
  if (s >= 1) return "stage2";
  return "stage1";
}

// Returns "clean", "dusty", or "neglected" based on overdue quest count
function getRoomCondition(overdueCount) {
  if (overdueCount === 0) return "clean";
  if (overdueCount <= 2)  return "dusty";
  return "neglected";
}

const DEFAULT_QUESTS = [
  // ── DAILY ────────────────────────────────────────────────────────────────
  { id:"q1",  emoji:"🍽️", fantasy:"Clear the Scullery",          real:"Wash dishes / clear sink",               xp:25,  freq:"daily",        freqDays:1   },
  { id:"q2",  emoji:"🧹", fantasy:"Wipe the Hearth Stones",       real:"Wipe kitchen counters",                  xp:20,  freq:"daily",        freqDays:1   },
  { id:"q3",  emoji:"🗑️", fantasy:"Haul the Refuse",              real:"Take out trash (when full)",             xp:20,  freq:"daily",        freqDays:1   },
  { id:"q4",  emoji:"🛋️", fantasy:"Tidy the Halls",               real:"General tidy-up / put things away",     xp:20,  freq:"daily",        freqDays:1   },
  { id:"q43", emoji:"🧹", fantasy:"Clear the Passage",             real:"Sweep / vacuum hallway",                 xp:30,  freq:"weekly",       freqDays:7   },
  // ── TWICE A WEEK ─────────────────────────────────────────────────────────
  { id:"q5",  emoji:"🧺", fantasy:"Sweep the Kitchen Flags",       real:"Sweep / vacuum kitchen floor",           xp:40,  freq:"twice-weekly", freqDays:3   },
  { id:"q6",  emoji:"🍳", fantasy:"Scour the Cooking Stone",       real:"Wipe stovetop",                          xp:35,  freq:"twice-weekly", freqDays:3   },
  // ── WEEKLY ───────────────────────────────────────────────────────────────
  { id:"q7",  emoji:"🌀", fantasy:"Banish the Dust Sprites",       real:"Vacuum living room",                     xp:55,  freq:"weekly",       freqDays:7   },
  { id:"q7b", emoji:"🌀", fantasy:"Sweep the Sleeping Chamber",    real:"Vacuum / sweep bedroom",                 xp:40,  freq:"weekly",       freqDays:7   },
  { id:"q8",  emoji:"🪣", fantasy:"Mop the Stone Floors",          real:"Mop hard floors",                        xp:75,  freq:"weekly",       freqDays:7   },
  { id:"q9",  emoji:"🚽", fantasy:"Purge the Privy",               real:"Clean toilet bowl & seat",               xp:80,  freq:"weekly",       freqDays:7   },
  { id:"q10", emoji:"🪥", fantasy:"Polish the Wash Basin",         real:"Wipe bathroom sink & mirror",            xp:60,  freq:"weekly",       freqDays:7   },
  { id:"q11", emoji:"🧊", fantasy:"Tend the Iron Beasts",          real:"Wipe kitchen appliance exteriors",       xp:55,  freq:"weekly",       freqDays:7   },
  { id:"q12", emoji:"🛏️", fantasy:"Renew the Sleeping Linens",    real:"Change bed sheets",                      xp:65,  freq:"weekly",       freqDays:7   },
  { id:"q13", emoji:"📡", fantasy:"Banish Leftovers Within",       real:"Clean inside microwave",                 xp:55,  freq:"weekly",       freqDays:7   },
  { id:"q14", emoji:"♻️", fantasy:"Empty All Refuse Vessels",      real:"Empty all trash bins",                   xp:45,  freq:"weekly",       freqDays:7   },
  // ── EVERY 2 WEEKS ────────────────────────────────────────────────────────
  { id:"q15", emoji:"🚿", fantasy:"Scour the Bathing Chamber",     real:"Clean shower / bathtub",                 xp:90,  freq:"fortnightly",  freqDays:14  },
  { id:"q16", emoji:"🪟", fantasy:"Vanquish the Dust Wraiths",     real:"Dust furniture & surfaces",              xp:80,  freq:"fortnightly",  freqDays:14  },
  { id:"q17", emoji:"🧱", fantasy:"Cleanse the Tile Ramparts",     real:"Wipe bathroom tiles & walls",            xp:85,  freq:"fortnightly",  freqDays:14  },
  // ── MONTHLY ──────────────────────────────────────────────────────────────
  { id:"q18", emoji:"❄️", fantasy:"Purge the Cold Vault",          real:"Clean inside fridge",                    xp:130, freq:"monthly",      freqDays:30  },
  { id:"q19", emoji:"🌊", fantasy:"Unclog the Scullery Drain",     real:"Clean kitchen sink drain",               xp:120, freq:"monthly",      freqDays:30  },
  { id:"q44", emoji:"🪣", fantasy:"Scour the Scullery Basin",      real:"Clean kitchen sink",                     xp:45,  freq:"weekly",       freqDays:7   },
  { id:"q20", emoji:"🪞", fantasy:"Launder the Shower Veil",       real:"Wash shower curtain / liner",            xp:110, freq:"monthly",      freqDays:30  },
  { id:"q21", emoji:"🧽", fantasy:"Restore the Grout Lines",       real:"Clean bathroom grout",                   xp:140, freq:"monthly",      freqDays:30  },
  { id:"q22", emoji:"🌀", fantasy:"Purify the Wash Engine",        real:"Clean washing machine",                  xp:125, freq:"monthly",      freqDays:30  },
  { id:"q23", emoji:"💡", fantasy:"Dust the High Fixtures",        real:"Dust light fixtures & ceiling fans",     xp:115, freq:"monthly",      freqDays:30  },
  { id:"q24", emoji:"🪵", fantasy:"Scrub the Skirting Boards",     real:"Wipe baseboards & door frames",          xp:120, freq:"monthly",      freqDays:30  },
  { id:"q25", emoji:"✨", fantasy:"Cleanse the Dish Engine",       real:"Clean inside dishwasher",                xp:125, freq:"monthly",      freqDays:30  },
  { id:"q26", emoji:"🛋️", fantasy:"Delve Under the Cushions",     real:"Vacuum under sofa cushions",             xp:100, freq:"monthly",      freqDays:30  },
  { id:"q27", emoji:"🪴", fantasy:"Tidy the Apothecary Shelves",   real:"Clean bathroom cabinet shelves",         xp:105, freq:"monthly",      freqDays:30  },
  // ── EVERY 3 MONTHS ───────────────────────────────────────────────────────
  { id:"q28", emoji:"🔥", fantasy:"The Great Oven Purge",          real:"Deep clean oven",                        xp:200, freq:"quarterly",    freqDays:90  },
  { id:"q29", emoji:"💤", fantasy:"Cleanse the Sleeping Slab",     real:"Vacuum mattress",                        xp:175, freq:"quarterly",    freqDays:90  },
  { id:"q30", emoji:"🛌", fantasy:"Launder the Great Coverlet",    real:"Wash duvet / comforter",                 xp:180, freq:"quarterly",    freqDays:90  },
  { id:"q31", emoji:"🪟", fantasy:"Purge the Sill Ramparts",       real:"Clean window sills & blinds",            xp:185, freq:"quarterly",    freqDays:90  },
  { id:"q32", emoji:"🗑️", fantasy:"Scour the Refuse Vessels",     real:"Wash trash cans",                        xp:160, freq:"quarterly",    freqDays:90  },
  { id:"q33", emoji:"🏋️", fantasy:"Move the Great Furnishings",   real:"Clean behind / under furniture",         xp:190, freq:"quarterly",    freqDays:90  },
  // ── EVERY 6 MONTHS ───────────────────────────────────────────────────────
  { id:"q34", emoji:"🪟", fantasy:"Cleanse the Great Panes",       real:"Wash windows inside & out",              xp:260, freq:"biannual",     freqDays:180 },
  { id:"q35", emoji:"❄️", fantasy:"Tend the Cold Vault Coils",     real:"Deep clean fridge coils",                xp:240, freq:"biannual",     freqDays:180 },
  { id:"q36", emoji:"🌀", fantasy:"Purify the Wash Engine Filter", real:"Clean washing machine filter",           xp:230, freq:"biannual",     freqDays:180 },
  { id:"q37", emoji:"👘", fantasy:"The Great Wardrobe Reckoning",  real:"Declutter & organise wardrobes",         xp:250, freq:"biannual",     freqDays:180 },
  { id:"q38", emoji:"🌬️", fantasy:"Scour the Oven Hood",          real:"Clean oven hood & filter",               xp:245, freq:"biannual",     freqDays:180 },
  // ── YEARLY ───────────────────────────────────────────────────────────────
  { id:"q39", emoji:"🗄️", fantasy:"The Grand Cabinet Expedition", real:"Deep clean kitchen cabinets inside",     xp:370, freq:"yearly",       freqDays:365 },
  { id:"q40", emoji:"💨", fantasy:"Purge the Dryer Vents",         real:"Clean dryer vent",                       xp:360, freq:"yearly",       freqDays:365 },
  { id:"q41", emoji:"😴", fantasy:"Launder the Sleeping Pillows",  real:"Wash pillows",                           xp:340, freq:"yearly",       freqDays:365 },
  { id:"q42", emoji:"🏚️", fantasy:"Purge the Walls & Vaults",     real:"Clean walls & ceilings",                 xp:380, freq:"yearly",       freqDays:365 }
];
