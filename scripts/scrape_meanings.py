#!/usr/bin/env python3
"""
KalimaCards Meanings Scraper
Crawls corpus.quran.com search URLs in parallel to extract all contextual meanings
for each word, deduplicates them, caps them at 5, and saves them to words.json.
"""

import json
import os
import re
import urllib.request
import urllib.parse
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

def parse_meanings(html):
    soup = BeautifulSoup(html, 'html.parser')
    taf_table = soup.find('table', class_='taf')
    meanings = []
    seen = set()
    if taf_table:
        for td in taf_table.find_all('td', class_='c2'):
            text = td.get_text(strip=True)
            # Remove any trailing parenthetical references if present, e.g. "portion (4:85)"
            text = re.sub(r'\s*\(\d+:\d+\)\s*', '', text).strip()
            # Clean and normalize for deduplication
            clean_text = text.lower().strip()
            if clean_text and clean_text not in seen:
                seen.add(clean_text)
                meanings.append(text)
    return meanings[:5]  # Keep only up to 5

def fetch_url(url, retries=3):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.read()
        except Exception as e:
            if attempt == retries - 1:
                print(f"Error fetching {url}: {e}")
                return None
            time.sleep(1 * (attempt + 1))
    return None

def process_word(word):
    url = word.get("url")
    if not url or url == '#':
        return word, []
    
    html = fetch_url(url)
    if not html:
        return word, []
    
    try:
        meanings = parse_meanings(html)
        return word, meanings
    except Exception as e:
        print(f"Error parsing meanings for {word.get('arabic')}: {e}")
        return word, []

def main():
    words_file = "words.json"
    if not os.path.exists(words_file):
        print(f"Error: {words_file} not found.")
        return
        
    with open(words_file, 'r', encoding='utf-8') as f:
        words = json.load(f)
        
    # Filter words that need processing (exclude those already processed with meanings list)
    pending_words = [w for w in words if "meanings" not in w or not w["meanings"]]
    
    print(f"Total words: {len(words)}")
    print(f"Words needing meanings scrape: {len(pending_words)}")
    
    if not pending_words:
        print("All words already processed. Nothing to scrape.")
        return
        
    # Dry run on first 5 words to verify correctness
    print("\n--- Running verification on first 5 words ---")
    test_chunk = pending_words[:5]
    for w in test_chunk:
        print(f"Scraping '{w['arabic']}' ({w['transliteration']}) -> {w['url']}")
        _, meanings = process_word(w)
        print(f"  Extracted meanings: {meanings}")
        
    # Prompting check: we will run this in background
    print("\nStarting full parallel scrape using ThreadPool...")
    
    # We will process in batches to save progress periodically
    batch_size = 200
    for i in range(0, len(pending_words), batch_size):
        batch = pending_words[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(pending_words)-1)//batch_size + 1} ({len(batch)} words)...")
        
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_word = {executor.submit(process_word, w): w for w in batch}
            
            for future in as_completed(future_to_word):
                word = future_to_word[future]
                try:
                    _, meanings = future.result()
                    if meanings:
                        word["meanings"] = meanings
                        # If the meaning matches our detected lazy list or is empty, use the first crawled meaning
                        if not word.get("meaning") or word["meaning"] == word["transliteration"]:
                            word["meaning"] = meanings[0]
                    else:
                        # Fallback to existing single meaning if none found
                        word["meanings"] = [word["meaning"]] if word.get("meaning") else []
                except Exception as e:
                    print(f"Exception for word {word.get('arabic')}: {e}")
                    
        # Save batch progress
        with open(words_file, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
        print(f"Saved batch progress. {min(i+batch_size, len(pending_words))}/{len(pending_words)} completed.")

if __name__ == "__main__":
    main()
