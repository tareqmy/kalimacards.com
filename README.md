# KalimaCards 📖

**KalimaCards** is a premium, client-side active recall application designed to master Quranic Arabic vocabulary. It uses a frequency-based learning methodology, displaying Quranic lemmas (dictionary word forms) in order of their occurrence in the Holy Quran, allowing users to study the most common words first to maximize comprehension.

Built with modern web technologies, it features an interactive, responsive user interface with glassmorphism styling, full offline support (PWA), detailed session statistics, star/bookmark capability, and a full-text search database of all vocabulary terms.

---

## Key Features

- 🗂️ **Active Recall Interface**: Flip cards to reveal classical meanings and transliterations. Rate your recollection with "Knew It" (green) or "Still Learning" (red).
- 📈 **Mastery & Session Stats**: Tracks your progress in real-time, showcasing review count, success rate, and overall mastery percentage.
- 🔍 **Instant Search Database**: Live search through the vocabulary library by Arabic word, transliteration, or English meaning.
- 🎛️ **Granular Filtering**: Filter card lists by frequency levels (High, Medium, Low) or limit the session to your Starred Words (⭐).
- 🔄 **Learning Modes**: Choose between *Randomized Order* for unpredictable recall, or *Sequential Order* to learn based on frequency.
- 🌓 **Elegant Dark/Light Theme**: Seamless theme toggling with persistent user preference storage.
- 📱 **Progressive Web App (PWA)**: Works offline and installs directly on your home screen or desktop via service worker and manifest configuration.
- 🧹 **Buckwalter Transliteration Engine**: Auto-converts ASCII-based Buckwalter transliterations into elegant, readable phonetic text on the fly.

---

## File Structure

```
kalimacards/
├── index.html            # Main application layout and active recall interface
├── about.html            # Biography page of the creator (Tareq Mohammad Yousuf)
├── app.js                # Core JS logic: state management, filtering, searching, transliteration
├── style.css             # Vanilla CSS containing variables, dark/light modes, animations
├── manifest.json         # PWA Manifest configuration for application installability
├── sw.js                 # PWA Service Worker for offline file caching
├── words.json            # Compiled dataset of Quranic words (vocabulary database)
├── scraped_lemmas.json   # Scraped lemma raw data from corpus.quran.com
├── Makefile              # Local helper commands for serving and parsing
└── scripts/              # Python scripts for data processing and translation pipeline
    ├── parse_corpus.py   # Converts CSV source files to words.json
    ├── scrape_lemmas.py  # Scrapes raw lemmas and metadata from the Quranic Corpus
    ├── scrape_meanings.py# Fetches vocabulary translations from web resources
    ├── translate_lemmas.py# Runs translation on scraped raw data
    ├── detect_lazy.py    # Identifies unmapped or translation-needed words
    ├── patch_words.py    # Overwrites modern translations with accurate classical meanings
    └── patch_lazy_words.py# Advanced/fallback patches for specific word groups
```

---

## Getting Started

### Prerequisites
To run the local server or parse data, you need:
- Python 3.x
- Make (optional, but recommended)

### Running Locally
You can start the development server using the provided `Makefile`:

```bash
# Start server on default port (8000)
make run

# Start server on a custom port
make run PORT=9000
```

Alternatively, run Python's built-in HTTP server directly:
```bash
python3 -m http.server 8000
```
Open your browser and navigate to `http://localhost:8000`.

---

## Data Pipeline & Scripts

The project includes a robust pipeline to scrape, translate, patch, and compile Quranic Arabic vocabulary.

### 1. Compiling Vocabulary (`parse_corpus.py`)
Compile a custom CSV file into the structured `words.json` expected by the frontend. The CSV must contain the columns: `Arabic`, `Transliteration`, `Meaning`, `Frequency`.

```bash
make parse CSV=path/to/file.csv
```
Or run directly:
```bash
python3 scripts/parse_corpus.py path/to/file.csv words.json
```

### 2. Scraping and Patching (Advanced)
- **`scrape_lemmas.py`**: Scrapes the lemma list from [Quranic Corpus lemmas](https://corpus.quran.com/lemmas.jsp) and generates `scraped_lemmas.json`.
- **`patch_words.py`**: A critical script that overrides generic/modern machine translations (like Google Translate outputs) with precise, contextually accurate **Classical Quranic translations** for the most common roots.

---

## Technologies Used

- **Frontend**: HTML5, Vanilla JavaScript (ES6+), CSS3 (Variables, Grids, Flexbox, Keyframes)
- **Icons**: FontAwesome 6.4.0 (CDN)
- **Data Format**: JSON (pre-compiled from CSV)
- **PWA**: Service Workers & Cache Storage API

---

## Author & Contact

**Tareq Mohammad Yousuf**  
*Software Architect & Team Lead*
- Email: [tareq.y@gmail.com](mailto:tareq.y@gmail.com)
- GitHub: [@tareqmy](https://github.com/tareqmy)
- Website: [tareqmy.com](https://tareqmy.com)

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
