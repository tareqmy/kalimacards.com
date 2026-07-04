#!/usr/bin/env python3
"""
Translation Patcher for KalimaCards
Replaces modern Google Translate terms in words.json with accurate Classical Quranic meanings.
"""

import json
import os

# Classical Quranic vocabulary translations for the top 100 lemmas
CORRECTIONS = {
    "min": "from, of",
    "{ll~ah": "God (Allah)",
    "fiY": "in, inside, about",
    "<in~": "indeed, surely",
    "EalaY`": "on, upon, against",
    "{l~a*iY": "who, which, that (rel. pronoun)",
    "laA": "no, not",
    "maA": "what, that which, not",
    "rab~": "Lord, Sustainer, Master",
    "<ilaY`": "to, towards",
    "man": "who, whoever",
    "<in": "if, indeed not",
    ">an": "that, to",
    "<il~aA": "except, unless, but",
    "*a`lik": "that",
    "Ean": "about, from, on behalf of",
    ">aroD": "earth, land",
    "qad": "already, indeed, surely",
    "<i*aA": "when, if",
    "qawom": "people, nation",
    "'aAyap": "sign, miracle, verse",
    ">an~": "that",
    "kul~": "all, every, whole",
    "lam": "not, did not",
    "vum~": "then, after that",
    "rasuwl": "messenger, envoy",
    "yawom": "day",
    "Ea*aAb": "torment, punishment",
    "ha`*aA": "this",
    "samaA^'": "sky, heaven",
    "nafos": "self, soul, person",
    "$aYo'": "thing, something",
    ">aw": "or",
    "kita`b": "book, scripture, record",
    "bayon": "between",
    "Haq~": "truth, right, reality",
    "n~aAs": "mankind, people",
    "<i*": "when, behold",
    ">uwla`^}ik": "those",
    "qabol": "before",
    "mu&omin": "believer",
    "law": "if, if only",
    "sabiyl": "way, path",
    ">amor": "command, matter, affair",
    "Eind": "with, near, presence",
    "maE": "with, along with",
    "baEoD": "some, each other",
    "lam~aA": "when, after",
    ">ay~uhaA": "O (vocative particle)",
    "xayor": "good, better",
    "<ila`h": "god, deity",
    "naAr": "fire",
    "gayor": "other than, not, without",
    ">am": "or",
    "muwsaY`": "Moses (Musa)",
    "duwn": "besides, other than, less than",
    "A^xir": "last, end",
    "baEod": "after",
    "qalob": "heart",
    "Eabod": "slave, servant",
    ">ahol": "people, family, dwellers",
    "laEal~": "perhaps, so that",
    "bal": "but rather, nay",
    "yad": "hand",
    "ka`firuwn": "disbelievers",
    "raHomap": "mercy",
    "r~aHiym": "Most Merciful",
    ">ajor": "reward, payment",
    "ZaAlim": "unjust, wrongdoer",
    "Eilom": "knowledge",
    "EaZiym": "great, magnificent",
    "lan": "never, won't",
    "Ealiym": "All-Knowing, Wise",
    "jan~ap": "garden, paradise, heaven",
    "Hat~aY`": "until",
    "hal": "whether, do/did (interrogative)",
    "diyn": "religion, way of life, judgment",
    "qawol": "word, statement, saying",
    "*uw": "owner of, possessor of",
    "malak": "angel",
    "maval": "example, likeness",
    "maAl": "wealth, property",
    "waliY~": "guardian, ally, patron",
    "hudFY": "guidance",
    "Hakiym": "wise, judicious",
    "faDol": "grace, bounty, favor",
    "Salaw`p": "prayer, connection",
    "layol": "night",
    "bunaY~": "my little son",
    "$ayoTa`n": "Satan, devil",
    "kayof": "how",
    ">aSoHa`b": "companions, dwellers, people of"
}

def patch_words():
    words_file = "words.json"
    if not os.path.exists(words_file):
        print(f"Error: {words_file} not found.")
        return False
        
    print(f"Loading {words_file}...")
    with open(words_file, 'r', encoding='utf-8') as f:
        words = json.load(f)
        
    patched_count = 0
    for word in words:
        translit = word.get("transliteration")
        if translit in CORRECTIONS:
            old_meaning = word.get("meaning")
            new_meaning = CORRECTIONS[translit]
            
            if old_meaning != new_meaning:
                word["meaning"] = new_meaning
                patched_count += 1
                
    if patched_count > 0:
        print(f"Applying {patched_count} classical corrections to {words_file}...")
        with open(words_file, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
        print("Patch applied successfully.")
    else:
        print("No differences found. words.json is already fully patched.")
    return True

if __name__ == "__main__":
    patch_words()
