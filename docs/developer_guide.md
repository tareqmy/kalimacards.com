# KalimaCards Developer & Architecture Guide 🛠️

Welcome to the **KalimaCards** developer documentation. This guide explains the internal design, file schemas, database structure, and PWA components of the web application.

---

## 🏗️ Architecture & Data Flow

The application is built entirely as a static client-side application. The core of its data layer is [words.json](file:///Users/tareqmy/development/javascriptprojects/kalimacards/words.json), which acts as a read-only database. 

During runtime:
1. The client loads [index.html](file:///Users/tareqmy/development/javascriptprojects/kalimacards/index.html) and fetches [words.json](file:///Users/tareqmy/development/javascriptprojects/kalimacards/words.json).
2. The user interface and filtering logic are managed dynamically in [app.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/app.js).
3. Offline capabilities and asset caching are handled by the service worker in [sw.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/sw.js).

---

## 📊 Database JSON Schema

The main dictionary file [words.json](file:///Users/tareqmy/development/javascriptprojects/kalimacards/words.json) contains a sorted JSON list of lemma objects.

### Schema Fields
| Field | Type | Description |
| :--- | :--- | :--- |
| `arabic` | `string` | The Arabic lemma text containing vowel marks (diacritics). |
| `transliteration` | `string` | Buckwalter transliteration of the word form. |
| `meaning` | `string` | Primary translated meaning. |
| `meanings` | `array of strings` | List of secondary contextual translations (up to 5 items). |
| `frequency` | `integer` | Total number of occurrences in the Holy Quran. |
| `part_of_speech` | `string` | Grammatical label (e.g., `Noun`, `Verb`, `Preposition`). |
| `root` | `string` | (Optional) The three or four letter Arabic root of the word. |
| `url` | `string` | Analysis link to [corpus.quran.com](https://corpus.quran.com) for deeper study. |

### Schema Example
```json
[
  {
    "arabic": "قَالَ",
    "transliteration": "qaAla",
    "meaning": "say, speak",
    "meanings": [
      "say",
      "speak",
      "call"
    ],
    "frequency": 1725,
    "part_of_speech": "Verb",
    "root": "قول",
    "url": "https://corpus.quran.com/qurandictionary.jsp?q=qwl"
  }
]
```

---

## 🌐 Local Development & Serving

### Commands Overview
To ease local development, a [Makefile](file:///Users/tareqmy/development/javascriptprojects/kalimacards/Makefile) is provided:

*   **Run Development Server**:
    Starts python built-in server at [http://localhost:8000](http://localhost:8000).
    ```bash
    make run
    ```
    *Specify custom port:* `make run PORT=9000`

---

## 📱 Progressive Web App (PWA) Configurations

*   **[manifest.json](file:///Users/tareqmy/development/javascriptprojects/kalimacards/manifest.json)**:
    Configures app naming, display modes (`standalone`), background styles, and icons for desktop/mobile installability.
*   **[sw.js](file:///Users/tareqmy/development/javascriptprojects/kalimacards/sw.js)**:
    Handles offline assets caching (`ASSETS_TO_CACHE`) and implements a cache-first network-fallback service policy for high responsiveness.
