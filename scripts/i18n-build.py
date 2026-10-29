"""Builds public/i18n/<lang>.json from i18n-src/keys.json (English texts) and i18n-src/<lang>.tsv.

Each TSV line is "<index>\t<translation>", or "@<English text>\t<translation>" for texts added later.
Checks that every {placeholder} survives translation. Run: python3 scripts/i18n-build.py
"""
import json, re, sys, glob, os

keys = json.load(open('i18n-src/keys.json'))
ok = True
for tsv in sorted(glob.glob('i18n-src/*.tsv')):
    lang = os.path.basename(tsv)[:-4]
    out = {}
    for n, line in enumerate(open(tsv, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        ref, _, text = line.partition('\t')
        key = ref[1:] if ref.startswith('@') else keys[int(ref)]
        if set(re.findall(r'\{\w+\}', key)) != set(re.findall(r'\{\w+\}', text)):
            print(f'{lang}:{n} placeholders differ: {key!r} -> {text!r}')
            ok = False
        # Keep the spacing at the edges of sentence fragments ("Free accounts can have ").
        lead = key[: len(key) - len(key.lstrip())]
        trail = key[len(key.rstrip()):]
        out[key] = lead + text.strip() + trail
    json.dump(out, open(f'public/i18n/{lang}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{lang}: {len(out)} texts')
sys.exit(0 if ok else 1)
