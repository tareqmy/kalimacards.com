#!/usr/bin/env python3
"""
Quranic Lemmas Translator (High Performance & Resilient)
Translates scraped lemmas from scraped_lemmas.json into English programmatically.
Uses a direct Google Translate API endpoint with strict 10s timeouts, 
batching, and automatic retry backoff to avoid rate limit hangs.
Saves progress incrementally.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error

def translate_single_direct(arabic_word):
    """Translate a single word using the direct Google Translate API endpoint"""
    encoded_word = urllib.parse.quote(arabic_word)
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q={encoded_word}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    # Try up to 3 times with exponential backoff on HTTP/Network errors
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res = json.loads(response.read().decode('utf-8'))
                if res and res[0] and res[0][0] and res[0][0][0]:
                    return res[0][0][0].strip()
        except Exception as e:
            wait_time = (attempt + 1) * 3
            print(f"    [Single Fallback] Attempt {attempt+1} failed for '{arabic_word}': {e}. Retrying in {wait_time}s...", flush=True)
            time.sleep(wait_time)
            
    return None

def translate_batch_direct(arabic_words):
    """Translate a list of words in a single batch using newline separation"""
    combined_text = "\n".join(arabic_words)
    encoded_text = urllib.parse.quote(combined_text)
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q={encoded_text}"
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    # Try up to 3 times with backoff on HTTP/Network errors
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                res = json.loads(response.read().decode('utf-8'))
                
                # Parse translated parts
                translations = []
                if res and res[0]:
                    for part in res[0]:
                        if part and part[0]:
                            translations.append(part[0].strip())
                            
                # Google Translate sometimes merges lines if it thinks they belong together,
                # so we verify the size matches our input batch size.
                if len(translations) == len(arabic_words):
                    return translations
                else:
                    print(f"    [Batch warning] Size mismatch. Sent {len(arabic_words)}, got {len(translations)}. Triggering single-word fallback.", flush=True)
                    return None
                    
        except Exception as e:
            wait_time = (attempt + 1) * 4
            print(f"    [Batch Error] Attempt {attempt+1} failed: {e}. Retrying in {wait_time}s...", flush=True)
            time.sleep(wait_time)
            
    return None

def main():
    input_file = "scraped_lemmas.json"
    output_file = "words.json"
    
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} not found. Run the scraper first.", flush=True)
        sys.exit(1)

    # Default to translating all words
    limit = 3680
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            print(f"Invalid limit '{sys.argv[1]}'. Translating all words.", flush=True)

    print(f"Reading lemmas from {input_file}...", flush=True)
    with open(input_file, 'r', encoding='utf-8') as f:
        lemmas = json.load(f)
        
    lemmas.sort(key=lambda x: x.get("frequency", 0), reverse=True)
    
    # Load existing translations to skip already completed work
    translated_dict = {}
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                existing_words = json.load(f)
                for w in existing_words:
                    if w.get("meaning") and w["meaning"] != "[Translation Missing]" and w["meaning"] != "":
                        translated_dict[w["transliteration"]] = w["meaning"]
            print(f"Found {len(translated_dict)} existing translations in {output_file}.", flush=True)
        except Exception:
            print(f"Could not load existing {output_file}, starting fresh.", flush=True)

    words_to_translate = lemmas[:limit]
    print(f"Targeting {len(words_to_translate)} total words.", flush=True)
    
    pending_words = [w for w in words_to_translate if w["transliteration"] not in translated_dict]
    already_translated = [w for w in words_to_translate if w["transliteration"] in translated_dict]
    
    final_output = []
    for w in already_translated:
        w["meaning"] = translated_dict[w["transliteration"]]
        final_output.append(w)
        
    if not pending_words:
        print("All targeted words are already translated!", flush=True)
        sys.exit(0)

    print(f"{len(pending_words)} words are pending translation.", flush=True)
    
    start_time = time.time()
    translated_count = 0
    batch_size = 50
    
    for i in range(0, len(pending_words), batch_size):
        chunk = pending_words[i:i + batch_size]
        arabic_texts = [w["arabic"] for w in chunk]
        
        batch_num = i // batch_size + 1
        total_batches = -(-len(pending_words) // batch_size)
        print(f"Translating batch {batch_num}/{total_batches} (Words {i+1} to {min(i+batch_size, len(pending_words))})...", flush=True)
        
        # Request batch translation
        batch_translations = translate_batch_direct(arabic_texts)
        
        # Fallback to single queries if batch failed
        if batch_translations is None:
            print("    [Fallback] Batch query failed. Querying words one-by-one...", flush=True)
            batch_translations = []
            for idx, w in enumerate(chunk):
                single_t = translate_single_direct(w["arabic"])
                if single_t:
                    batch_translations.append(single_t)
                else:
                    batch_translations.append("[Translation Missing]")
                time.sleep(0.5)
        
        # Apply translations
        for idx, w in enumerate(chunk):
            meaning = batch_translations[idx]
            w["meaning"] = meaning if meaning != "[Translation Missing]" else ""
            if w["meaning"]:
                translated_count += 1
            final_output.append(w)
            
        # Re-sort list by frequency descending before saving
        final_output.sort(key=lambda x: x.get("frequency", 0), reverse=True)
        
        # Save to file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, ensure_ascii=False, indent=2)
            
        print(f"    Saved progress. Current database size: {len(final_output)} words.", flush=True)
        
        # Polite delay to avoid IP blocking
        time.sleep(1.8)

    duration = time.time() - start_time
    print("\n--- Translation Job Complete ---", flush=True)
    print(f"Translated {translated_count} new words in {duration:.2f} seconds.", flush=True)
    print(f"Saved total of {len(final_output)} translated words to {output_file}.", flush=True)
    print(f"To use these in your app, refresh http://localhost:8000", flush=True)

if __name__ == "__main__":
    main()
