#!/usr/bin/env python3
"""
Lazy Translation Detector for KalimaCards (Improved Vowel-Free Comparison)
Identifies words in words.json where the meaning is just the transliteration.
"""

import json
import os
import re

def clean_buck(text):
    for c in "oaui~`{<>^#\'":
        text = text.replace(c, '')
    text = text.replace('Y', 'y')
    return text.lower()

def clean_meaning(text):
    text = text.lower().replace('‘', '').replace('’', '').replace('-', '')
    text = text.replace('ā', 'a').replace('ī', 'i').replace('ū', 'u').replace('ḥ', 'h').replace('ṣ', 's').replace('ḍ', 'd').replace('ṭ', 't').replace('ẓ', 'z')
    return re.sub(r'[^a-z]', '', text)

def strip_all_vowels(text):
    return re.sub(r'[aeiouy]', '', text.lower())

def main():
    words_file = "words.json"
    if not os.path.exists(words_file):
        print(f"Error: {words_file} not found.")
        return
        
    with open(words_file, 'r', encoding='utf-8') as f:
        words = json.load(f)
        
    lazy_words = []
    
    # Common correct proper nouns to ignore
    correct_nouns = {
        'Adam', 'Musa', 'Satan', 'Haman', 'Harut', 'Marut', 'Qarun', 
        'Luqman', 'Imran', 'Gog', 'Magog', 'Talut', 'Jalut', 'Madyan',
        'Aad', 'Thamud', 'Noah', 'Lut', 'Babil', 'Egypt'
    }

    for w in words:
        meaning = w.get("meaning", "")
        if meaning in correct_nouns:
            continue
            
        t = clean_buck(w.get("transliteration", ""))
        m = clean_meaning(meaning)
        
        # Skip short particles (len <= 2)
        if len(t) <= 2:
            continue
            
        # Vowel-free versions
        t_vowelfree = strip_all_vowels(t)
        m_vowelfree = strip_all_vowels(m)
        
        match = False
        if t == m or m.startswith(t) or t.startswith(m):
            match = True
        elif t_vowelfree and m_vowelfree and (t_vowelfree == m_vowelfree or m_vowelfree.startswith(t_vowelfree) or t_vowelfree.startswith(m_vowelfree)):
            match = True
            
        if match:
            lazy_words.append(w)
            
    print(f"Detected {len(lazy_words)} lazy transliteration echo translations:")
    for idx, w in enumerate(lazy_words):
        print(f"{idx+1}. {w['arabic']} ({w['transliteration']}) -> \"{w['meaning']}\" (Freq: {w['frequency']})")
        
    # Save to a temporary file
    with open("lazy_detected.json", "w", encoding="utf-8") as f:
        json.dump(lazy_words, f, ensure_ascii=False, indent=2)
    print("Saved flagged words to lazy_detected.json")

if __name__ == "__main__":
    main()
