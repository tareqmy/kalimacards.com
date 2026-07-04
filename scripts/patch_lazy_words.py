#!/usr/bin/env python3
"""
KalimaCards Database Patch Script
Corrects lazy, modern colloquial, and transliteration-echo translations
in words.json to their precise Classical Quranic meanings.
"""

import json
import os

CORRECTIONS = {
    # High Frequency & Important corrections
    "r~aHoma`n": "Most Gracious, Beneficent",
    "kaAfir": "disbeliever, denier",
    "kayod": "plot, scheme, plan",
    "ziynap": "adornment, beauty, decoration",
    ">amiyn": "trustworthy, secure, faithful",
    "riDowa`n": "pleasure, approval, acceptance",
    "Haliym": "forbearing, clement",
    "Eadon": "Eden, everlasting residence",
    "najowaY`^": "private conversation, secret counsel",
    "HusonaY`": "best, finest, ultimate good",
    "saEoy": "striving, effort, endeavor",
    "EaAbid": "worshipper, servant",
    "Earabiy~": "Arabic, clear Arabic",
    "'aAminiyn": "secure ones, safe ones",
    "qariyn": "companion, intimate associate",
    "jaA^n~": "jinn, spirit, invisible being",
    "HafiyZ": "guardian, protector, preserver",
    "EaAkif": "one who remains, devoted, staying in retreat",
    "hadoy": "sacrificial offering, gift",
    "sakiynap": "tranquility, calm, reassurance",
    "siyma`": "sign, mark, characteristic",
    "ga`wiyn": "deviators, those who go astray",
    "ha`ma`n": "Haman (minister of Pharaoh)",
    ">asobaAT": "Tribes (of Israel), descendants",
    ">aw~aAb": "oft-returning (in repentance)",
    ">ay~aAn": "when, at what time",
    "EaTaA^'": "gift, giving, bestowal",
    "miroyap": "doubt, skepticism",
    "suloTa`n": "authority, power, clear proof",
    "'aAl": "family, people, followers",
    "kifol": "portion, double portion, share",
    "baAl": "mind, state, condition",
    "jaAr": "neighbor, protector, ally",
    "raA^d~": "one who returns, brings back",
    "baAd": "dweller of the desert, nomad",
    "jaAz": "one who rewards, recompenses",
    "HaA^j~": "pilgrim, one who disputes",
    "garaAm": "continuous torment, permanent loss",
    "haAr": "crumbling, ready to fall",
    "riyE": "high place, elevated ground, hill",
    "baAdiY": "apparent, visible, desert dweller",
    "Eamor": "life, lifetime",
    "m~aniY~": "semen, fluid emitted",
    "libad": "crowds, abundant, heaps",
    "n~ayol": "acquisition, obtaining, harm inflicted",
    "mayol": "deviation, inclining, turning away",
    "Hala`^}il": "wives",
    "'aAnaA^'": "hours, intervals of the night",
    "tatoraA": "successively, in succession",
    "tasoniym": "Tasnim (spring in Paradise)",
    "salosabiyl": "Salsabil (spring in Paradise)",
    "siyrat": "state, condition, form",
    "siyniyn": "Sinai (Mount Sinai)",
    "Eurub": "loving, devoted (wives)",
    "EiSam": "ties, bonds, marriage ties",
    "EaSiy~": "disobedient, rebellious",
    "humazap": "slanderer, backbiter",
    "l~umazap": "slanderer, backbiter",
    "m~ariy^_#": "wholesome, healthy, digestible",
    "misaAs": "touching, contact",
    "budon": "sacrificial camels, fat cattle",
    ">amad": "span of time, term, period",
    ">af~aAk": "habitual liar, slanderer",
    "baSTap": "abundance, increase, stature",
    "Ha`$": "exalted is, far removed is",
    "rufa`t": "decayed bones, dust, fragments",
    "sunbula`t": "ears of grain, spikes of corn",
    "luqoma`n": "Luqman (the wise man)",
    "manSuwr": "helped, victorious",
    "mawa`liY": "successors, heirs, allies",
    "nazog": "whisper, instigation (of Satan)",
    "hayo_#ap": "form, shape, appearance",
    "waASib": "constant, perpetual, lasting",
    "yusoraY`": "ease, easier way",
    "Hamiyd": "praiseworthy, commendable",
    "musolim": "Muslim, one who submits",
    "A^m~iyn": "those heading towards, intending",
    ">abaAbiyl": "flocks, flights (of birds)",
    ">aHoqaAb": "long periods of time, epochs",
    ">aHoqaAf": "sand dunes, wind-curved sand hills",
    ">aHomad": "Ahmad (praised one)",
    ">aHowaY`": "dark, blackish, dried up (vegetation)",
    ">aEojamiyn": "non-Arabs, foreigners",
    "afonaAn": "lush branches, spreading twigs",
    ">akoram": "most noble, most generous",
    "{loEuz~aY`": "Al-Uzza (pagan goddess)",
    "{ll~a`t": "Al-Lat (pagan goddess)",
    ">ankaAl": "fetters, heavy shackles",
    "<iyaAb": "return, coming back",
    ">aya`maY`": "single, unmarried persons",
    "baAbil": "Babylon",
    "baAsirap": "gloomy, frowning, despondent",
    "baAsiqa`t": "tall, lofty (palm trees)",
    "bidaAr": "haste, in a hurry",
    "baEol2": "husband, spouse, lord",
    "t~a`liya`t": "those who recite, reciters",
    "tabaAb": "ruin, destruction, loss",
    "tabaAr": "ruin, destruction",
    "taHil~ap": "dissolution (of vows), absolution",
    "Hasiyb": "reckoner, accountant, sufficient",
    "Hasiyr": "fatigued, weary, exhausted",
    "HawaAyaA^": "entrails, intestines",
    "dara`him": "dirhams, silver coins",
    "diynaAr": "dinar, gold coin",
    "r~aAbiy": "growing, swelling, overflowing",
    "r~aqiym": "inscription, tablet",
    "rukobaAn": "riders, mounted",
    "ramaDaAn": "Ramadan (month of fasting)",
    "rahow": "parted, calm, furrow",
    "z~abaAniyap": "guardians of Hell, angels of punishment",
    "zaraAbiY~": "cushions, rich carpets",
    "zakiy~ap": "pure, innocent",
    "zamohariyr": "extreme cold, bitter frost",
    "zaniym": "ignoble, base-born, outcast",
    "zayod": "Zaid",
    "sa`mir": "one who converses by night",
    "sanaA": "gleam, flash, brightness",
    "sunbul": "ear of grain, spike of corn",
    "suwaAE": "Suwa' (ancient idol)",
    "s~uw^>aY`": "evil, worst (consequence)",
    "sayonaA^'": "Sinai",
    "S~ariym": "harvested land, dark night, ashes",
    "S~afaA": "Al-Safa (a hill in Mecca)",
    "SafoSaf": "level plain, smooth land",
    "SafowaAn": "smooth stone, large smooth rock",
    "SawaA^f~": "lined up, standing in rows",
    "SuwaAE": "drinking cup, measuring bowl",
    "Say~ib": "rainstorm, heavy downpour",
    "Dayor": "harm, damage, hurt",
    "DiyzaY`": "unfair, unjust",
    "TaloH": "acacia trees, banana trees",
    "Ea`diya`t": "chargers, running horses",
    "Earafa`t": "Arafat (a place near Mecca)",
    "Earim": "dike, dam (flood)",
    "Euzayor": "Ezra (Uzair)",
    "Eiziyn": "groups, separate crowds",
    "EusoraY`": "difficulty, hardship",
    "EaSiyb": "distressing, difficult, grim",
    "EuloyaA": "uppermost, highest",
    "EimaAd": "pillars, lofty structures",
    "EawaAn": "middle-aged (cow), intermediate",
    "Eiyd": "festival, solemn feast",
    "fa`rihiyn": "skilled, boastful, joyful",
    "fat~aAH": "supreme judge, opener",
    "fariy~": "unprecedented thing, grave thing",
    "faSiylat": "closest family, kin, clan",
    "qatarap": "dust, darkness, gloom",
    "qiTomiyr": "date-stone membrane, speck",
    "qamoTariyr": "distressful, grim, harsh (day)",
    "qinowaAn": "clusters of dates, hanging bunches",
    "laAhiyap": "distracted, heedless",
    "laZaY`": "blazing fire, raging flame (Hell)",
    "m~aHosuwr": "exhausted, regretful, penniless",
    "m~asofuwH": "poured out, shed (blood)",
    "ma`lik2": "king, owner, master",
    "miraA^'": "argument, dispute",
    "marowap": "Al-Marwah (a hill in Mecca)",
    "musa`fiHa`t": "unchaste women, committing fornication",
    "m~usofirap": "bright, shining, beaming",
    "misok": "musk (perfume)",
    "muS~ad~iqa`t": "women who give charity",
    "muTaf~ifiyn": "those who give short measure, defrauders",
    "m~aEar~ap": "harm, sin, distress",
    "mula`q": "one who meets, meeting",
    "maliy~": "a long time",
    "maliyk": "King, Sovereign",
    "manaAkib": "shoulders, paths, tracts",
    "manaw`p": "Manat (pagan goddess)",
    "miykaY`l": "Michael (angel Michael)",
    "m~ayolap": "deviation, single turn",
    "n~a`ziEa`t": "those who extract, pull out",
    "naAsikuw": "those who perform rites, observers of sacrifice",
    "n~ajodayon": "two ways, two paths (of good and evil)",
    "nadiy~": "assembly, council, gathering place",
    "n~aDiyd": "piled high, layered",
    "nafiyr": "manpower, force, army",
    "n~akiyr": "denial, condemnation, punishment",
    "namaAriq": "cushions, pillows",
    "ham~aAz": "slanderer, defamer, constant backbiter",
    "hiym": "thirsty camels",
    "waSiylap": "a camel consecrated to idols",
    "aAsin": "altered, stagnant, polluted (water)",
    "kfl": "portion, double portion, share",
    # Additional proper nouns cleanup
    "A^dam": "Adam",
    "ha`ruwt": "Harut (angel)",
    "ma`ruwt": "Marut (angel)",
    "qa`ruwn": "Qarun (Korah)",
    "Eimora`n": "Imran",
    "ya`juwj": "Gog (Yajuj)",
    "ma`juwj": "Magog (Majuj)",
    "TaAluwt": "Saul (Talut)",
    "jaAluwt": "Goliath (Jalut)",
    "madyan": "Madyan (Midian)",
    "EaAd": "Aad (ancient tribe)",
    "vamuwd": "Thamud (ancient tribe)"
}

def main():
    words_file = "words.json"
    if not os.path.exists(words_file):
        print(f"Error: {words_file} not found.")
        return
        
    with open(words_file, 'r', encoding='utf-8') as f:
        words = json.load(f)
        
    patched_count = 0
    
    # Process each word in database
    for w in words:
        translit = w.get("transliteration", "")
        # Clean transliteration to check against keys
        clean_key = translit.strip()
        
        # Check direct mapping
        if clean_key in CORRECTIONS:
            old_meaning = w.get("meaning", "")
            new_meaning = CORRECTIONS[clean_key]
            if old_meaning != new_meaning:
                w["meaning"] = new_meaning
                patched_count += 1
                
    if patched_count > 0:
        with open(words_file, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
        print(f"Successfully patched {patched_count} word meanings in words.json!")
    else:
        print("No new corrections applied. All meanings match current correction rules.")

if __name__ == "__main__":
    main()
