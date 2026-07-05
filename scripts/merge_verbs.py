#!/usr/bin/env python3
"""
Merge Verbs Script
Merges scraped_verbs.json into words.json, sorting by frequency descending.
"""

import json
import os
import sys

def merge_data(words_filepath, verbs_filepath):
    if not os.path.exists(words_filepath):
        print(f"Error: {words_filepath} not found.")
        return False
    if not os.path.exists(verbs_filepath):
        print(f"Error: {verbs_filepath} not found.")
        return False

    print(f"Loading existing words from {words_filepath}...")
    with open(words_filepath, 'r', encoding='utf-8') as f:
        words = json.load(f)

    print(f"Loading scraped verbs from {verbs_filepath}...")
    with open(verbs_filepath, 'r', encoding='utf-8') as f:
        verbs = json.load(f)

    # Build a lookup of existing words by key
    words_lookup = {f"{w['arabic']}_{w['transliteration']}": w for w in words}

    added_count = 0
    updated_count = 0
    for verb in verbs:
        key = f"{verb['arabic']}_{verb['transliteration']}"
        if key in words_lookup:
            # Update root if present in verb
            if "root" in verb:
                words_lookup[key]["root"] = verb["root"]
                updated_count += 1
        else:
            # Ensure meanings is a list
            if "meanings" not in verb or not verb["meanings"]:
                verb["meanings"] = []
            
            # Clean meanings: remove "to " prefix for cleaner representation if needed, 
            # but keep the original translation as well.
            cleaned_meanings = []
            for m in verb["meanings"]:
                cleaned_meanings.append(m)
                if m.startswith("to "):
                    cleaned_meanings.append(m[3:]) # e.g. "to say" -> "say"
            
            verb["meanings"] = list(dict.fromkeys(cleaned_meanings)) # deduplicate
            
            words.append(verb)
            words_lookup[key] = verb
            added_count += 1

    print(f"Added {added_count} new verbs to the dataset.")
    print(f"Updated {updated_count} existing verbs with root information.")
    
    # Sort all by frequency descending
    words.sort(key=lambda x: x.get("frequency", 0), reverse=True)

    print(f"Saving merged dataset back to {words_filepath}...")
    with open(words_filepath, 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, indent=2)

    print("Merge complete!")
    return True

if __name__ == "__main__":
    words_file = "words.json"
    verbs_file = "scraped_verbs.json"
    
    if len(sys.argv) > 1:
        words_file = sys.argv[1]
    if len(sys.argv) > 2:
        verbs_file = sys.argv[2]
        
    merge_data(words_file, verbs_file)
