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
const resetFiltersBtn = document.getElementById('reset-filters-btn');

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
let uniqueFrequencies = []; // Unique frequency values sorted ascending
let historyStack = [];     // Array of indices visited in filteredWords
let historyPointer = -1;   // Current pointer in historyStack
let isFlipped = false;     // Is the card currently flipped?
let currentWord = null;    // Current active word object

// Persistent Stats (saved to localStorage)
let stats = {
  known: [],      // Array of word transliterations or unique keys
  learning: [],   // Array of word transliterations or unique keys
  seen: []        // Array of word transliterations or unique keys
};

// --- Initializing App ---
document.addEventListener('DOMContentLoaded', () => {
  detectDevice();
  loadTheme();
  loadFocusMode();
  loadStats();
  fetchWords();
  setupEventListeners();
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
}

// --- Fetch Data ---
async function fetchWords() {
  try {
    const response = await fetch('words.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    allWords = await response.json();
    
    // Sort allWords descending by frequency to calculate cumulative percentiles
    allWords.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
    
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
    
    applyFilterAndReset();
  } catch (error) {
    console.error('Error fetching words:', error);
    arabicWord.textContent = 'خطأ';
    arabicWord.style.fontSize = '3rem';
    wordTransliteration.textContent = 'Failed to load words.json';
    wordMeaning.textContent = 'Please make sure words.json is present in the root folder.';
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

function applyFilterAndReset() {
  const posVal = posFilter ? posFilter.value : 'all';
  const coverageVal = coverageFilter ? coverageFilter.value : 'all';
  
  // 1. Apply frequency and starred filtering
  let tempWords = [...allWords];
  
  // Apply Starred filter if toggle is active
  if (starredOnlyToggle && starredOnlyToggle.checked) {
    tempWords = tempWords.filter(w => {
      const key = `${w.arabic}_${w.transliteration}`;
      return starredWords.has(key);
    });
  }

  // Apply Hide Mastered filter if toggle is active
  if (hideKnownToggle && hideKnownToggle.checked) {
    tempWords = tempWords.filter(w => !stats.known.includes(w.transliteration));
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
  if (posVal === 'verbs') {
    filteredWords = tempWords.filter(w => w.part_of_speech && w.part_of_speech.toLowerCase().startsWith('verb'));
  } else if (posVal === 'nouns') {
    filteredWords = tempWords.filter(w => w.part_of_speech && (w.part_of_speech.toLowerCase().includes('noun') || w.part_of_speech.toLowerCase() === 'noun'));
  } else if (posVal === 'particles') {
    filteredWords = tempWords.filter(w => w.part_of_speech && (
      w.part_of_speech.toLowerCase().includes('particle') || 
      w.part_of_speech.toLowerCase().includes('preposition') || 
      w.part_of_speech.toLowerCase().includes('conjunction') ||
      w.part_of_speech.toLowerCase().includes('pronoun')
    ));
  } else {
    filteredWords = tempWords;
  }

  // Sort initially by frequency descending (default)
  filteredWords.sort((a, b) => b.frequency - a.frequency);

  // Reset navigation history
  historyStack = [];
  historyPointer = -1;

  // Update live word count display
  const countEl = document.getElementById('filtered-word-count');
  if (countEl) {
    countEl.textContent = `(${filteredWords.length.toLocaleString()} words)`;
  }

  if (filteredWords.length > 0) {
    loadNextCard(true); // Load first card
  } else {
    showEmptyState();
  }
  updateStatsDisplay();
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
    markAsSeen(currentWord.transliteration);
    
    // Sync star icons state
    updateStarUI();

    // Update navigation button states
    prevBtn.disabled = (historyPointer <= 0);
    
    // Remove scale animation
    flashcard.classList.remove('scale-down');
    
    // Clear inline transition after animation completes
    setTimeout(() => {
      flashcard.style.transition = '';
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
}

function markAsKnown() {
  if (!currentWord) return;
  const key = currentWord.transliteration;
  
  // Add to known, remove from learning
  if (!stats.known.includes(key)) {
    stats.known.push(key);
  }
  stats.learning = stats.learning.filter(w => w !== key);
  
  saveStats();
  animateButtonFeedback(yesBtn);

  if (hideKnownToggle && hideKnownToggle.checked) {
    const currentIdx = filteredWords.findIndex(w => w.transliteration === key);
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
  const key = currentWord.transliteration;
  
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
  flashcard.classList.toggle('is-flipped', isFlipped);
  
  // Set accessibility tags
  flashcard.setAttribute('aria-expanded', isFlipped);

  // Enable/disable assessment buttons based on flip state (active recall)
  if (isFlipped) {
    enableAssessment();
  } else {
    disableAssessment();
  }
}

function closeCardFlip() {
  isFlipped = false;
  flashcard.classList.remove('is-flipped');
  flashcard.setAttribute('aria-expanded', 'false');
  disableAssessment();
}

function enableAssessment() {
  yesBtn.removeAttribute('disabled');
  noBtn.removeAttribute('disabled');
}

function disableAssessment() {
  yesBtn.setAttribute('disabled', 'true');
  noBtn.setAttribute('disabled', 'true');
}

// --- Stats Display Updates ---
function updateStatsDisplay() {
  // Count stats specifically for the CURRENT list of filtered words
  const filteredKeys = new Set(filteredWords.map(w => w.transliteration));
  
  const seenCount = stats.seen.filter(w => filteredKeys.has(w)).length;
  const knownCount = stats.known.filter(w => filteredKeys.has(w)).length;
  const learningCount = stats.learning.filter(w => filteredKeys.has(w)).length;
  
  const totalInFilter = filteredWords.length;
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
  const wordKey = `${currentWord.arabic}_${currentWord.transliteration}`;
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
  const wordKey = `${currentWord.arabic}_${currentWord.transliteration}`;
  
  if (starredWords.has(wordKey)) {
    starredWords.delete(wordKey);
  } else {
    starredWords.add(wordKey);
  }
  
  localStorage.setItem('starredWords', JSON.stringify(Array.from(starredWords)));
  updateStarUI();
  
  // Re-filter and reload deck if in "starred words only" filter mode
  if (starredOnlyToggle && starredOnlyToggle.checked) {
    applyFilterAndReset();
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Card click flips the card
  flashcard.addEventListener('click', toggleCardFlip);
  
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
      const currentFlip = isFlipped ? 'rotateY(180deg)' : '';
      const rotation = deltaX * 0.08;
      flashcard.style.transition = 'none';
      flashcard.style.transform = `${currentFlip} translateX(${deltaX}px) rotate(${rotation}deg)`;
      flashcard.style.opacity = Math.max(1 - Math.abs(deltaX) / 400, 0.4);

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
      // Tap detected - flip card
      e.preventDefault();
      toggleCardFlip();
    } else if (isSwipeAction) {
      e.preventDefault();
      
      if (Math.abs(deltaX) > 120) {
        // Complete swipe
        const currentFlip = isFlipped ? 'rotateY(180deg)' : '';
        flashcard.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
        flashcard.style.transform = `${currentFlip} translateX(${deltaX > 0 ? 600 : -600}px) rotate(${deltaX > 0 ? 30 : -30}deg)`;
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
        const currentFlip = isFlipped ? 'rotateY(180deg)' : '';
        flashcard.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.15), opacity 0.3s ease-out';
        flashcard.style.transform = `${currentFlip}`;
        flashcard.style.opacity = '1';
        
        setTimeout(() => {
          flashcard.style.transition = '';
        }, 300);
      }
    }
  }, { passive: false });
  
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
              saveStats();
            }
            
            if (data.starredWords) {
              starredWords = new Set(data.starredWords);
              localStorage.setItem('starredWords', JSON.stringify(Array.from(starredWords)));
            }
            
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
    starredOnlyToggle.addEventListener('change', applyFilterAndReset);
  }

  if (hideKnownToggle) {
    const savedHideMastered = localStorage.getItem('hideMastered') === 'true';
    hideKnownToggle.checked = savedHideMastered;
    
    hideKnownToggle.addEventListener('change', () => {
      localStorage.setItem('hideMastered', hideKnownToggle.checked);
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
    posFilter.addEventListener('change', applyFilterAndReset);
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
      updateSliderUI();
      applyFilterAndReset();
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
      let filteredIdx = filteredWords.findIndex(w => w.arabic === targetWord.arabic && w.transliteration === targetWord.transliteration);
      
      if (filteredIdx === -1) {
        if (starredOnlyToggle) starredOnlyToggle.checked = false;
        if (hideKnownToggle) {
          hideKnownToggle.checked = false;
          localStorage.setItem('hideMastered', 'false');
        }
        if (freqMinInput) freqMinInput.value = 0;
        if (freqMaxInput) freqMaxInput.value = uniqueFrequencies.length - 1;
        updateSliderUI();
        if (posFilter) posFilter.value = 'all';
        if (coverageFilter) coverageFilter.value = 'all';
        applyFilterAndReset();
        filteredIdx = filteredWords.findIndex(w => w.arabic === targetWord.arabic && w.transliteration === targetWord.transliteration);
      }
      
      if (filteredIdx !== -1) {
        currentIndex = filteredIdx;
        closeCardFlip();
        
        historyStack.push(currentIndex);
        historyPointer = historyStack.length - 1;
        
        displayWord(currentIndex);
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
      if (isFlipped) {
        e.preventDefault();
        markAsLearning();
      }
    } else if (e.key === '2') {
      if (isFlipped) {
        e.preventDefault();
        markAsKnown();
      }
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
}

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

