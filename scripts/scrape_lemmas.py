#!/usr/bin/env python3
"""
Quranic Corpus Lemmas Scraper (with URL Extraction)
Scrapes all pages of lemmas from https://corpus.quran.com/lemmas.jsp
and outputs the results (including the lemma search URL) into a JSON file.
"""

import time
import csv
import json
import urllib.request
import re
from bs4 import BeautifulSoup

def scrape_quranic_lemmas(output_format='json', output_file='scraped_lemmas.json'):
    base_url = "https://corpus.quran.com/lemmas.jsp"
    
    current_page = 1
    total_lemmas_found = 0
    all_lemmas = []
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    print("Starting scraping of Quranic Arabic lemmas and URLs from corpus.quran.com...")
    
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
        
        table = soup.find('table', class_='lemmaTable')
        if not table:
            print(f"No lemma table found on page {current_page}. Stopping.")
            break
            
        rows = table.find_all('tr')
        data_rows = [r for r in rows if 'head' not in r.get('class', [])]
        
        if not data_rows:
            print("No more data rows found. Scraping complete!")
            break
            
        page_entries = 0
        for row in data_rows:
            cols = row.find_all('td')
            if len(cols) < 4:
                continue
                
            # Column 1: Arabic Lemma
            arabic_lemma = cols[0].get_text(strip=True)
            
            # Column 2: Buckwalter & URL Extraction
            buckwalter = cols[1].get_text(strip=True)
            buckwalter_link = cols[1].find('a')
            word_url = ""
            
            if buckwalter_link and buckwalter_link.get('href'):
                href = buckwalter_link.get('href')
                if href.startswith('/'):
                    word_url = f"https://corpus.quran.com{href}"
                else:
                    word_url = f"https://corpus.quran.com/{href}"
            
            # Column 3: Frequency
            freq_str = cols[2].get_text(strip=True)
            try:
                frequency = int(freq_str)
            except ValueError:
                frequency = 0
                
            # Column 4: Part of Speech
            pos = cols[3].get_text(strip=True)
            
            all_lemmas.append({
                "arabic": arabic_lemma,
                "transliteration": buckwalter,
                "frequency": frequency,
                "part_of_speech": pos,
                "url": word_url,
                "meaning": ""
            })
            page_entries += 1
            
        total_lemmas_found += page_entries
        print(f"Successfully parsed {page_entries} lemmas and URLs from page {current_page}.")
        
        # Check if we've reached the end
        nav_info = soup.find(text=re.compile(r'Lemmas \d+ to \d+ of \d+'))
        max_lemmas = 3680
        if nav_info:
            match = re.search(r'of (\d+)', nav_info)
            if match:
                max_lemmas = int(match.group(1))
                
        if total_lemmas_found >= max_lemmas:
            print(f"Reached total expected lemmas count of {max_lemmas}. Stopping.")
            break
            
        current_page += 1
        time.sleep(1.0)

    # Save to file
    if output_format.lower() == 'json':
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_lemmas, f, ensure_ascii=False, indent=2)
        print(f"Successfully saved {len(all_lemmas)} lemmas to JSON: {output_file}")
    else:
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["arabic", "transliteration", "frequency", "part_of_speech", "url", "meaning"])
            writer.writeheader()
            writer.writerows(all_lemmas)
        print(f"Successfully saved {len(all_lemmas)} lemmas to CSV: {output_file}")

if __name__ == "__main__":
    import sys
    fmt = 'json'
    filename = 'scraped_lemmas.json'
    
    if len(sys.argv) > 1:
        fmt = sys.argv[1].lower()
        if fmt not in ['json', 'csv']:
            fmt = 'json'
            
    if len(sys.argv) > 2:
        filename = sys.argv[2]
    else:
        filename = f"scraped_lemmas.{fmt}"
        
    scrape_quranic_lemmas(output_format=fmt, output_file=filename)
