#!/usr/bin/env python3
"""
Quranic Corpus Verbs Scraper
Scrapes all pages of verbs from https://corpus.quran.com/verbs.jsp
converts Arabic verbs to Buckwalter transliteration, and outputs them to scraped_verbs.json.
"""

import time
import json
import urllib.request
import urllib.parse
import re
from bs4 import BeautifulSoup

# Comprehensive Arabic to Buckwalter character mapping based on app.js and standard rules
ARABIC_TO_BUCKWALTER = {
    "\u0621": "'", "\u0622": "|", "\u0623": ">", "\u0624": "&", "\u0625": "<", "\u0626": "}",
    "\u0627": "A", "\u0628": "b", "\u0629": "p", "\u062a": "t", "\u062b": "v",
    "\u062c": "j", "\u062d": "H", "\u062e": "x", "\u062f": "d", "\u0630": "*",
    "\u0631": "r", "\u0632": "z", "\u0633": "s", "\u0634": "$", "\u0635": "S",
    "\u0636": "D", "\u0637": "T", "\u0638": "Z", "\u0639": "E", "\u063a": "g",
    "\u0640": "_", "\u0641": "f", "\u0642": "q", "\u0643": "k", "\u0644": "l",
    "\u0645": "m", "\u0646": "n", "\u0647": "h", "\u0648": "w", "\u0649": "Y",
    "\u064a": "y", "\u064b": "F", "\u064c": "N", "\u064d": "K", "\u064e": "a",
    "\u064f": "u", "\u0650": "i", "\u0651": "~", "\u0652": "o", "\u0653": "^",
    "\u0654": "#", "\u0670": "`", "\u0671": "{", "\u06dc": ":", "\u06df": "@",
    "\u06e0": "\"", "\u06e2": "[", "\u06e3": ";", "\u06e5": ",", "\u06e6": ".",
    "\u06e8": "!", "\u06ea": "-", "\u06eb": "+", "\u06ec": "%", "\u06ed": "]"
}

def to_buckwalter(arabic_str):
    if not arabic_str:
        return ""
    return "".join(ARABIC_TO_BUCKWALTER.get(char, char) for char in arabic_str)

def scrape_quranic_verbs(output_file='scraped_verbs.json'):
    base_url = "https://corpus.quran.com/verbs.jsp"
    
    current_page = 1
    total_verbs_found = 0
    all_verbs = []
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    print("Starting scraping of Quranic Arabic verbs from corpus.quran.com...")
    
    while True:
        url = f"{base_url}?page={current_page}"
        print(f"Fetching Page {current_page}... ({url})")
        
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                html_content = response.read().decode('utf-8')
        except Exception as e:
            print(f"Error fetching page {current_page}: {e}")
            break
            
        soup = BeautifulSoup(html_content, 'html.parser')
        
        table = soup.find('table', class_='verbTable')
        if not table:
            print(f"No verb table found on page {current_page}. Stopping.")
            break
            
        rows = table.find_all('tr')
        data_rows = [r for r in rows if 'head' not in r.get('class', [])]
        
        if not data_rows:
            print("No more data rows found. Scraping complete!")
            break
            
        page_entries = 0
        for row in data_rows:
            cols = row.find_all('td')
            if len(cols) < 5:
                continue
                
            # Column 1: Verb
            arabic_verb = cols[0].get_text(strip=True)
            
            # Column 2: Root
            root = cols[1].get_text(strip=True)
            
            # Column 3: Form
            form = cols[2].get_text(strip=True)
            
            # Column 4: Frequency
            freq_str = cols[3].get_text(strip=True)
            try:
                frequency = int(freq_str)
            except ValueError:
                frequency = 0
                
            # Column 5: Translation & URL Extraction
            translation_link = cols[4].find('a')
            meaning = cols[4].get_text(strip=True)
            word_url = ""
            
            if translation_link and translation_link.get('href'):
                href = translation_link.get('href')
                if href.startswith('/'):
                    word_url = f"https://corpus.quran.com{href}"
                else:
                    word_url = f"https://corpus.quran.com/{href}"
            
            # Convert Arabic verb to Buckwalter transliteration
            buckwalter = to_buckwalter(arabic_verb)
            
            # Form part of speech tag
            pos = f"Verb (Form {form})" if form and form != 'N/A' else "Verb"
            
            all_verbs.append({
                "arabic": arabic_verb,
                "transliteration": buckwalter,
                "root": root,
                "frequency": frequency,
                "part_of_speech": pos,
                "url": word_url,
                "meanings": [meaning] if meaning else []
            })
            page_entries += 1
            
        total_verbs_found += page_entries
        print(f"Successfully parsed {page_entries} verbs from page {current_page}.")
        
        # Check if we've reached the end
        nav_info = soup.find(text=re.compile(r'Verbs \d+ to \d+ of \d+'))
        max_verbs = 1475
        if nav_info:
            match = re.search(r'of (\d+)', nav_info)
            if match:
                max_verbs = int(match.group(1))
                
        if total_verbs_found >= max_verbs:
            print(f"Reached total expected verbs count of {max_verbs}. Stopping.")
            break
            
        current_page += 1
        time.sleep(1.0)
        
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_verbs, f, ensure_ascii=False, indent=2)
    print(f"Successfully saved {len(all_verbs)} verbs to JSON: {output_file}")

if __name__ == "__main__":
    import sys
    filename = 'scraped_verbs.json'
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    scrape_quranic_verbs(output_file=filename)
