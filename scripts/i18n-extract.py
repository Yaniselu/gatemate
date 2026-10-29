"""Lists every UI text that reaches the translator, and which of them are missing from a language file.
Usage: python3 scripts/i18n-extract.py [lang]   (default ro)"""
import re, glob, json, sys

lang = sys.argv[1] if len(sys.argv) > 1 else 'ro'
LIT = r"'((?:[^'\\]|\\.)+)'"
keys = []
def add(k):
    k = k.replace("\\'", "'")
    if re.search(r'[A-Za-z]{2}', k) and k not in keys: keys.append(k)

files = [f for f in glob.glob('src/app/**/*.ts', recursive=True) + glob.glob('src/app/**/*.html', recursive=True)
         if not f.endswith('.spec.ts') and 'mock-api' not in f and 'legal-content' not in f]
for f in files:
    s = open(f).read()
    for m in re.finditer(LIT + r"\s*\)?\s*\|\s*t\b", s): add(m.group(1))                    # 'X' | t, ('X' | t)
    for m in re.finditer(r"\(([^()]*\?[^()]*:[^()]*)\)\s*\|\s*t\b", s):                       # (c ? 'A' : 'B') | t
        for l in re.finditer(LIT, m.group(1)): add(l.group(1))
    for m in re.finditer(r"\b(?:tr|t)\(\s*(?:[^,()]*\?\s*)?" + LIT + r"(?:\s*:\s*" + LIT + r")?", s):  # tr('X'), tr(c ? 'A' : 'B')
        add(m.group(1))
        if m.group(2): add(m.group(2))
    if f.endswith('.ts'):
        for m in re.finditer(r"\b(label|title|text|body|desc|description|note|hint|tip|subtitle|detail|why|bestLabel|name)\s*:\s*" + LIT, s):
            if m.group(1) == 'name' and 'levels' not in s: continue
            add(m.group(2))
# String arrays rendered through the pipe.
ARRAYS = {'src/app/pages/home/home.page.ts': 'steps', 'src/app/pages/feedback/feedback.page.ts': 'topics',
          'src/app/pages/inflight/inflight.page.ts': 'jetlag', 'src/app/core/data/phrasebook.ts': 'PHRASE_KEYS',
          'src/app/pages/chat-room/chat-room.page.ts': 'REPORT_REASONS'}
for f, name in ARRAYS.items():
    s = open(f).read()
    m = re.search(name + r"\s*=\s*\[(.*?)\]", s, re.S)
    for l in re.finditer(LIT, m.group(1)): add(l.group(1))
for l in re.finditer(r":\s*" + LIT, open('src/app/shared/pipes/status.pipe.ts').read()): add(l.group(1))

dict_ = json.load(open(f'public/i18n/{lang}.json'))
missing = [k for k in keys if k not in dict_]
json.dump(missing, open(f'i18n-src/missing-{lang}.json', 'w'), ensure_ascii=False, indent=0)
print(f'{len(keys)} keys, {len(missing)} missing in {lang} -> i18n-src/missing-{lang}.json')
