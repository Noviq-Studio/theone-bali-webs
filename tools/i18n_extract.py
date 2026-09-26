#!/usr/bin/env python3
"""
Etiqueta el HTML de una variante con claves data-i18n y extrae el diccionario ES.

La clave es un hash del texto español normalizado: la misma frase recibe la misma
clave en V1, V2 y V3, así que un único diccionario sirve para las tres webs.

    python3 tools/i18n_extract.py v1-editorial v2-cinematic v3-investor
"""
import hashlib, json, re, sys
from pathlib import Path
from lxml import html as LH, etree

SKIP_TAGS = {'script', 'style', 'noscript', 'svg', 'path', 'iframe'}
ATTRS = ('alt', 'title', 'aria-label', 'placeholder')

# texto que NO se traduce: cifras, símbolos, marcas y unidades
NO_TRAD = re.compile(r'''^(
      [\d\s.,:;·+%\-–—/()°²ªº#&|]*        # sólo números y símbolos
    | m²|USD|K\ USD|G\+3|Q[1-4]\ \d{4}
    | The\ One(\ Bali)?|Almal|Wyndham|Registry(\ Collection)?(\ Hotels)?
    | Bali|Nusa\ Dua|Dubái|Dubai|Indonesia|Tailandia|UAE
    | theonebyalmal\.com|www\..*
    )$''', re.X | re.I)

def traducible(t: str) -> bool:
    t = t.strip()
    if len(t) < 2:
        return False
    if not re.search(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]', t):
        return False
    return not NO_TRAD.match(t)

def clave(t: str) -> str:
    norm = re.sub(r'\s+', ' ', t.strip())
    return 't' + hashlib.sha1(norm.encode()).hexdigest()[:8]

def procesar(ruta: Path, dic: dict) -> int:
    doc = LH.parse(str(ruta))
    root = doc.getroot()
    n = 0

    for el in root.iter():
        if not isinstance(el.tag, str) or el.tag.lower() in SKIP_TAGS:
            continue
        # los contadores los pinta main.js: no tocarlos
        if el.get('data-count') is not None:
            continue

        # --- atributos traducibles ---
        for a in ATTRS:
            v = el.get(a)
            if v and traducible(v):
                k = clave(v)
                dic[k] = re.sub(r'\s+', ' ', v.strip())
                el.set(f'data-i18n-{a.replace("aria-label","aria")}', k)
                n += 1

        hijos = [c for c in el if isinstance(c.tag, str)]

        # --- texto propio del elemento ---
        if el.text and traducible(el.text):
            k = clave(el.text)
            dic[k] = re.sub(r'\s+', ' ', el.text.strip())
            if not hijos:
                el.set('data-i18n', k)          # elemento hoja: se etiqueta directo
            else:
                w = etree.Element('span')        # contenido mixto: se envuelve
                w.set('data-i18n', k)
                w.text = el.text
                el.text = None
                el.insert(0, w)
            n += 1

        # --- texto que cuelga después de cada hijo (tail) ---
        for hijo in list(hijos):
            if hijo.tail and traducible(hijo.tail):
                k = clave(hijo.tail)
                dic[k] = re.sub(r'\s+', ' ', hijo.tail.strip())
                w = etree.Element('span')
                w.set('data-i18n', k)
                w.text = hijo.tail
                hijo.tail = None
                hijo.addnext(w)
                n += 1

    salida = etree.tostring(root, encoding='unicode', method='html', doctype='<!DOCTYPE html>')
    ruta.write_text(salida)
    return n

def main():
    raiz = Path(__file__).resolve().parent.parent
    dic = {}
    total = 0
    for v in sys.argv[1:]:
        p = raiz / v / 'index.html'
        if not p.exists():
            print(f'  ✗ no existe {p}'); continue
        n = procesar(p, dic)
        total += n
        print(f'  {v}: {n} marcas data-i18n')

    out = raiz / 'i18n'
    out.mkdir(exist_ok=True)
    (out / 'es.json').write_text(json.dumps(dic, ensure_ascii=False, indent=1, sort_keys=True))
    print(f'\n  {total} marcas · {len(dic)} cadenas únicas -> i18n/es.json')

if __name__ == '__main__':
    main()
