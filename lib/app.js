import { CONFIG } from './config.js';
import { initAuth, handleGoogleLogin, signOut, deleteAccount, isAuthenticated, getCurrentUser, getAwsCredentials } from './auth.js';
import { syncProgress, queueCloudPush, deleteCloudProgress, checkPendingSync } from './sync.js';

// --- Buckwalter Transliteration Converter ---
const BuckwalterConverter = {
  // Buckwalter ASCII -> Arabic Unicode
  charMap: {
    "'": "\u0621", ">": "\u0623", "&": "\u0624", "<": "\u0625", "}": "\u0626",
    "A": "\u0627", "b": "\u0628", "p": "\u0629", "t": "\u062A", "v": "\u062B",
    "j": "\u062C", "H": "\u062D", "x": "\u062E", "d": "\u062F", "*": "\u0630",
    "r": "\u0631", "z": "\u0632", "s": "\u0633", "$": "\u0634", "S": "\u0635",
    "D": "\u0636", "T": "\u0637", "Z": "\u0638", "E": "\u0639", "g": "\u063A",
    "_": "\u0640", "f": "\u0641", "q": "\u0642", "k": "\u0643", "l": "\u0644",
    "m": "\u0645", "n": "\u0646", "h": "\u0647", "w": "\u0648", "Y": "\u0649",
    "y": "\u064A", "F": "\u064B", "N": "\u064C", "K": "\u064D", "a": "\u064E",
    "u": "\u064F", "i": "\u0650", "~": "\u0651", "o": "\u0652", "^": "\u0653",
    "#": "\u0654", "`": "\u0670", "{": "\u0671", ":": "\u06DC", "@": "\u06DF",
    "\"": "\u06E0", "[": "\u06E2", ";": "\u06E3", ",": "\u06E5", ".": "\u06E6",
    "!": "\u06E8", "-": "\u06EA", "+": "\u06EB", "%": "\u06EC", "]": "\u06ED"
  },
  
  // Buckwalter ASCII -> Readable Phonetics
  phoneticMap: {
    "'": "’", ">": "a", "&": "u", "<": "i", "}": "i",
    "A": "ā", "b": "b", "p": "h", "t": "t", "v": "th",
    "j": "j", "H": "ḥ", "x": "kh", "d": "d", "*": "dh",
    "r": "r", "z": "z", "s": "s", "$": "sh", "S": "ṣ",
    "D": "ḍ", "T": "ṭ", "Z": "ẓ", "E": "‘", "g": "gh",
    "f": "f", "q": "q", "k": "k", "l": "l", "m": "m",
    "n": "n", "h": "h", "w": "w", "Y": "ā", "y": "y",
    "a": "a", "u": "u", "i": "i", "o": "", "`": "ā",
    "{": "a", "^": "", "#": ""
  },

  toArabic(buck) {
    if (!buck) return "";
    let result = "";
    for (let i = 0; i < buck.length; i++) {
      const c = buck[i];
      result += this.charMap[c] || c;
    }
    return result;
  },

  toPhonetic(buck) {
    if (!buck) return "";
    
    // Check if it's already converted to friendly phonetic (no Buckwalter characters present)
    if (!/[<>{}~&*$E#`^]/.test(buck) && !buck.includes('ll~ah') && buck.toLowerCase() === buck) {
      return buck;
    }

    let clean = buck;
    
    // Merge vowel indicators and long vowels
    clean = clean.replace(/<i/g, "i");
    clean = clean.replace(/>a/g, "a");
    clean = clean.replace(/>u/g, "u");
    clean = clean.replace(/iY/g, "ī");
    clean = clean.replace(/iy/g, "ī");
    clean = clean.replace(/uw/g, "ū");
    clean = clean.replace(/uW/g, "ū");
    clean = clean.replace(/aY`/g, "ā");
    clean = clean.replace(/aY/g, "ā");
    clean = clean.replace(/`Y/g, "ā");

    let result = [];
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      
      // Handle Shadda (double consonant)
      if (c === "~") {
        if (result.length > 0) {
          const lastChar = result[result.length - 1];
          if (lastChar.length > 1) {
            // Digraph: double first letter (e.g. "th" -> "tth", "sh" -> "ssh")
            result[result.length - 1] = lastChar[0] + lastChar;
          } else {
            result.push(lastChar);
          }
        }
        continue;
      }
      
      const mapped = this.phoneticMap[c] !== undefined ? this.phoneticMap[c] : c;
      result.push(mapped);
    }
    
    let phonetic = result.join("");
    
    // Post-processing corrections
    phonetic = phonetic.replace(/allāh/gi, "Allah");
    phonetic = phonetic.replace(/’l~/g, "l-");
    phonetic = phonetic.replace(/’/g, ""); // strip final hamza for cleaner presentation if it stands alone
    phonetic = phonetic.replace(/aa/g, "a");
    phonetic = phonetic.replace(/ii/g, "ī");
    phonetic = phonetic.replace(/uu/g, "ū");
    
    // Capitalize first letter (but skip Ain)
    if (phonetic.length > 0) {
      if (phonetic.startsWith("‘") && phonetic.length > 1) {
        phonetic = "‘" + phonetic[1].toUpperCase() + phonetic.substring(2);
      } else {
        phonetic = phonetic[0].toUpperCase() + phonetic.substring(1);
      }
    }
    
    return phonetic;
  }
};

// --- DOM Elements ---
const flashcardContainer = document.getElementById('flashcard-container');
const flashcard = document.getElementById('flashcard');
const arabicWord = document.getElementById('arabic-word');
const wordTransliteration = document.getElementById('word-transliteration');
const arabicWordMini = document.getElementById('arabic-word-mini');
const wordTransliterationMini = document.getElementById('word-transliteration-mini');
const wordMeaning = document.getElementById('word-meaning');
const freqTagFront = document.getElementById('freq-tag-front');
const freqTagBack = document.getElementById('freq-tag-back');
const posTagFront = document.getElementById('pos-tag-front');
const posTagBack = document.getElementById('pos-tag-back');
const cardIndexFront = document.getElementById('card-index-front');
const cardIndexBack = document.getElementById('card-index-back');
const rootWrapper = document.getElementById('root-wrapper');
const wordRoot = document.getElementById('word-root');

// Buttons
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const yesBtn = document.getElementById('yes-btn');
const noBtn = document.getElementById('no-btn');
const resetBtn = document.getElementById('reset-session');
const themeToggle = document.getElementById('theme-toggle');
const focusToggle = document.getElementById('focus-toggle');
const corpusLink = document.getElementById('corpus-link');
const speakBtnFront = document.getElementById('speak-btn-front');
const speakBtnBack = document.getElementById('speak-btn-back');
const searchInput = document.getElementById('search-input');
const clearSearch = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');
const starBtnFront = document.getElementById('star-btn-front');
const starBtnBack = document.getElementById('star-btn-back');
const exportStats = document.getElementById('export-stats');
const importStats = document.getElementById('import-stats');
const importFileInput = document.getElementById('import-file-input');

// Selects / Inputs
const freqMinInput = document.getElementById('freq-min');
const freqMaxInput = document.getElementById('freq-max');
const freqMinVal = document.getElementById('freq-min-val');
const freqMaxVal = document.getElementById('freq-max-val');
const sliderTrack = document.getElementById('slider-track');
const starredOnlyToggle = document.getElementById('starred-only-toggle');
const hideKnownToggle = document.getElementById('hide-known-toggle');
const posFilter = document.getElementById('pos-filter');
const coverageFilter = document.getElementById('coverage-filter');
const learningMode = document.getElementById('learning-mode');
const arabicFontSelect = document.getElementById('arabic-font-select');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

// Settings Modal elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModalOverlay = document.getElementById('settings-modal-overlay');
const settingsModalClose = document.getElementById('settings-modal-close');
const applySettingsBtn = document.getElementById('apply-settings-btn');

// Vocabulary Explorer elements
const vocabExplorerBtn = document.getElementById('vocab-explorer-btn');
const vocabModalOverlay = document.getElementById('vocab-modal-overlay');
const vocabModalClose = document.getElementById('vocab-modal-close');
const vocabSearchInput = document.getElementById('vocab-search-input');
const vocabClearSearch = document.getElementById('vocab-clear-search');
const vocabTableBody = document.getElementById('vocab-table-body');
const vocabEmptyState = document.getElementById('vocab-empty-state');
const vocabTotalCount = document.getElementById('vocab-total-count');
const vocabTabs = document.querySelectorAll('.vocab-tab');
const vocabModalBody = document.querySelector('.vocab-modal-body');

// Stats Counters
const scorePercentage = document.getElementById('score-percentage');
const statsSeen = document.getElementById('stats-seen');
const statsKnown = document.getElementById('stats-known');
const statsLearning = document.getElementById('stats-learning');
const statsRemaining = document.getElementById('stats-remaining');
const sessionProgress = document.getElementById('session-progress');

// --- State Variables ---
let allWords = [];         // Loaded from JSON
let filteredWords = [];    // Filtered by frequency
let filteredWordsForStats = []; // Filtered words matching active filters (excluding Hide Mastered)
let uniqueFrequencies = []; // Unique frequency values sorted ascending
let historyStack = [];     // Array of indices visited in filteredWords
let historyPointer = -1;   // Current pointer in historyStack
let isFlipped = false;     // Is the card currently flipped?

// Vocabulary Explorer states
let currentVocabResults = []; // Filtered list of matching vocabulary words
let vocabLoadedCount = 0;    // Number of vocabulary items currently rendered in the DOM
let activeVocabTab = 'all';  // Current selected tab in the explorer ('all', 'starred', 'known', 'learning')
let currentWord = null;    // Current active word object

// Exam State
let examState = {
  selectedPool: 'all',  // '50', '75', '90', 'all'
  selectedSize: 25,     // 25, 50
  activeQuestions: [],  // Array of { word, choices: [], correctIndex, selectedIndex: -1 }
  currentIndex: 0,
  score: 0,
  incorrectWords: [],   // Array of word objects answered incorrectly
  isActive: false,      // Is an exam session currently active?
  autoAdvanceTimeout: null,
  activeKeyHandler: null,
  activeNextKeyHandler: null
};

// Persistent Stats (saved to localStorage)
let stats = {
  known: [],      // Array of unique word keys
  learning: [],   // Array of unique word keys
  seen: []        // Array of unique word keys
};

// Helper to get a truly unique key for a word (same Arabic & transliteration but different part of speech should be distinct)
function getWordKey(word) {
  if (!word) return '';
  return `${word.arabic}_${word.transliteration}_${word.part_of_speech || ''}`;
}

// Migrate old stats format keys (transliteration only or arabic_transliteration) to the new unique key format
function migrateAllKeys(allWords) {
  if (!allWords || allWords.length === 0) return;
  let statsChanged = false;
  let starsChanged = false;

  const migrateList = (list) => {
    const newList = [];
    let changed = false;
    for (const key of list) {
      if (!key) continue;
      const parts = key.split('_');
      if (parts.length < 3) {
        changed = true;
        let matches = [];
        if (parts.length === 1) {
          matches = allWords.filter(w => w.transliteration === key);
        } else if (parts.length === 2) {
          matches = allWords.filter(w => w.arabic === parts[0] && w.transliteration === parts[1]);
        }
        if (matches.length > 0) {
          matches.forEach(w => {
            const newKey = getWordKey(w);
            if (!newList.includes(newKey)) {
              newList.push(newKey);
            }
          });
        }
      } else {
        if (!newList.includes(key)) {
          newList.push(key);
        }
      }
    }
    return { list: newList, changed };
  };

  if (stats.known) {
    const res = migrateList(stats.known);
    if (res.changed) {
      stats.known = res.list;
      statsChanged = true;
    }
  }
  if (stats.learning) {
    const res = migrateList(stats.learning);
    if (res.changed) {
      stats.learning = res.list;
      statsChanged = true;
    }
  }
  if (stats.seen) {
    const res = migrateList(stats.seen);
    if (res.changed) {
      stats.seen = res.list;
      statsChanged = true;
    }
  }

  const starredList = Array.from(starredWords);
  const resStar = migrateList(starredList);
  if (resStar.changed) {
    starredWords = new Set(resStar.list);
    starsChanged = true;
  }

  if (statsChanged) {
    saveStats();
  }
  if (starsChanged) {
    saveStars();
  }
}

// --- Initializing App ---
document.addEventListener('DOMContentLoaded', () => {
  detectDevice();
  loadTheme();
  loadFocusMode();
  loadStats();
  fetchWords();
  setupEventListeners();
  setupAuthEventListeners();
  initAuth().then(() => {
    // Initialize Google Sign-In on page load to enable silent auto-refresh
    initGoogleSignIn();

    if (isAuthenticated()) {
      syncProgress();
    }
  });
});

// --- Device Detection ---
function detectDevice() {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipad|ipod|android|blackberry|mini|windows\sphone|iemobile/i.test(userAgent) || (isTouch && window.innerWidth <= 860);

  if (isMobile) {
    document.body.classList.add('mobile-device');
    document.body.classList.remove('desktop-device');
  } else {
    document.body.classList.add('desktop-device');
    document.body.classList.remove('mobile-device');
  }

  // Update shortcuts visibility/text dynamically based on device capability
  const shortcutsEl = document.querySelector('.keyboard-shortcuts');
  if (shortcutsEl) {
    if (isMobile) {
      shortcutsEl.innerHTML = '<span class="mobile-tip"><i class="fa-solid fa-fingerprint"></i> Tap card to flip. Rate recall with buttons below.</span>';
    } else {
      shortcutsEl.innerHTML = '<span>Shortcuts:</span> <kbd>Space</kbd> Flip &bull; <kbd>&rarr;</kbd> Next &bull; <kbd>&larr;</kbd> Prev &bull; <kbd>1</kbd> Hard &bull; <kbd>2</kbd> Easy &bull; <kbd>A</kbd> Audio &bull; <kbd>F</kbd> Focus';
    }
  }
}

// --- Theme Management ---
function loadTheme() {
  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem('theme') || 'dark';
  } catch (e) {
    console.warn('localStorage not accessible:', e);
  }
  
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    document.documentElement.classList.add('light-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.body.classList.remove('light-theme');
    document.documentElement.classList.remove('light-theme');
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
}

function toggleTheme() {
  const isLight = !document.documentElement.classList.contains('light-theme');
  const newTheme = isLight ? 'light' : 'dark';
  
  try {
    localStorage.setItem('theme', newTheme);
  } catch (e) {
    console.warn('localStorage not accessible:', e);
  }
  
  document.documentElement.setAttribute('data-theme', newTheme);
  
  if (isLight) {
    document.documentElement.classList.add('light-theme');
    document.body.classList.add('light-theme');
  } else {
    document.documentElement.classList.remove('light-theme');
    document.body.classList.remove('light-theme');
  }
  
  themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// --- Focus Mode Management ---
function loadFocusMode() {
  const savedFocus = localStorage.getItem('focusMode');
  if (savedFocus === 'enabled') {
    document.body.classList.add('focus-mode');
    if (focusToggle) {
      focusToggle.innerHTML = '<i class="fa-solid fa-compress"></i>';
      focusToggle.title = 'Exit Focus Mode (F)';
    }
  } else {
    document.body.classList.remove('focus-mode');
    if (focusToggle) {
      focusToggle.innerHTML = '<i class="fa-solid fa-expand"></i>';
      focusToggle.title = 'Toggle Focus Mode (F)';
    }
  }
}

function toggleFocusMode() {
  document.body.classList.toggle('focus-mode');
  const isFocus = document.body.classList.contains('focus-mode');
  localStorage.setItem('focusMode', isFocus ? 'enabled' : 'disabled');
  if (focusToggle) {
    focusToggle.innerHTML = isFocus ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
    focusToggle.title = isFocus ? 'Exit Focus Mode (F)' : 'Toggle Focus Mode (F)';
  }
}

// --- Load and Save Progress Stats ---
function loadStats() {
  const savedStats = localStorage.getItem('kalima_stats');
  if (savedStats) {
    try {
      stats = JSON.parse(savedStats);
      // Ensure all keys exist
      if (!stats.known) stats.known = [];
      if (!stats.learning) stats.learning = [];
      if (!stats.seen) stats.seen = [];
    } catch (e) {
      console.error('Failed to parse saved stats, resetting.', e);
    }
  }
}

function saveStats() {
  localStorage.setItem('kalima_stats', JSON.stringify(stats));
  if (typeof queueCloudPush === 'function') {
    queueCloudPush();
  }
}

function saveStars() {
  localStorage.setItem('starredWords', JSON.stringify(Array.from(starredWords)));
  if (typeof queueCloudPush === 'function') {
    queueCloudPush();
  }
}

// --- Save and Load Filter Settings ---
function saveFilterSettings() {
  const settings = {
    posFilter: posFilter ? posFilter.value : 'all',
    coverageFilter: coverageFilter ? coverageFilter.value : 'all',
    freqMinIdx: freqMinInput ? parseInt(freqMinInput.value) : 0,
    freqMaxIdx: freqMaxInput ? parseInt(freqMaxInput.value) : 0,
    starredOnly: starredOnlyToggle ? starredOnlyToggle.checked : false,
    learningMode: learningMode ? learningMode.value : 'random',
    arabicFont: arabicFontSelect ? arabicFontSelect.value : 'default'
  };
  localStorage.setItem('kalima_filters', JSON.stringify(settings));
}

function loadFilterSettings() {
  const saved = localStorage.getItem('kalima_filters');
  if (!saved) {
    // Apply default font initially
    applyArabicFont('default');
    return;
  }
  try {
    const settings = JSON.parse(saved);
    if (posFilter && settings.posFilter) posFilter.value = settings.posFilter;
    if (coverageFilter && settings.coverageFilter) coverageFilter.value = settings.coverageFilter;
    if (starredOnlyToggle && typeof settings.starredOnly === 'boolean') starredOnlyToggle.checked = settings.starredOnly;
    if (learningMode && settings.learningMode) learningMode.value = settings.learningMode;
    if (arabicFontSelect && settings.arabicFont) {
      arabicFontSelect.value = settings.arabicFont;
      applyArabicFont(settings.arabicFont);
    } else {
      applyArabicFont('default');
    }
    
    // Frequency slider indices are restored after uniqueFrequencies is built
    if (freqMinInput && typeof settings.freqMinIdx === 'number') {
      const maxIdx = uniqueFrequencies.length - 1;
      freqMinInput.value = Math.min(settings.freqMinIdx, maxIdx);
    }
    if (freqMaxInput && typeof settings.freqMaxIdx === 'number') {
      const maxIdx = uniqueFrequencies.length - 1;
      freqMaxInput.value = Math.min(settings.freqMaxIdx, maxIdx);
    }
    updateSliderUI();
  } catch (e) {
    console.warn('Failed to load filter settings:', e);
    applyArabicFont('default');
  }
}

function applyArabicFont(fontType) {
  if (fontType === 'amiri') {
    document.body.classList.add('font-amiri');
  } else {
    document.body.classList.remove('font-amiri');
  }
}

// --- Settings Snapshot (for cancel/revert) ---
let _settingsSnapshot = null;

function snapshotSettings() {
  _settingsSnapshot = {
    posFilter: posFilter ? posFilter.value : 'all',
    coverageFilter: coverageFilter ? coverageFilter.value : 'all',
    freqMinIdx: freqMinInput ? parseInt(freqMinInput.value) : 0,
    freqMaxIdx: freqMaxInput ? parseInt(freqMaxInput.value) : 0,
    starredOnly: starredOnlyToggle ? starredOnlyToggle.checked : false,
    hideMastered: hideKnownToggle ? hideKnownToggle.checked : false,
    learningMode: learningMode ? learningMode.value : 'random',
    arabicFont: arabicFontSelect ? arabicFontSelect.value : 'default'
  };
}

function restoreSettings() {
  if (!_settingsSnapshot) return;
  const s = _settingsSnapshot;
  if (posFilter) posFilter.value = s.posFilter;
  if (coverageFilter) coverageFilter.value = s.coverageFilter;
  if (freqMinInput) freqMinInput.value = s.freqMinIdx;
  if (freqMaxInput) freqMaxInput.value = s.freqMaxIdx;
  if (starredOnlyToggle) starredOnlyToggle.checked = s.starredOnly;
  if (hideKnownToggle) {
    hideKnownToggle.checked = s.hideMastered;
    localStorage.setItem('hideMastered', String(s.hideMastered));
  }
  if (learningMode) learningMode.value = s.learningMode;
  if (arabicFontSelect) {
    arabicFontSelect.value = s.arabicFont;
    applyArabicFont(s.arabicFont);
  }
  updateSliderUI();
  applyFilterAndReset();
  _settingsSnapshot = null;
}

// --- Fetch Data ---
async function fetchWords() {
  try {
    const response = await fetch('assets/words.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    allWords = await response.json();
    
    // Sort allWords descending by frequency to calculate cumulative percentiles
    allWords.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
    
    // Migrate progress stats and starred words keys if they are in the old format
    migrateAllKeys(allWords);
    
    const totalFrequency = allWords.reduce((sum, w) => sum + (w.frequency || 0), 0);
    let runningCumulative = 0;
    allWords.forEach(w => {
      w.cumulativePercent = (runningCumulative / totalFrequency) * 100;
      runningCumulative += (w.frequency || 0);
    });
    
    // Extract and sort unique frequencies
    uniqueFrequencies = Array.from(new Set(allWords.map(w => w.frequency || 0))).sort((a, b) => a - b);
    
    // Initialize slider ranges
    if (freqMinInput && freqMaxInput) {
      freqMinInput.max = uniqueFrequencies.length - 1;
      freqMaxInput.max = uniqueFrequencies.length - 1;
      freqMinInput.value = 0;
      freqMaxInput.value = uniqueFrequencies.length - 1;
      updateSliderUI();
    }

    // Restore saved filter settings (must happen after slider ranges are set)
    loadFilterSettings();
    
    applyFilterAndReset();
  } catch (error) {
    console.error('Error fetching words:', error);
    arabicWord.textContent = 'خطأ';
    arabicWord.style.fontSize = '3rem';
    wordTransliteration.textContent = 'Failed to load words.json';
    wordMeaning.textContent = 'Please make sure words.json is present in the assets folder.';
  }
}

// --- Filter & Order Controls ---
// --- Slider UI update ---
function updateSliderUI() {
  if (!freqMinInput || !freqMaxInput || !freqMinVal || !freqMaxVal || !sliderTrack || uniqueFrequencies.length === 0) return;
  
  const minIdx = parseInt(freqMinInput.value);
  const maxIdx = parseInt(freqMaxInput.value);
  const minFreq = uniqueFrequencies[minIdx];
  const maxFreq = uniqueFrequencies[maxIdx];
  
  freqMinVal.textContent = minFreq.toLocaleString();
  freqMaxVal.textContent = maxFreq.toLocaleString();
  
  const totalSteps = uniqueFrequencies.length - 1;
  const percentMin = (minIdx / totalSteps) * 100;
  const percentMax = (maxIdx / totalSteps) * 100;
  
  sliderTrack.style.left = percentMin + '%';
  sliderTrack.style.right = (100 - percentMax) + '%';
}

function applyFilterAndReset(skipCardLoad = false) {
  const posVal = posFilter ? posFilter.value : 'all';
  const coverageVal = coverageFilter ? coverageFilter.value : 'all';
  
  // 1. Apply frequency and starred filtering
  let tempWords = [...allWords];
  
  // Apply Starred filter if toggle is active
  if (starredOnlyToggle && starredOnlyToggle.checked) {
    tempWords = tempWords.filter(w => {
      const key = getWordKey(w);
      return starredWords.has(key);
    });
  }

  // Apply cumulative coverage filter
  if (coverageVal !== 'all') {
    const threshold = parseFloat(coverageVal);
    tempWords = tempWords.filter(w => w.cumulativePercent < threshold);
  }
  
  // Apply frequency range filter
  if (uniqueFrequencies.length > 0 && freqMinInput && freqMaxInput) {
    const minIdx = parseInt(freqMinInput.value);
    const maxIdx = parseInt(freqMaxInput.value);
    const minFreq = uniqueFrequencies[minIdx];
    const maxFreq = uniqueFrequencies[maxIdx];
    
    tempWords = tempWords.filter(w => w.frequency >= minFreq && w.frequency <= maxFreq);
  }

  // 2. Apply part-of-speech filtering
  let tempFilteredForStats;
  if (posVal === 'verbs') {
    tempFilteredForStats = tempWords.filter(w => w.part_of_speech && w.part_of_speech.toLowerCase().startsWith('verb'));
  } else if (posVal === 'nouns') {
    tempFilteredForStats = tempWords.filter(w => w.part_of_speech && (w.part_of_speech.toLowerCase().includes('noun') || w.part_of_speech.toLowerCase() === 'noun'));
  } else if (posVal === 'particles') {
    tempFilteredForStats = tempWords.filter(w => w.part_of_speech && (
      w.part_of_speech.toLowerCase().includes('particle') || 
      w.part_of_speech.toLowerCase().includes('preposition') || 
      w.part_of_speech.toLowerCase().includes('conjunction') ||
      w.part_of_speech.toLowerCase().includes('pronoun')
    ));
  } else {
    tempFilteredForStats = tempWords;
  }

  // Sort and store the words matching active filters (excluding "Hide Mastered")
  filteredWordsForStats = [...tempFilteredForStats];
  filteredWordsForStats.sort((a, b) => b.frequency - a.frequency);

  // Apply Hide Mastered filter if toggle is active for the deck
  if (hideKnownToggle && hideKnownToggle.checked) {
    filteredWords = filteredWordsForStats.filter(w => !stats.known.includes(getWordKey(w)));
  } else {
    filteredWords = [...filteredWordsForStats];
  }

  // Reset navigation history
  historyStack = [];
  historyPointer = -1;

  // Update live word count display
  const countEl = document.getElementById('filtered-word-count');
  if (countEl) {
    countEl.textContent = `(${filteredWords.length.toLocaleString()} words)`;
  }

  if (skipCardLoad) {
    updateStatsDisplay();
  } else {
    if (filteredWords.length > 0) {
      loadNextCard(true); // Load first card
    } else {
      showEmptyState();
    }
    updateStatsDisplay();
  }
}

function showEmptyState() {
  arabicWord.textContent = 'خالي';
  wordTransliteration.textContent = 'No words match filter';
  wordMeaning.textContent = 'Try choosing a different category.';
  freqTagFront.innerHTML = '<i class="fa-solid fa-wave-square"></i> Freq: 0';
  freqTagBack.innerHTML = '<i class="fa-solid fa-wave-square"></i> Freq: 0';
  posTagFront.style.display = 'none';
  posTagBack.style.display = 'none';
  if (rootWrapper) rootWrapper.style.display = 'none';
  cardIndexFront.textContent = 'Word 0/0';
  cardIndexBack.textContent = 'Word 0/0';
  currentWord = null;
  disableAssessment();
}

// --- Navigation Logic ---
function loadNextCard(isFirst = false) {
  if (filteredWords.length === 0) return;

  // Close card flip state before updating content
  closeCardFlip();

  setTimeout(() => {
    let nextIndex;

    // Check if we are browsing history
    if (historyPointer < historyStack.length - 1 && !isFirst) {
      historyPointer++;
      nextIndex = historyStack[historyPointer];
    } else {
      // Choose next card index based on mode
      const mode = learningMode.value;
      if (mode === 'random') {
        nextIndex = getRandomIndex();
      } else {
        // Sequential
        if (historyStack.length === 0) {
          nextIndex = 0;
        } else {
          const lastIndex = historyStack[historyStack.length - 1];
          nextIndex = (lastIndex + 1) % filteredWords.length;
        }
      }
      // Add to history stack
      historyStack.push(nextIndex);
      historyPointer = historyStack.length - 1;
    }

    displayWord(nextIndex);
  }, isFirst ? 0 : 200); // Small delay to let card spin back if it was flipped
}

function loadPrevCard() {
  if (historyPointer <= 0) return;

  closeCardFlip();

  setTimeout(() => {
    historyPointer--;
    const prevIndex = historyStack[historyPointer];
    displayWord(prevIndex);
  }, 200);
}

// Choose a random index, preferably one not already seen in the current stack
function getRandomIndex() {
  if (filteredWords.length <= 1) return 0;
  
  // Find indices that haven't been visited in the last history cycle
  const recentHistory = historyStack.slice(-Math.min(filteredWords.length - 1, 10));
  let availableIndices = [];
  for (let i = 0; i < filteredWords.length; i++) {
    if (!recentHistory.includes(i)) {
      availableIndices.push(i);
    }
  }

  // Fallback if somehow all are recently visited
  if (availableIndices.length === 0) {
    availableIndices = Array.from({length: filteredWords.length}, (_, i) => i);
  }

  const randomIndex = Math.floor(Math.random() * availableIndices.length);
  return availableIndices[randomIndex];
}

// Display the selected word index
function displayWord(index) {
  currentWord = filteredWords[index];
  updateStarUI();
  
  // Apply a smooth card enter animation
  flashcard.classList.add('scale-down');
  
  // If it was swiped (opacity is 0), fade it back in smoothly
  if (flashcard.style.opacity === '0') {
    flashcard.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    flashcard.style.opacity = '1';
  }
  
  setTimeout(() => {
    // Populate elements
    arabicWord.textContent = currentWord.arabic;
    wordTransliteration.textContent = BuckwalterConverter.toPhonetic(currentWord.transliteration);
    
    arabicWordMini.textContent = currentWord.arabic;
    wordTransliterationMini.textContent = BuckwalterConverter.toPhonetic(currentWord.transliteration);
    
    if (currentWord.meanings && currentWord.meanings.length > 0) {
      const combinedMeaning = currentWord.meanings.join(', ');
      wordMeaning.textContent = combinedMeaning.charAt(0).toUpperCase() + combinedMeaning.slice(1);
    } else {
      wordMeaning.textContent = 'No translation available';
    }
    
    // Set Study Corpus Link
    if (corpusLink) {
      if (currentWord.url) {
        corpusLink.href = currentWord.url;
        corpusLink.parentElement.style.display = 'block';
      } else {
        corpusLink.href = '#';
        corpusLink.parentElement.style.display = 'none';
      }
    }
    
    const formattedFreq = Number(currentWord.frequency).toLocaleString();
    freqTagFront.innerHTML = `<i class="fa-solid fa-wave-square"></i> Freq: ${formattedFreq}`;
    freqTagBack.innerHTML = `<i class="fa-solid fa-wave-square"></i> Freq: ${formattedFreq}`;
    
    // Part of speech
    const partOfSpeech = currentWord.part_of_speech || '';
    if (partOfSpeech) {
      posTagFront.textContent = partOfSpeech;
      posTagFront.style.display = 'inline-flex';
      posTagBack.textContent = partOfSpeech;
      posTagBack.style.display = 'inline-flex';
    } else {
      posTagFront.style.display = 'none';
      posTagBack.style.display = 'none';
    }

    // Root
    const wordRootVal = currentWord.root || '';
    if (wordRootVal && rootWrapper && wordRoot) {
      wordRoot.textContent = wordRootVal;
      rootWrapper.style.display = 'block';
    } else if (rootWrapper) {
      rootWrapper.style.display = 'none';
    }
    
    // Index indicator
    const currentNum = index + 1;
    const totalNum = filteredWords.length;
    cardIndexFront.textContent = `Word ${currentNum}/${totalNum}`;
    cardIndexBack.textContent = `Word ${currentNum}/${totalNum}`;
    
    // Add to seen stats if not already added
    markAsSeen(getWordKey(currentWord));
    
    // Sync star icons state
    updateStarUI();

    // Update navigation button states
    prevBtn.disabled = (historyPointer <= 0);
    
    // Remove scale animation
    flashcard.classList.remove('scale-down');
    
    // Clear inline transition after animation completes
    setTimeout(() => {
      flashcard.style.transition = '';
      if (flashcard.style.opacity === '1') {
        flashcard.style.opacity = '';
      }
    }, 300);
    
    updateStatsDisplay();
  }, 100);
}

// Display a word directly without requiring it to be in filteredWords.
// Used by search to show any word without resetting user filters.
function displayWordDirectly(word) {
  currentWord = word;
  updateStarUI();

  flashcard.classList.add('scale-down');

  if (flashcard.style.opacity === '0') {
    flashcard.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    flashcard.style.opacity = '1';
  }

  setTimeout(() => {
    arabicWord.textContent = currentWord.arabic;
    wordTransliteration.textContent = BuckwalterConverter.toPhonetic(currentWord.transliteration);

    arabicWordMini.textContent = currentWord.arabic;
    wordTransliterationMini.textContent = BuckwalterConverter.toPhonetic(currentWord.transliteration);

    if (currentWord.meanings && currentWord.meanings.length > 0) {
      const combinedMeaning = currentWord.meanings.join(', ');
      wordMeaning.textContent = combinedMeaning.charAt(0).toUpperCase() + combinedMeaning.slice(1);
    } else {
      wordMeaning.textContent = 'No translation available';
    }

    if (corpusLink) {
      if (currentWord.url) {
        corpusLink.href = currentWord.url;
        corpusLink.parentElement.style.display = 'block';
      } else {
        corpusLink.href = '#';
        corpusLink.parentElement.style.display = 'none';
      }
    }

    const formattedFreq = Number(currentWord.frequency).toLocaleString();
    freqTagFront.innerHTML = `<i class="fa-solid fa-wave-square"></i> Freq: ${formattedFreq}`;
    freqTagBack.innerHTML = `<i class="fa-solid fa-wave-square"></i> Freq: ${formattedFreq}`;

    const partOfSpeech = currentWord.part_of_speech || '';
    if (partOfSpeech) {
      posTagFront.textContent = partOfSpeech;
      posTagFront.style.display = 'inline-flex';
      posTagBack.textContent = partOfSpeech;
      posTagBack.style.display = 'inline-flex';
    } else {
      posTagFront.style.display = 'none';
      posTagBack.style.display = 'none';
    }

    const wordRootVal = currentWord.root || '';
    if (wordRootVal && rootWrapper && wordRoot) {
      wordRoot.textContent = wordRootVal;
      rootWrapper.style.display = 'block';
    } else if (rootWrapper) {
      rootWrapper.style.display = 'none';
    }

    // Show global position since the word may not be in the filtered set
    const globalPos = allWords.indexOf(currentWord) + 1;
    cardIndexFront.textContent = `Word ${globalPos}/${allWords.length}`;
    cardIndexBack.textContent = `Word ${globalPos}/${allWords.length}`;

    markAsSeen(getWordKey(currentWord));
    updateStarUI();
    prevBtn.disabled = (historyPointer <= 0);

    flashcard.classList.remove('scale-down');

    setTimeout(() => {
      flashcard.style.transition = '';
      if (flashcard.style.opacity === '1') {
        flashcard.style.opacity = '';
      }
    }, 300);

    updateStatsDisplay();
  }, 100);
}

// --- Assessment & Mastery Tracker ---
function markAsSeen(wordKey) {
  if (!stats.seen.includes(wordKey)) {
    stats.seen.push(wordKey);
    saveStats();
  }
  wordsReviewedInSession++;
  if (typeof checkGuestSignInPrompt === 'function') {
    checkGuestSignInPrompt();
  }
}

function markAsKnown() {
  if (!currentWord) return;
  const key = getWordKey(currentWord);
  
  // Add to known, remove from learning
  if (!stats.known.includes(key)) {
    stats.known.push(key);
  }
  stats.learning = stats.learning.filter(w => w !== key);
  
  saveStats();
  animateButtonFeedback(yesBtn);

  if (hideKnownToggle && hideKnownToggle.checked) {
    const currentIdx = filteredWords.findIndex(w => getWordKey(w) === key);
    if (currentIdx !== -1) {
      handleKnownWordRemoval(currentIdx);
      if (filteredWords.length > 0) {
        loadNextCard();
      } else {
        showEmptyState();
      }
      return;
    }
  }
  
  loadNextCard();
}

function handleKnownWordRemoval(removedIndex) {
  // 1. Remove the word from filteredWords
  filteredWords.splice(removedIndex, 1);
  
  // 2. Adjust historyStack indices
  historyStack = historyStack
    .map(idx => {
      if (idx === removedIndex) return null;
      return idx > removedIndex ? idx - 1 : idx;
    })
    .filter(idx => idx !== null);
    
  // 3. Adjust historyPointer
  historyPointer = historyStack.length - 1;
  
  // 4. Update stats count displays
  const countEl = document.getElementById('filtered-word-count');
  if (countEl) {
    countEl.textContent = `(${filteredWords.length.toLocaleString()} words)`;
  }
  updateStatsDisplay();
}

function markAsLearning() {
  if (!currentWord) return;
  const key = getWordKey(currentWord);
  
  // Add to learning, remove from known
  if (!stats.learning.includes(key)) {
    stats.learning.push(key);
  }
  stats.known = stats.known.filter(w => w !== key);
  
  saveStats();
  animateButtonFeedback(noBtn);
  loadNextCard();
}

// Button visual ripple/glow feedback
function animateButtonFeedback(btn) {
  btn.style.transform = 'scale(0.95)';
  setTimeout(() => {
    btn.style.transform = '';
  }, 150);
}

// --- Card Flip Interactions ---
function toggleCardFlip() {
  if (!currentWord) return;
  isFlipped = !isFlipped;
  flashcard.style.transform = ''; // Clear inline transform from swipes
  flashcard.classList.toggle('is-flipped', isFlipped);
  
  // Set accessibility tags
  flashcard.setAttribute('aria-expanded', isFlipped);
}

function closeCardFlip() {
  isFlipped = false;
  flashcard.classList.remove('is-flipped');
  flashcard.style.transform = ''; // Clear inline transform from swipes
  flashcard.setAttribute('aria-expanded', 'false');
}

function enableAssessment() {
  // Permanently enabled
}

function disableAssessment() {
  // Permanently enabled
}

// --- Stats Display Updates ---
function updateStatsDisplay() {
  // Count stats specifically for the CURRENT list of filtered words (including hidden mastered words)
  const filteredKeys = new Set(filteredWordsForStats.map(w => getWordKey(w)));
  
  const seenCount = stats.seen.filter(w => filteredKeys.has(w)).length;
  const knownCount = stats.known.filter(w => filteredKeys.has(w)).length;
  const learningCount = stats.learning.filter(w => filteredKeys.has(w)).length;
  
  const totalInFilter = filteredWordsForStats.length;
  const remainingCount = Math.max(0, totalInFilter - knownCount);

  // Update DOM elements
  statsSeen.textContent = seenCount;
  statsKnown.textContent = knownCount;
  statsLearning.textContent = learningCount;
  statsRemaining.textContent = remainingCount;

  // Progress Bar (Percent of current subset marked as known/mastered)
  const percentage = totalInFilter > 0 ? Math.round((knownCount / totalInFilter) * 100) : 0;
  scorePercentage.textContent = `${percentage}%`;
  sessionProgress.style.width = `${percentage}%`;
}

function resetSessionStats() {
  if (confirm('Are you sure you want to clear your learning progress? This will reset all mastery and history statistics.')) {
    stats = {
      known: [],
      learning: [],
      seen: []
    };
    saveStats();
    applyFilterAndReset();
  }
}

// --- Text to Speech (Arabic Pronunciation) ---
function speakArabic(text) {
  if (!text) return;
  if ('speechSynthesis' in window) {
    // Cancel any active speech first
    window.speechSynthesis.cancel();
    
    // Clean text: strip out non-Arabic characters for clean TTS engine reading
    const cleanText = text.replace(/[^\u0600-\u06FF\s]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    
    // Find a native Arabic voice if available
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find(v => v.lang.startsWith('ar'));
    if (arVoice) {
      utterance.voice = arVoice;
    }
    
    utterance.rate = 0.75; // Slower speed for clear educational guidance
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('Text-to-speech is not supported in this browser.');
  }
}

// Trigger browser voice listing load asynchronously
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}

// --- Star / Bookmark Management ---
let starredWords = new Set(JSON.parse(localStorage.getItem('starredWords')) || []);

function updateStarUI() {
  if (!currentWord || !starBtnFront || !starBtnBack) return;
  const wordKey = getWordKey(currentWord);
  const isStarred = starredWords.has(wordKey);
  
  if (isStarred) {
    starBtnFront.classList.add('starred');
    starBtnFront.querySelector('i').className = 'fa-solid fa-star';
    starBtnBack.classList.add('starred');
    starBtnBack.querySelector('i').className = 'fa-solid fa-star';
    starBtnFront.title = 'Unstar this word';
    starBtnBack.title = 'Unstar this word';
  } else {
    starBtnFront.classList.remove('starred');
    starBtnFront.querySelector('i').className = 'fa-regular fa-star';
    starBtnBack.classList.remove('starred');
    starBtnBack.querySelector('i').className = 'fa-regular fa-star';
    starBtnFront.title = 'Star this word';
    starBtnBack.title = 'Star this word';
  }
}

function toggleStarCurrentWord(e) {
  if (e) {
    e.stopPropagation(); // Avoid triggering card flip
  }
  if (!currentWord) return;
  const wordKey = getWordKey(currentWord);
  
  if (starredWords.has(wordKey)) {
    starredWords.delete(wordKey);
  } else {
    starredWords.add(wordKey);
  }
  
  saveStars();
  updateStarUI();
  
  // Re-filter and reload deck if in "starred words only" filter mode
  if (starredOnlyToggle && starredOnlyToggle.checked) {
    applyFilterAndReset();
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Track mouse coordinates & time to prevent flips on drag/selection on desktop
  let mousedownX = 0;
  let mousedownY = 0;
  let mousedownTime = 0;

  flashcard.addEventListener('mousedown', (e) => {
    mousedownX = e.clientX;
    mousedownY = e.clientY;
    mousedownTime = Date.now();
  });

  // Card click flips the card (with text selection checks)
  flashcard.addEventListener('click', (e) => {
    // Ignore click if it's on a button, link, or interactive element
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }

    // Do not flip if clicking directly on selectable text elements
    if (e.target.closest('.arabic-text, .transliteration, .arabic-mini, .transliteration-mini, .meaning-text, #root-wrapper')) {
      return;
    }

    // Do not flip if mouse moved significantly (drag selection)
    const deltaX = e.clientX - mousedownX;
    const deltaY = e.clientY - mousedownY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > 5) {
      return;
    }

    // Do not flip if click was held down long (drag selection)
    if (Date.now() - mousedownTime > 250) {
      return;
    }

    // Secondary safeguard: do not flip if user has selected text
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      return;
    }

    toggleCardFlip();
  });
  
  // Swipe Gestures
  let touchStartX = null;
  let touchStartY = null;
  let isHorizontalSwipe = false;
  let isSwipeAction = false;
  let hasMoved = false;

  flashcard.addEventListener('touchstart', (e) => {
    // Ignore touch if it originated from a button, link, or interactive element
    if (e.target.closest('button') || e.target.closest('a')) {
      touchStartX = null;
      return;
    }
    
    const touch = e.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isHorizontalSwipe = false;
    isSwipeAction = false;
    hasMoved = false;
  }, { passive: true });

  flashcard.addEventListener('touchmove', (e) => {
    if (touchStartX === null) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      hasMoved = true;
    }

    // Determine if horizontal swipe
    if (!isHorizontalSwipe && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isHorizontalSwipe = true;
    }

    if (isHorizontalSwipe) {
      if (e.cancelable) {
        e.preventDefault(); // Prevent native horizontal scroll / back-swipe page navigation
      }
      
      isSwipeAction = true;
      const currentFlip = isFlipped ? ' rotateY(180deg)' : '';
      const rotation = deltaX * 0.08;
      flashcard.style.transition = 'none';
      flashcard.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)${currentFlip}`;

      // Update swipe border color dynamically
      if (deltaX > 0) {
        // Swiping right: I Knew It (Green)
        const opacity = Math.min(deltaX / 120, 1);
        flashcard.style.setProperty('--swipe-border-color', `rgba(16, 185, 129, ${0.08 + opacity * 0.92})`);
      } else {
        // Swiping left: Still Learning (Orange)
        const opacity = Math.min(Math.abs(deltaX) / 120, 1);
        flashcard.style.setProperty('--swipe-border-color', `rgba(245, 158, 11, ${0.08 + opacity * 0.92})`);
      }
    }
  }, { passive: false });

  flashcard.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    touchStartX = null; // Reset for next touch

    // Reset swipe border color custom property
    flashcard.style.removeProperty('--swipe-border-color');

    if (!hasMoved) {
      // Do not flip if tapping directly on selectable text elements
      if (e.target.closest('.arabic-text, .transliteration, .arabic-mini, .transliteration-mini, .meaning-text, #root-wrapper')) {
        return;
      }

      // Secondary safeguard: do not flip if user has selected text
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== '') {
        return;
      }

      e.preventDefault();
      toggleCardFlip();
    } else if (isSwipeAction) {
      e.preventDefault();
      
      if (Math.abs(deltaX) > 120) {
        // Complete swipe
        const currentFlip = isFlipped ? ' rotateY(180deg)' : '';
        flashcard.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
        flashcard.style.transform = `translateX(${deltaX > 0 ? 600 : -600}px) rotate(${deltaX > 0 ? 30 : -30}deg)${currentFlip}`;
        flashcard.style.opacity = '0';

        setTimeout(() => {
          // Reset card styling off-screen so it starts clean
          flashcard.style.transition = 'none';
          flashcard.style.transform = '';
          
          // Trigger actions
          if (deltaX > 0) {
            markAsKnown();
          } else {
            markAsLearning();
          }
        }, 250);
      } else {
        // Cancel swipe
        const currentFlip = isFlipped ? ' rotateY(180deg)' : '';
        flashcard.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.15), opacity 0.3s ease-out';
        flashcard.style.transform = `translateX(0px) rotate(0deg)${currentFlip}`;
        flashcard.style.opacity = '1';
        
        setTimeout(() => {
          flashcard.style.transition = '';
          flashcard.style.transform = '';
        }, 300);
      }
    }
  }, { passive: false });

  flashcard.addEventListener('touchcancel', () => {
    touchStartX = null;
    flashcard.style.removeProperty('--swipe-border-color');
    flashcard.style.transition = '';
    flashcard.style.transform = '';
    flashcard.style.opacity = '';
  });
  
  // Stop propagation and prevent default page reset on corpus study link click
  if (corpusLink) {
    corpusLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = corpusLink.href;
      if (url && url !== '#' && !url.endsWith('#')) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }
  
  // Audio speaker buttons click listeners
  if (speakBtnFront) {
    speakBtnFront.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering card flip
      if (currentWord) speakArabic(currentWord.arabic);
    });
  }
  
  if (speakBtnBack) {
    speakBtnBack.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering card flip
      if (currentWord) speakArabic(currentWord.arabic);
    });
  }
  
  // Star button click listeners
  if (starBtnFront) {
    starBtnFront.addEventListener('click', toggleStarCurrentWord);
  }
  
  if (starBtnBack) {
    starBtnBack.addEventListener('click', toggleStarCurrentWord);
  }
  
  // Card keyboard trigger (Enter/Space on focus)
  flashcard.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleCardFlip();
    }
  });

  // Navigation click handlers
  nextBtn.addEventListener('click', () => loadNextCard());
  prevBtn.addEventListener('click', loadPrevCard);

  // Assessment answers
  yesBtn.addEventListener('click', markAsKnown);
  noBtn.addEventListener('click', markAsLearning);

  // Reset
  resetBtn.addEventListener('click', resetSessionStats);

  // Export Stats
  if (exportStats) {
    exportStats.addEventListener('click', () => {
      const backupData = {
        app: 'KalimaCards',
        version: '1.0',
        timestamp: new Date().toISOString(),
        stats: stats,
        starredWords: Array.from(starredWords)
      };
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `kalimacards-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  // Import Stats triggers hidden input click
  if (importStats && importFileInput) {
    importStats.addEventListener('click', () => {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.value ? importFileInput.files[0] : null;
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const data = JSON.parse(evt.target.result);
          
          if (data.app !== 'KalimaCards') {
            alert('Invalid file format. Please upload a valid KalimaCards backup file.');
            return;
          }
          
          if (confirm('Are you sure you want to import this progress backup? This will overwrite all your current learning status counters and starred bookmarks.')) {
            if (data.stats) {
              stats = {
                known: data.stats.known || [],
                learning: data.stats.learning || [],
                seen: data.stats.seen || []
              };
            }
            
            if (data.starredWords) {
              starredWords = new Set(data.starredWords);
            }
            
            migrateAllKeys(allWords);
            
            saveStats();
            saveStars();
            
            applyFilterAndReset();
            alert('Progress backup restored successfully!');
          }
        } catch (err) {
          alert('Failed to parse backup file: ' + err.message);
        }
        importFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // Filters & Settings
  if (starredOnlyToggle) {
    starredOnlyToggle.addEventListener('change', () => {
      applyFilterAndReset();
    });
  }

  if (hideKnownToggle) {
    const savedHideMastered = localStorage.getItem('hideMastered') === 'true';
    hideKnownToggle.checked = savedHideMastered;
    
    hideKnownToggle.addEventListener('change', () => {
      applyFilterAndReset();
    });
  }

  const minGap = 0;
  function handleMinSliderInput() {
    let minVal = parseInt(freqMinInput.value);
    let maxVal = parseInt(freqMaxInput.value);
    if (minVal > maxVal - minGap) {
      freqMinInput.value = maxVal - minGap;
    }
    if (freqMinInput && freqMaxInput) {
      freqMinInput.style.zIndex = "10";
      freqMaxInput.style.zIndex = "9";
    }
    updateSliderUI();
    applyFilterAndReset();
  }

  function handleMaxSliderInput() {
    let minVal = parseInt(freqMinInput.value);
    let maxVal = parseInt(freqMaxInput.value);
    if (maxVal < minVal + minGap) {
      freqMaxInput.value = minVal + minGap;
    }
    if (freqMinInput && freqMaxInput) {
      freqMaxInput.style.zIndex = "10";
      freqMinInput.style.zIndex = "9";
    }
    updateSliderUI();
    applyFilterAndReset();
  }

  if (freqMinInput && freqMaxInput) {
    freqMinInput.addEventListener('input', handleMinSliderInput);
    freqMaxInput.addEventListener('input', handleMaxSliderInput);
  }

  if (posFilter) {
    posFilter.addEventListener('change', () => {
      applyFilterAndReset();
    });
  }

  if (coverageFilter) {
    coverageFilter.addEventListener('change', () => {
      const val = coverageFilter.value;
      if (val === 'all') {
        if (freqMinInput) freqMinInput.value = 0;
        if (freqMaxInput) freqMaxInput.value = uniqueFrequencies.length - 1;
      } else {
        const threshold = parseFloat(val);
        const subset = allWords.filter(w => w.cumulativePercent < threshold);
        if (subset.length > 0) {
          let minFreq = Infinity;
          let maxFreq = -Infinity;
          for (let i = 0; i < subset.length; i++) {
            const f = subset[i].frequency || 0;
            if (f < minFreq) minFreq = f;
            if (f > maxFreq) maxFreq = f;
          }
          if (uniqueFrequencies.length > 0) {
            const minIdx = uniqueFrequencies.indexOf(minFreq);
            const maxIdx = uniqueFrequencies.indexOf(maxFreq);
            if (freqMinInput && minIdx !== -1) freqMinInput.value = minIdx;
            if (freqMaxInput && maxIdx !== -1) freqMaxInput.value = maxIdx;
          }
        }
      }
      updateSliderUI();
      applyFilterAndReset();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (starredOnlyToggle) starredOnlyToggle.checked = false;
      if (hideKnownToggle) {
        hideKnownToggle.checked = false;
        localStorage.setItem('hideMastered', 'false');
      }
      if (freqMinInput) freqMinInput.value = 0;
      if (freqMaxInput) freqMaxInput.value = uniqueFrequencies.length - 1;
      if (posFilter) posFilter.value = 'all';
      if (coverageFilter) coverageFilter.value = 'all';
      if (searchInput) {
        searchInput.value = '';
        if (clearSearch) clearSearch.style.display = 'none';
        if (searchResults) {
          searchResults.style.display = 'none';
          searchResults.innerHTML = '';
        }
      }
      if (arabicFontSelect) {
        arabicFontSelect.value = 'default';
        applyArabicFont('default');
      }
      updateSliderUI();
      saveFilterSettings();
      applyFilterAndReset();
    });
  }

  if (arabicFontSelect) {
    arabicFontSelect.addEventListener('change', () => {
      applyArabicFont(arabicFontSelect.value);
    });
  }

  learningMode.addEventListener('change', () => {
    // If switching learning mode, clear history so the order refreshes
    historyStack = [];
    historyPointer = -1;
    if (filteredWords.length > 0) {
      loadNextCard(true);
    }
  });

  // Theme Switcher
  themeToggle.addEventListener('click', toggleTheme);

  // Focus Mode Switcher
  if (focusToggle) {
    focusToggle.addEventListener('click', toggleFocusMode);
  }

  // Settings Modal Switcher
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (settingsModalOverlay) {
        snapshotSettings();
        settingsModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  }

  if (settingsModalClose) {
    settingsModalClose.addEventListener('click', () => {
      if (settingsModalOverlay) {
        settingsModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        restoreSettings();
      }
    });
  }

  if (applySettingsBtn) {
    applySettingsBtn.addEventListener('click', () => {
      if (settingsModalOverlay) {
        // Persist current settings and discard the snapshot
        if (hideKnownToggle) localStorage.setItem('hideMastered', hideKnownToggle.checked);
        saveFilterSettings();
        _settingsSnapshot = null;
        settingsModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  if (settingsModalOverlay) {
    settingsModalOverlay.addEventListener('click', (e) => {
      if (e.target === settingsModalOverlay) {
        settingsModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        restoreSettings();
      }
    });
  }

  // Escape key support to close Settings modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModalOverlay && settingsModalOverlay.classList.contains('active')) {
      settingsModalOverlay.classList.remove('active');
      document.body.style.overflow = '';
      restoreSettings();
    }
  });

  // --- Search / Dictionary Event Listeners ---
  if (searchInput && searchResults && clearSearch) {
    let selectedSearchIndex = -1;
    let currentSearchResults = [];

    const performSearch = () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        clearSearch.style.display = 'none';
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
        currentSearchResults = [];
        selectedSearchIndex = -1;
        return;
      }
      
      clearSearch.style.display = 'flex';
      
      currentSearchResults = allWords.map((w, globalIndex) => ({ ...w, globalIndex }))
        .filter(w => {
          const arabicMatch = w.arabic.includes(query);
          const translitMatch = w.transliteration.toLowerCase().includes(query);
          const meaningsMatch = w.meanings && w.meanings.some(m => m.toLowerCase().includes(query));
          return arabicMatch || translitMatch || meaningsMatch;
        })
        .slice(0, 10); // Limit to top 10 results for performance
        
      renderSearchResults();
    };

    const renderSearchResults = () => {
      searchResults.innerHTML = '';
      if (currentSearchResults.length === 0) {
        searchResults.innerHTML = '<div class="search-result-no-match">No matching words found</div>';
        searchResults.style.display = 'block';
        selectedSearchIndex = -1;
        return;
      }
      
      currentSearchResults.forEach((result, idx) => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        if (idx === selectedSearchIndex) {
          item.classList.add('selected');
        }
        
        const leftCol = document.createElement('div');
        leftCol.className = 'search-result-left';
        
        const translitHeader = document.createElement('div');
        translitHeader.style.display = 'flex';
        translitHeader.style.alignItems = 'center';
        translitHeader.style.gap = '8px';
        
        const translit = document.createElement('span');
        translit.className = 'search-result-translit';
        translit.textContent = BuckwalterConverter.toPhonetic(result.transliteration);
        translitHeader.appendChild(translit);
        
        if (result.part_of_speech) {
          const posBadge = document.createElement('span');
          posBadge.style.fontSize = '0.65rem';
          posBadge.style.background = 'var(--color-success-bg)';
          posBadge.style.color = 'var(--color-success)';
          posBadge.style.padding = '1px 6px';
          posBadge.style.borderRadius = '10px';
          posBadge.style.fontWeight = '600';
          posBadge.textContent = result.part_of_speech;
          translitHeader.appendChild(posBadge);
        }
        
        const meaningsText = document.createElement('span');
        meaningsText.className = 'search-result-meaning';
        meaningsText.textContent = result.meanings.join(', ');
        
        leftCol.appendChild(translitHeader);
        leftCol.appendChild(meaningsText);
        
        const rightCol = document.createElement('div');
        rightCol.className = 'search-result-arabic';
        rightCol.textContent = result.arabic;
        
        item.appendChild(leftCol);
        item.appendChild(rightCol);
        
        item.addEventListener('click', () => {
          jumpToWord(result.globalIndex);
        });
        
        searchResults.appendChild(item);
      });
      
      searchResults.style.display = 'block';
    };

    const jumpToWord = (globalIndex) => {
      const targetWord = allWords[globalIndex];
      let filteredIdx = filteredWords.indexOf(targetWord);
      
      closeCardFlip();

      if (filteredIdx !== -1) {
        // Word is in the current filtered set — navigate to it normally
        historyStack.push(filteredIdx);
        historyPointer = historyStack.length - 1;
        displayWord(filteredIdx);
      } else {
        // Word is outside current filters — display it directly without resetting filters
        displayWordDirectly(targetWord);
      }

      if (flashcard) {
        flashcard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      searchInput.value = '';
      clearSearch.style.display = 'none';
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      currentSearchResults = [];
      selectedSearchIndex = -1;
    };

    searchInput.addEventListener('input', performSearch);
    
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentSearchResults.length > 0) {
          selectedSearchIndex = (selectedSearchIndex + 1) % currentSearchResults.length;
          renderSearchResults();
          const activeItem = searchResults.children[selectedSearchIndex];
          if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentSearchResults.length > 0) {
          selectedSearchIndex = (selectedSearchIndex - 1 + currentSearchResults.length) % currentSearchResults.length;
          renderSearchResults();
          const activeItem = searchResults.children[selectedSearchIndex];
          if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedSearchIndex >= 0 && selectedSearchIndex < currentSearchResults.length) {
          jumpToWord(currentSearchResults[selectedSearchIndex].globalIndex);
        } else if (currentSearchResults.length > 0) {
          jumpToWord(currentSearchResults[0].globalIndex);
        }
      } else if (e.key === 'Escape') {
        searchResults.style.display = 'none';
      }
    });

    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      clearSearch.style.display = 'none';
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      currentSearchResults = [];
      selectedSearchIndex = -1;
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target) && !clearSearch.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });
  }

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore keyboard shortcuts if user is focusing a select dropdown or input field
    if (document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'INPUT') return;

    if (e.key === ' ' && !isFlipped) {
      e.preventDefault();
      toggleCardFlip();
    } else if (e.key === ' ' && isFlipped) {
      // Space on flipped card can act as "Next"
      e.preventDefault();
      loadNextCard();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      loadNextCard();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      loadPrevCard();
    } else if (e.key === '1') {
      e.preventDefault();
      markAsLearning();
    } else if (e.key === '2') {
      e.preventDefault();
      markAsKnown();
    } else if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      if (currentWord) speakArabic(currentWord.arabic);
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      toggleStarCurrentWord();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFocusMode();
    }
  });

  // --- Vocabulary Explorer Event Listeners ---
  if (vocabExplorerBtn) {
    vocabExplorerBtn.addEventListener('click', () => {
      if (vocabModalOverlay) {
        vocabModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderVocabList(true);
      }
    });
  }

  if (vocabModalClose) {
    vocabModalClose.addEventListener('click', () => {
      if (vocabModalOverlay) {
        vocabModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  if (vocabModalOverlay) {
    vocabModalOverlay.addEventListener('click', (e) => {
      if (e.target === vocabModalOverlay) {
        vocabModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // Escape key support to close Vocabulary Explorer modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && vocabModalOverlay && vocabModalOverlay.classList.contains('active')) {
      vocabModalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  if (vocabSearchInput) {
    vocabSearchInput.addEventListener('input', () => {
      const query = vocabSearchInput.value.trim();
      if (vocabClearSearch) {
        vocabClearSearch.style.display = query ? 'flex' : 'none';
      }
      renderVocabList(true);
    });
  }

  if (vocabClearSearch) {
    vocabClearSearch.addEventListener('click', () => {
      vocabSearchInput.value = '';
      vocabClearSearch.style.display = 'none';
      renderVocabList(true);
    });
  }

  vocabTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      vocabTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeVocabTab = tab.getAttribute('data-tab');
      renderVocabList(true);
    });
  });

  if (vocabModalBody) {
    vocabModalBody.addEventListener('scroll', () => {
      if (vocabModalBody.scrollTop + vocabModalBody.clientHeight >= vocabModalBody.scrollHeight - 100) {
        loadMoreVocabRows();
      }
    });
  }

  // Mobile Dropdown Menu Event Listeners
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const actionsWrapper = document.getElementById('actions-wrapper');
  
  if (mobileMenuBtn && actionsWrapper) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      actionsWrapper.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (actionsWrapper.classList.contains('active') && !actionsWrapper.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        actionsWrapper.classList.remove('active');
      }
    });

    // Close menu when any menu item is clicked
    actionsWrapper.querySelectorAll('button, a').forEach(btn => {
      btn.addEventListener('click', () => {
        actionsWrapper.classList.remove('active');
      });
    });
  }

  // Exam Modal Entry Point Event Listeners
  const examSidebarBtn = document.getElementById('exam-sidebar-btn');
  const examModalOverlay = document.getElementById('exam-modal-overlay');
  
  if (examSidebarBtn && examModalOverlay) {
    examSidebarBtn.addEventListener('click', () => {
      // Close mobile dropdown menu if open
      if (actionsWrapper && actionsWrapper.classList.contains('active')) {
        actionsWrapper.classList.remove('active');
      }
      openExamModal();
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && examModalOverlay.classList.contains('active')) {
        handleExamCloseAttempt();
      }
    });

    // Close on background click
    examModalOverlay.addEventListener('click', (e) => {
      if (e.target === examModalOverlay) {
        handleExamCloseAttempt();
      }
    });
  }
}

// --- Authentication & Cloud Sync Integration ---
let wordsReviewedInSession = 0;

function checkGuestSignInPrompt() {
  const promptBanner = document.getElementById('guest-signin-prompt');
  if (!promptBanner) return;

  if (isAuthenticated()) {
    promptBanner.style.display = 'none';
    return;
  }

  // Show prompt after 10 word reviews in a single session
  if (wordsReviewedInSession >= 10) {
    promptBanner.style.display = 'flex';
  } else {
    promptBanner.style.display = 'none';
  }
}

function openAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  if (overlay) {
    overlay.classList.add('active');
    updateAuthModalContent();
    if (!isAuthenticated()) {
      initGoogleSignIn();
    }
  }
}

function closeAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  const confirmBox = document.getElementById('delete-confirm-box');
  if (overlay) {
    overlay.classList.remove('active');
  }
  if (confirmBox) {
    confirmBox.classList.remove('active');
  }
}

function updateAuthModalContent() {
  const isAuth = isAuthenticated();
  const guestView = document.getElementById('auth-view-guest');
  const userView = document.getElementById('auth-view-user');
  
  if (isAuth) {
    if (guestView) guestView.style.display = 'none';
    if (userView) userView.style.display = 'block';
    
    const user = getCurrentUser();
    const nameEl = document.getElementById('user-display-name');
    const emailEl = document.getElementById('user-display-email');
    if (nameEl) nameEl.textContent = user.name || 'Student';
    if (emailEl) emailEl.textContent = user.email || '';
    
    const avatarContainer = document.getElementById('user-avatar-container');
    if (avatarContainer) {
      if (user.picture) {
        avatarContainer.innerHTML = `<img src="${user.picture}" alt="${user.name}">`;
      } else {
        avatarContainer.innerHTML = `<i class="fa-solid fa-user" style="font-size: 2.5rem; line-height: 80px; color: var(--text-secondary);"></i>`;
      }
    }
  } else {
    if (guestView) guestView.style.display = 'block';
    if (userView) userView.style.display = 'none';
  }
}

function initGoogleSignIn() {
  if (!CONFIG.GOOGLE_CLIENT_ID) {
    console.warn('Google Client ID is not configured. Google Sign-In button cannot be rendered.');
    const btnContainer = document.getElementById('google-signin-btn');
    if (btnContainer) {
      btnContainer.innerHTML = `<span style="color: var(--color-danger); font-size: 0.85rem; display: block; padding: 10px;">Please configure Google Client ID in config.js</span>`;
    }
    return;
  }

  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    const hasSavedSession = !!localStorage.getItem(CONFIG.AUTH_STORAGE_KEY);

    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          await handleGoogleLogin(response.credential);
          await syncProgress();
          closeAuthModal();
        } catch (err) {
          alert('Authentication failed: ' + err.message);
        }
      },
      auto_select: true // Automatically sign in the user if previously authorized
    });

    const btnContainer = document.getElementById('google-signin-btn');
    if (btnContainer) {
      google.accounts.id.renderButton(
        btnContainer,
        { 
          theme: document.documentElement.classList.contains('light-theme') ? 'outline' : 'filled_blue', 
          size: 'large',
          shape: 'pill',
          width: 250
        }
      );
    }

    // Try to silently refresh credentials on page load/initialization if a session was saved
    if (hasSavedSession && navigator.onLine) {
      console.log('Saved session found. Initiating Google silent sign-in/One Tap...');
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
          const reason = notification.isNotDisplayed() ? notification.getNotDisplayedReason() : '';
          console.warn('Google One Tap notification:', notification.getMomentType(), reason);
          
          // If auto-select failed, was cancelled/dismissed, or cooldown occurred,
          // and we don't have active AWS credentials, clean up and sign out
          if (reason !== 'auto_select' && !getAwsCredentials()) {
            console.log('Google silent refresh was not completed and credentials expired. Signing out.');
            signOut();
          }
        }
      });
    }
  } else {
    // Retry in 300ms if GIS SDK is still loading asynchronously
    setTimeout(initGoogleSignIn, 300);
  }
}

function setupAuthEventListeners() {
  const profileBtn = document.getElementById('profile-btn');
  const syncIndicatorBtn = document.getElementById('sync-indicator-btn');
  const authModalClose = document.getElementById('auth-modal-close');
  const authModalOverlay = document.getElementById('auth-modal-overlay');
  const authSignoutBtn = document.getElementById('auth-signout-btn');
  const authDeleteBtn = document.getElementById('auth-delete-btn');
  const deleteConfirmYes = document.getElementById('delete-confirm-yes-btn');
  const deleteConfirmNo = document.getElementById('delete-confirm-no-btn');
  const guestSigninPromptBtn = document.getElementById('guest-signin-prompt-btn');

  if (profileBtn) profileBtn.addEventListener('click', openAuthModal);
  
  if (syncIndicatorBtn) {
    syncIndicatorBtn.addEventListener('click', () => {
      if (isAuthenticated()) {
        syncProgress();
      }
    });
  }
  
  if (authModalClose) authModalClose.addEventListener('click', closeAuthModal);
  
  if (authModalOverlay) {
    authModalOverlay.addEventListener('click', (e) => {
      if (e.target === authModalOverlay) closeAuthModal();
    });
  }
  
  if (guestSigninPromptBtn) guestSigninPromptBtn.addEventListener('click', openAuthModal);

  if (authSignoutBtn) {
    authSignoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to sign out? Your local progress will remain on this device.')) {
        signOut();
        closeAuthModal();
      }
    });
  }

  if (authDeleteBtn) {
    authDeleteBtn.addEventListener('click', () => {
      const confirmBox = document.getElementById('delete-confirm-box');
      if (confirmBox) confirmBox.classList.add('active');
    });
  }

  if (deleteConfirmNo) {
    deleteConfirmNo.addEventListener('click', () => {
      const confirmBox = document.getElementById('delete-confirm-box');
      if (confirmBox) confirmBox.classList.remove('active');
    });
  }

  if (deleteConfirmYes) {
    deleteConfirmYes.addEventListener('click', async () => {
      try {
        await deleteAccount(deleteCloudProgress);
      } catch (err) {
        alert('Failed to delete account: ' + err.message);
      }
    });
  }
}

// Window Event Listeners for Authentication & Sync Events
window.addEventListener('auth-status-changed', (e) => {
  const { isAuthenticated: isAuth, user } = e.detail;
  const profileBtn = document.getElementById('profile-btn');
  const syncBtn = document.getElementById('sync-indicator-btn');
  
  if (isAuth) {
    if (syncBtn) syncBtn.style.display = 'flex';
    if (profileBtn) {
      if (user && user.picture) {
        profileBtn.innerHTML = `<img src="${user.picture}" alt="${user.name}">`;
      } else {
        profileBtn.innerHTML = `<i class="fa-solid fa-circle-user" style="color: var(--accent-blue);"></i>`;
      }
    }
  } else {
    if (syncBtn) syncBtn.style.display = 'none';
    if (profileBtn) {
      profileBtn.innerHTML = `<i class="fa-solid fa-circle-user"></i>`;
    }
  }
  
  checkGuestSignInPrompt();
  updateAuthModalContent();
});

window.addEventListener('auth-sync-status', (e) => {
  const { status, message } = e.detail;
  const syncBtn = document.getElementById('sync-indicator-btn');
  const syncText = document.getElementById('sync-text');
  const modalBadge = document.getElementById('profile-sync-status');
  const modalText = document.getElementById('profile-sync-text');
  
  if (!syncBtn) return;
  
  // Update classes
  syncBtn.className = 'sync-indicator ' + status;
  if (modalBadge) modalBadge.className = 'profile-sync-status-badge ' + status;
  
  if (status === 'syncing') {
    syncBtn.querySelector('i').className = 'fa-solid fa-rotate';
    if (syncText) syncText.textContent = 'Syncing...';
    if (modalText) modalText.textContent = 'Saving changes...';
  } else if (status === 'synced') {
    syncBtn.querySelector('i').className = 'fa-solid fa-cloud';
    if (syncText) syncText.textContent = 'Backup';
    if (modalText) modalText.textContent = 'Synced & Secure';
  } else if (status === 'error') {
    syncBtn.querySelector('i').className = 'fa-solid fa-cloud-exclamation';
    if (syncText) syncText.textContent = 'Offline';
    if (modalText) modalText.textContent = 'Sync offline';
  }
  
  syncBtn.title = message;
});

window.addEventListener('sync-completed', (e) => {
  const { stats: newStats, starredWords: newStars } = e.detail;
  stats = newStats;
  starredWords = new Set(newStars);
  
  migrateAllKeys(allWords);
  
  updateStatsDisplay();
  updateStarUI();
  applyFilterAndReset();
});

window.addEventListener('auth-account-deleted', () => {
  stats = { known: [], learning: [], seen: [] };
  starredWords = new Set();
  
  closeAuthModal();
  wordsReviewedInSession = 0;
  
  updateStatsDisplay();
  updateStarUI();
  applyFilterAndReset();
  
  alert('Your account and synced progress have been successfully deleted.');
});

// --- Vocabulary Explorer Business Logic ---
function renderVocabList(resetScroll = true) {
  if (!vocabTableBody || !vocabTotalCount) return;
  
  if (resetScroll) {
    vocabTableBody.innerHTML = '';
    vocabLoadedCount = 0;
  }
  
  // 1. Filter allWords based on active tab
  let filtered = [...allWords];
  if (activeVocabTab === 'starred') {
    filtered = filtered.filter(w => starredWords.has(getWordKey(w)));
  } else if (activeVocabTab === 'known') {
    filtered = filtered.filter(w => stats.known.includes(getWordKey(w)));
  } else if (activeVocabTab === 'learning') {
    filtered = filtered.filter(w => stats.learning.includes(getWordKey(w)));
  }
  
  // 2. Filter based on search query
  const query = vocabSearchInput ? vocabSearchInput.value.trim().toLowerCase() : '';
  if (query) {
    filtered = filtered.filter(w => {
      const arabicMatch = w.arabic.includes(query);
      const translitMatch = w.transliteration.toLowerCase().includes(query);
      const meaningsMatch = w.meanings && w.meanings.some(m => m.toLowerCase().includes(query));
      const posMatch = w.part_of_speech && w.part_of_speech.toLowerCase().includes(query);
      const rootMatch = w.root && w.root.includes(query);
      return arabicMatch || translitMatch || meaningsMatch || posMatch || rootMatch;
    });
  }
  
  currentVocabResults = filtered;
  vocabTotalCount.textContent = `${currentVocabResults.length.toLocaleString()} words matched`;
  
  if (currentVocabResults.length === 0) {
    if (vocabEmptyState) vocabEmptyState.style.display = 'flex';
  } else {
    if (vocabEmptyState) vocabEmptyState.style.display = 'none';
    loadMoreVocabRows();
  }
  
  if (resetScroll && vocabModalBody) {
    vocabModalBody.scrollTop = 0;
  }
}

function loadMoreVocabRows() {
  if (!vocabTableBody || vocabLoadedCount >= currentVocabResults.length) return;
  
  const batchSize = 50;
  const batch = currentVocabResults.slice(vocabLoadedCount, vocabLoadedCount + batchSize);
  
  const fragment = document.createDocumentFragment();
  
  batch.forEach(word => {
    const key = getWordKey(word);
    const isStarred = starredWords.has(key);
    
    const row = document.createElement('tr');
    
    // Star column
    const starTd = document.createElement('td');
    starTd.style.textAlign = 'center';
    const starBtn = document.createElement('button');
    starBtn.className = `vocab-star-btn ${isStarred ? 'starred' : ''}`;
    starBtn.title = isStarred ? 'Unstar Word' : 'Star Word';
    starBtn.innerHTML = `<i class="${isStarred ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStarWord(key);
      const nowStarred = starredWords.has(key);
      starBtn.className = `vocab-star-btn ${nowStarred ? 'starred' : ''}`;
      starBtn.title = nowStarred ? 'Unstar Word' : 'Star Word';
      starBtn.innerHTML = `<i class="${nowStarred ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
    });
    starTd.appendChild(starBtn);
    row.appendChild(starTd);
    
    // Arabic column
    const arabicTd = document.createElement('td');
    arabicTd.className = 'arabic-vocab-cell';
    arabicTd.textContent = word.arabic;
    row.appendChild(arabicTd);
    
    // Transliteration column
    const translitTd = document.createElement('td');
    translitTd.textContent = BuckwalterConverter.toPhonetic(word.transliteration);
    row.appendChild(translitTd);
    
    // Meaning column
    const meaningTd = document.createElement('td');
    meaningTd.textContent = word.meanings ? word.meanings.join(', ') : '';
    row.appendChild(meaningTd);
    
    // POS column
    const posTd = document.createElement('td');
    posTd.className = 'col-hide-mobile';
    const posBadge = document.createElement('span');
    posBadge.textContent = word.part_of_speech || '';
    posTd.appendChild(posBadge);
    row.appendChild(posTd);
    
    // Occurrences column
    const occTd = document.createElement('td');
    occTd.className = 'col-hide-mobile';
    occTd.style.textAlign = 'right';
    occTd.style.fontVariantNumeric = 'tabular-nums';
    occTd.textContent = word.frequency || 0;
    row.appendChild(occTd);
    
    // Action column
    const actionTd = document.createElement('td');
    actionTd.style.textAlign = 'center';
    const studyBtn = document.createElement('button');
    studyBtn.className = 'vocab-study-btn';
    studyBtn.textContent = 'Study';
    studyBtn.addEventListener('click', () => {
      studyWord(word);
    });
    actionTd.appendChild(studyBtn);
    row.appendChild(actionTd);
    
    fragment.appendChild(row);
  });
  
  vocabTableBody.appendChild(fragment);
  vocabLoadedCount += batch.length;
}

function toggleStarWord(wordKey) {
  if (starredWords.has(wordKey)) {
    starredWords.delete(wordKey);
  } else {
    starredWords.add(wordKey);
  }
  
  saveStars();
  
  // If active card matches, update the UI
  if (currentWord && getWordKey(currentWord) === wordKey) {
    updateStarUI();
  }
  
  // Re-filter if in starredOnly toggle mode
  if (starredOnlyToggle && starredOnlyToggle.checked) {
    applyFilterAndReset();
  }
  
  // Trigger debounced cloud synchronization if authenticated
  if (typeof queueCloudPush === 'function') {
    queueCloudPush();
  }
}

function studyWord(word) {
  let idx = filteredWords.indexOf(word);
  if (idx === -1) {
    resetAllFiltersQuietly(true);
    idx = filteredWords.indexOf(word);
  }
  
  if (idx !== -1) {
    // Clear history stack to prevent navigation issues
    historyStack = [idx];
    historyPointer = 0;
    displayWord(idx);
    
    // Close modal
    if (vocabModalOverlay) {
      vocabModalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (flashcard) {
      flashcard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

function resetAllFiltersQuietly(skipCardLoad = false) {
  if (starredOnlyToggle) starredOnlyToggle.checked = false;
  if (hideKnownToggle) {
    hideKnownToggle.checked = false;
    localStorage.setItem('hideMastered', 'false');
  }
  if (freqMinInput) freqMinInput.value = 0;
  if (freqMaxInput) freqMaxInput.value = uniqueFrequencies.length - 1;
  if (posFilter) posFilter.value = 'all';
  if (coverageFilter) coverageFilter.value = 'all';
  if (arabicFontSelect) {
    arabicFontSelect.value = 'default';
    applyArabicFont('default');
  }
  updateSliderUI();
  saveFilterSettings();
  applyFilterAndReset(skipCardLoad);
}

// ==========================================================================
// Exam Mode Implementation
// ==========================================================================

function handleExamCloseAttempt() {
  if (examState.isActive) {
    if (confirm('Are you sure you want to quit the exam? Your current progress will be lost.')) {
      closeExamModal();
    }
  } else {
    closeExamModal();
  }
}

function openExamModal() {
  const examModalOverlay = document.getElementById('exam-modal-overlay');
  if (examModalOverlay) {
    examModalOverlay.style.display = 'flex';
    setTimeout(() => {
      examModalOverlay.classList.add('active');
    }, 10);
    document.body.style.overflow = 'hidden';
    renderExamSetup();
  }
}

function closeExamModal() {
  const examModalOverlay = document.getElementById('exam-modal-overlay');
  if (examModalOverlay) {
    examModalOverlay.classList.remove('active');
    setTimeout(() => {
      examModalOverlay.style.display = 'none';
    }, 300);
    document.body.style.overflow = '';
    
    // Clean up timers & key handlers
    if (examState.autoAdvanceTimeout) {
      clearTimeout(examState.autoAdvanceTimeout);
      examState.autoAdvanceTimeout = null;
    }
    if (examState.activeKeyHandler) {
      document.removeEventListener('keydown', examState.activeKeyHandler);
      examState.activeKeyHandler = null;
    }
    if (examState.activeNextKeyHandler) {
      document.removeEventListener('keydown', examState.activeNextKeyHandler);
      examState.activeNextKeyHandler = null;
    }
    examState.isActive = false;
  }
}

function renderExamSetup() {
  const examModal = document.getElementById('exam-modal');
  if (!examModal) return;

  const count50 = allWords.filter(w => w.cumulativePercent < 50).length;
  const count75 = allWords.filter(w => w.cumulativePercent < 75).length;
  const count90 = allWords.filter(w => w.cumulativePercent < 90).length;
  const count100 = allWords.length;

  examModal.innerHTML = `
    <button class="exam-modal-close" id="exam-close-btn" aria-label="Close exam" title="Close exam setup">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <div class="exam-title"><i class="fa-solid fa-graduation-cap"></i> Quranic Vocabulary Exam</div>
    <p class="exam-subtitle">Test your recall of Quranic Arabic vocabulary. Choose your word pool and exam length below.</p>
    
    <div class="exam-setup-section">
      <div class="exam-setup-group">
        <span class="exam-setup-label">1. Select Vocabulary Pool</span>
        <div class="exam-pills-container">
          <button class="exam-pill-btn ${examState.selectedPool === '50' ? 'active' : ''}" data-pool="50" title="Core vocabulary making up 50% of Quranic occurrences">
            Top 50% Core (${count50} words)
          </button>
          <button class="exam-pill-btn ${examState.selectedPool === '75' ? 'active' : ''}" data-pool="75" title="Common vocabulary making up 75% of Quranic occurrences">
            Top 75% Common (${count75} words)
          </button>
          <button class="exam-pill-btn ${examState.selectedPool === '90' ? 'active' : ''}" data-pool="90" title="Extended vocabulary making up 90% of Quranic occurrences">
            Top 90% Extended (${count90} words)
          </button>
          <button class="exam-pill-btn ${examState.selectedPool === 'all' ? 'active' : ''}" data-pool="all" title="All words in the study database">
            100% All Words (${count100} words)
          </button>
        </div>
      </div>

      <div class="exam-setup-group">
        <span class="exam-setup-label">2. Select Exam Length</span>
        <div class="exam-pills-container">
          <button class="exam-pill-btn ${examState.selectedSize === 25 ? 'active' : ''}" data-size="25" title="Run a short exam of 25 questions">
            25 Questions
          </button>
          <button class="exam-pill-btn ${examState.selectedSize === 50 ? 'active' : ''}" data-size="50" title="Run a standard exam of 50 questions">
            50 Questions
          </button>
        </div>
      </div>

      <button class="btn-start-exam" id="exam-start-btn" title="Begin the exam session">
        <i class="fa-solid fa-play"></i> Start Exam
      </button>
    </div>
  `;

  // Attach event listeners inside setup view
  const closeBtn = examModal.querySelector('#exam-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', handleExamCloseAttempt);
  }

  const poolBtns = examModal.querySelectorAll('[data-pool]');
  poolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      poolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      examState.selectedPool = btn.getAttribute('data-pool');
    });
  });

  const sizeBtns = examModal.querySelectorAll('[data-size]');
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      examState.selectedSize = parseInt(btn.getAttribute('data-size'));
    });
  });

  const startBtn = examModal.querySelector('#exam-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', initExamGame);
  }
}

function initExamGame() {
  // 1. Gather word pool
  let pool = [];
  if (examState.selectedPool === '50') {
    pool = allWords.filter(w => w.cumulativePercent < 50);
  } else if (examState.selectedPool === '75') {
    pool = allWords.filter(w => w.cumulativePercent < 75);
  } else if (examState.selectedPool === '90') {
    pool = allWords.filter(w => w.cumulativePercent < 90);
  } else {
    pool = [...allWords];
  }

  if (pool.length === 0) {
    alert('Selected word pool is empty. Please select another pool.');
    return;
  }

  // 2. Determine target size
  let size = examState.selectedSize;
  if (pool.length < size) {
    size = pool.length;
  }

  // 3. Shuffle pool and take subset
  const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
  const selectedWords = shuffledPool.slice(0, size);

  // 4. Generate MCQ options for each word
  examState.activeQuestions = selectedWords.map(word => {
    const correctMeaning = word.meanings ? word.meanings.join(', ') : '';

    // Distractors: select randomly from allWords meanings (excluding target word itself, and making sure distractors are unique)
    const otherWords = allWords.filter(w => {
      const wKey = getWordKey(w);
      const targetKey = getWordKey(word);
      if (wKey === targetKey) return false;
      const wMeaning = w.meanings ? w.meanings.join(', ') : '';
      return wMeaning !== correctMeaning && wMeaning !== '';
    });
    const shuffledOthers = otherWords.sort(() => 0.5 - Math.random());
    
    const distractors = [];
    const seenMeanings = new Set([correctMeaning]);
    for (const otherW of shuffledOthers) {
      if (distractors.length >= 3) break;
      const otherMeaning = otherW.meanings ? otherW.meanings.join(', ') : '';
      if (!seenMeanings.has(otherMeaning) && otherMeaning !== '') {
        distractors.push(otherMeaning);
        seenMeanings.add(otherMeaning);
      }
    }

    // Combine and shuffle choices
    const choices = [correctMeaning, ...distractors].sort(() => 0.5 - Math.random());
    const correctIndex = choices.indexOf(correctMeaning);

    return {
      word: word,
      choices: choices,
      correctIndex: correctIndex,
      selectedIndex: -1
    };
  });

  // 5. Reset gameplay state
  examState.currentIndex = 0;
  examState.score = 0;
  examState.incorrectWords = [];
  examState.isActive = true;

  // 6. Render first question
  renderExamQuestion();
}

function renderExamQuestion() {
  const examModal = document.getElementById('exam-modal');
  if (!examModal) return;

  const currentQ = examState.activeQuestions[examState.currentIndex];
  const totalQs = examState.activeQuestions.length;
  const percentComplete = (examState.currentIndex / totalQs) * 100;

  examModal.innerHTML = `
    <div class="exam-header">
      <div class="exam-header-row">
        <span class="exam-progress-text">Question ${examState.currentIndex + 1} of ${totalQs}</span>
        <button class="btn-quit-exam" id="exam-quit-btn" title="Quit exam and discard progress">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
        </button>
      </div>
      <div class="exam-progress-bar-container">
        <div class="exam-progress-bar-fill" style="width: ${percentComplete}%"></div>
      </div>
    </div>

    <div class="exam-question-arabic">
      ${currentQ.word.arabic}
    </div>

    <div class="exam-choices-grid">
      ${currentQ.choices.map((choice, idx) => `
        <button class="exam-choice-btn" data-choice="${idx}" title="Select option ${String.fromCharCode(65 + idx)} (Shortcut: ${idx + 1} or ${String.fromCharCode(65 + idx).toLowerCase()})">
          <span class="exam-choice-badge">${String.fromCharCode(65 + idx)}</span>
          <span>${choice}</span>
        </button>
      `).join('')}
    </div>

    <div class="exam-footer">
      <button class="btn-next-question" id="exam-next-btn" disabled title="Go to next question (Shortcut: Space or Enter)">
        Next Question <i class="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  `;

  // Attach event listeners
  const quitBtn = examModal.querySelector('#exam-quit-btn');
  if (quitBtn) {
    quitBtn.addEventListener('click', handleExamCloseAttempt);
  }

  const choiceBtns = examModal.querySelectorAll('.exam-choice-btn');
  choiceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-choice'));
      selectExamChoice(idx);
    });
  });

  const nextBtn = examModal.querySelector('#exam-next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', nextExamQuestion);
  }

  // Keyboard support for choices (1-4 or A-D)
  const handleKeyChoice = (e) => {
    if (currentQ.selectedIndex !== -1) return; // Already answered
    
    let keyIdx = -1;
    if (e.key === '1' || e.key.toLowerCase() === 'a') keyIdx = 0;
    else if (e.key === '2' || e.key.toLowerCase() === 'b') keyIdx = 1;
    else if (e.key === '3' || e.key.toLowerCase() === 'c') keyIdx = 2;
    else if (e.key === '4' || e.key.toLowerCase() === 'd') keyIdx = 3;

    if (keyIdx !== -1 && keyIdx < currentQ.choices.length) {
      selectExamChoice(keyIdx);
    }
  };

  // Keyboard support for next question button (Space or Enter)
  const handleNextKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const activeNextBtn = document.getElementById('exam-next-btn');
      if (activeNextBtn && !activeNextBtn.disabled) {
        e.preventDefault();
        nextExamQuestion();
      }
    }
  };

  document.addEventListener('keydown', handleKeyChoice);
  document.addEventListener('keydown', handleNextKey);
  
  examState.activeKeyHandler = handleKeyChoice;
  examState.activeNextKeyHandler = handleNextKey;
}

function selectExamChoice(choiceIndex) {
  const currentQ = examState.activeQuestions[examState.currentIndex];
  if (currentQ.selectedIndex !== -1) return; // Already answered

  currentQ.selectedIndex = choiceIndex;

  // Clean up keyboard choice handler
  if (examState.activeKeyHandler) {
    document.removeEventListener('keydown', examState.activeKeyHandler);
    examState.activeKeyHandler = null;
  }

  const choiceBtns = document.querySelectorAll('.exam-choice-btn');
  choiceBtns.forEach(btn => {
    btn.disabled = true; // Disable all choices
    const idx = parseInt(btn.getAttribute('data-choice'));

    if (idx === currentQ.correctIndex) {
      btn.classList.add('correct-choice');
    } else if (idx === choiceIndex) {
      btn.classList.add('incorrect-choice');
    }
  });

  const isCorrect = choiceIndex === currentQ.correctIndex;
  if (isCorrect) {
    examState.score++;
  } else {
    examState.incorrectWords.push({
      word: currentQ.word,
      selectedMeaning: currentQ.choices[choiceIndex]
    });
  }

  // Enable Next button
  const nextBtn = document.getElementById('exam-next-btn');
  if (nextBtn) {
    nextBtn.disabled = false;
  }
}

function nextExamQuestion() {
  if (examState.autoAdvanceTimeout) {
    clearTimeout(examState.autoAdvanceTimeout);
    examState.autoAdvanceTimeout = null;
  }

  if (examState.activeNextKeyHandler) {
    document.removeEventListener('keydown', examState.activeNextKeyHandler);
    examState.activeNextKeyHandler = null;
  }

  if (examState.activeKeyHandler) {
    document.removeEventListener('keydown', examState.activeKeyHandler);
    examState.activeKeyHandler = null;
  }

  examState.currentIndex++;
  if (examState.currentIndex < examState.activeQuestions.length) {
    renderExamQuestion();
  } else {
    showExamResults();
  }
}

function showExamResults() {
  examState.isActive = false;
  
  const examModal = document.getElementById('exam-modal');
  if (!examModal) return;

  const totalQs = examState.activeQuestions.length;
  const score = examState.score;
  const percentage = Math.round((score / totalQs) * 100);

  let badgeName = 'Keep Studying';
  let badgeIcon = 'fa-book';
  if (percentage === 100) {
    badgeName = 'Quranic Scholar';
    badgeIcon = 'fa-trophy';
  } else if (percentage >= 90) {
    badgeName = 'Excellent';
    badgeIcon = 'fa-star';
  } else if (percentage >= 70) {
    badgeName = 'Good Effort';
    badgeIcon = 'fa-thumbs-up';
  }

  examModal.innerHTML = `
    <button class="exam-modal-close" id="exam-close-btn" aria-label="Close results" title="Close results and return to study">
      <i class="fa-solid fa-xmark"></i>
    </button>
    
    <div class="exam-results-container">
      <div class="exam-results-header">
        <div class="exam-title"><i class="fa-solid fa-circle-check"></i> Exam Completed!</div>
        <p class="exam-subtitle">Here is your recall performance overview.</p>
      </div>

      <div class="exam-circular-score">
        <span class="exam-score-number">${percentage}%</span>
        <span class="exam-score-label">${score}/${totalQs} correct</span>
      </div>

      <div class="exam-badge-tag">
        <i class="fa-solid ${badgeIcon}"></i> ${badgeName}
      </div>

      ${examState.incorrectWords.length > 0 ? `
        <div class="exam-review-section">
          <span class="exam-review-title">Review Missed Words (${examState.incorrectWords.length})</span>
          <div class="exam-missed-list">
            ${examState.incorrectWords.map(item => {
              const wordKey = getWordKey(item.word);
              const isStarred = starredWords.has(wordKey);
              const posText = item.word.part_of_speech ? ` &bull; ${item.word.part_of_speech}` : '';
              return `
                <div class="exam-missed-item" data-word-key="${wordKey}">
                  <div class="exam-missed-left">
                    <span class="exam-missed-arabic">${item.word.arabic}</span>
                    <span class="exam-missed-translit">${item.word.transliteration}${posText}</span>
                  </div>
                  <div class="exam-missed-right">
                    <div class="exam-missed-meanings">
                      <span class="exam-correct-meaning">${item.word.meanings ? item.word.meanings.join(', ') : ''}</span>
                      <span class="exam-wrong-meaning">${item.selectedMeaning}</span>
                    </div>
                    <button class="exam-star-btn ${isStarred ? 'starred' : ''}" title="Star this word for study">
                      <i class="${isStarred ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : `
        <p style="color: var(--color-success); font-weight: 600; font-size: 1.1rem; margin: 15px 0;">
          🎉 SubhanAllah! Perfect Score! You mastered all the words in this exam.
        </p>
      `}

      <div class="exam-results-actions">
        <button class="btn-results-retry" id="exam-retry-btn" title="Start a new exam with the same settings">
          <i class="fa-solid fa-arrow-rotate-left"></i> Retry Exam
        </button>
        <button class="btn-results-exit" id="exam-exit-btn" title="Return to vocabulary study mode">
          <i class="fa-solid fa-house"></i> Exit to Study
        </button>
      </div>
    </div>
  `;

  const closeBtn = examModal.querySelector('#exam-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeExamModal);

  const exitBtn = examModal.querySelector('#exam-exit-btn');
  if (exitBtn) exitBtn.addEventListener('click', closeExamModal);

  const retryBtn = examModal.querySelector('#exam-retry-btn');
  if (retryBtn) retryBtn.addEventListener('click', initExamGame);

  const missedItems = examModal.querySelectorAll('.exam-missed-item');
  missedItems.forEach(item => {
    const starBtn = item.querySelector('.exam-star-btn');
    const wordKey = item.getAttribute('data-word-key');
    if (starBtn && wordKey) {
      starBtn.addEventListener('click', () => {
        if (starredWords.has(wordKey)) {
          starredWords.delete(wordKey);
          starBtn.classList.remove('starred');
          starBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
        } else {
          starredWords.add(wordKey);
          starBtn.classList.add('starred');
          starBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
        }
        saveStars();
        updateStarUI();
      });
    }
  });
}

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

