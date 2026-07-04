#!/usr/bin/env python3
"""
Corpus Parser for KalimaCards
Converts a CSV list of Quranic words with columns [Arabic, Transliteration, Meaning, Frequency]
into the structured JSON schema required by the web application.
"""

import csv
import json
import os
import sys

def csv_to_quran_json(csv_filepath, json_filepath):
    words = []
    
    if not os.path.exists(csv_filepath):
        print(f"Error: CSV file not found at {csv_filepath}", file=sys.stderr)
        print("Please ensure your CSV file exists and has the correct path.", file=sys.stderr)
        return False
        
    print(f"Reading vocabulary data from {csv_filepath}...")
    try:
        with open(csv_filepath, mode='r', encoding='utf-8-sig') as f: # utf-8-sig handles BOM if exported from Excel
            reader = csv.DictReader(f)
            
            # Normalize fieldnames to lowercase to handle casing variations
            fieldnames = [field.lower().strip() for field in (reader.fieldnames or [])]
            
            # Define key mapping
            map_arabic = 'arabic'
            map_translit = 'transliteration'
            map_meaning = 'meaning'
            map_freq = 'frequency'
            
            # Verify required columns exist
            required = [map_arabic, map_translit, map_meaning, map_freq]
            missing = [req for req in required if req not in fieldnames]
            if missing:
                print(f"Error: Missing required column(s): {', '.join(missing)}", file=sys.stderr)
                print(f"CSV Columns found: {', '.join(reader.fieldnames or [])}", file=sys.stderr)
                print("Make sure your CSV columns are: Arabic, Transliteration, Meaning, Frequency", file=sys.stderr)
                return False
            
            # Build lookups mapping lower-cased fields back to the original CSV headers
            header_map = {}
            for original in (reader.fieldnames or []):
                header_map[original.lower().strip()] = original

            for line_no, row in enumerate(reader, start=2):
                arabic_val = row[header_map[map_arabic]].strip()
                translit_val = row[header_map[map_translit]].strip()
                meaning_val = row[header_map[map_meaning]].strip()
                freq_val = row[header_map[map_freq]].strip()
                
                if not arabic_val or not meaning_val:
                    print(f"Warning: Skipping row {line_no} due to empty Arabic or Meaning value.")
                    continue
                
                try:
                    freq_int = int(freq_val.replace(',', '')) # strip commas from numbers
                except ValueError:
                    print(f"Warning: Invalid frequency value '{freq_val}' on row {line_no}. Defaulting to 0.")
                    freq_int = 0
                
                words.append({
                    "arabic": arabic_val,
                    "transliteration": translit_val,
                    "meaning": meaning_val,
                    "frequency": freq_int
                })
    except Exception as e:
        print(f"An error occurred while reading the CSV file: {e}", file=sys.stderr)
        return False
                
    # Sort by frequency descending by default
    words.sort(key=lambda x: x["frequency"], reverse=True)
    
    # Save JSON file
    print(f"Writing parsed schema to {json_filepath}...")
    try:
        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"An error occurred while writing the JSON file: {e}", file=sys.stderr)
        return False
        
    print(f"Successfully processed {len(words)} words. Saved to {json_filepath}.")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 parse_corpus.py <path_to_csv_file> [output_json_path]")
        print("Example: python3 parse_corpus.py my_quran_words.csv ../words.json")
        sys.exit(1)
        
    csv_file = sys.argv[1]
    json_output = sys.argv[2] if len(sys.argv) > 2 else "../words.json"
    
    success = csv_to_quran_json(csv_file, json_output)
    sys.exit(0 if success else 1)
