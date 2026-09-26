#!/usr/bin/env python3
"""
Genera las versiones EN y DE de cada variante a partir del index.html en
español (ya etiquetado con data-i18n) y de los diccionarios de i18n/.

Salida:  <variante>/en/index.html  y  <variante>/de/index.html

Es idempotente: se puede reejecutar tras cualquier cambio de contenido.

    python3 tools/i18n_build.py
"""
import json, re, sys
from pathlib import Path
from lxml import html as LH, etree

RAIZ = Path(__file__).resolve().parent.parent
VARIANTES = ['v1-editorial', 'v2-cinematic', 'v3-investor']
IDIOMAS = ['en', 'de']

META = {
    'en': {'sufijo': 'Serviced residences in Nusa Dua, Bali'},
    'de': {'sufijo': 'Serviced Residences in Nusa Dua, Bali'},
    'es': {'sufijo': 'Residencias con servicios en Nusa Dua, Bali'},
}
NOMBRE = {'es': 'ES', 'en': 'EN', 'de': 'DE'}

# atributos que el extractor pudo marcar
ATTR_MAP = {'data-i18n-alt': 'alt', 'data-i18n-title': 'title',
            'data-i18n-aria': 'aria-label', 'data-i18n-placeholder': 'placeholder'}


def traducir(root, dic, lang):
    faltan = set()

    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        k = el.get('data-i18n')
        if k:
            if k in dic:
                # El extractor guardó el texto normalizado, pero el espacio que
                # rodea a un elemento hermano (p. ej. "98K " antes de <small>USD</small>)
                # es significativo: se reinyecta tal cual estaba.
                orig = el.text or ''
                pre = orig[:len(orig) - len(orig.lstrip())]
                post = orig[len(orig.rstrip()):]
                el.text = pre + dic[k] + post
            else:
                faltan.add(k)
        for marca, real in ATTR_MAP.items():
            kk = el.get(marca)
            if kk:
                if kk in dic:
                    el.set(real, dic[kk])
                else:
                    faltan.add(kk)

    # idioma del documento
    root.set('lang', lang)

    # selector: rutas relativas y marca de idioma activo
    for sw in root.xpath('//*[@data-langsw]'):
        for a in sw.xpath('./a'):
            l = a.get('data-lang')
            a.set('href', '../' if l == 'es' else ('./' if l == lang else f'../{l}/'))
            if l == lang:
                a.set('aria-current', 'page')
            elif a.get('aria-current'):
                del a.attrib['aria-current']

    # enlaces alternativos para buscadores
    head = root.find('head')
    for link in head.xpath('./link[@rel="alternate"]'):
        head.remove(link)
    for l in ['es'] + IDIOMAS:
        ln = etree.SubElement(head, 'link')
        ln.set('rel', 'alternate')
        ln.set('hreflang', l)
        ln.set('href', '../' if l == 'es' else ('./' if l == lang else f'../{l}/'))
    ln = etree.SubElement(head, 'link')
    ln.set('rel', 'alternate'); ln.set('hreflang', 'x-default'); ln.set('href', '../')

    return faltan


def reescribir_rutas(html_str):
    """La página vive un nivel más abajo: los recursos suben uno."""
    for attr in ('src', 'href', 'data-tally-src', 'data-lead-logo'):
        for carpeta in ('assets/', 'css/', 'js/', 'i18n/'):
            html_str = html_str.replace(f'{attr}="{carpeta}', f'{attr}="../{carpeta}')
    # srcset y url() por si aparecen
    html_str = re.sub(r'url\((["\']?)(assets/)', r'url(\1../\2', html_str)
    return html_str


def main():
    dics = {l: json.loads((RAIZ / 'i18n' / f'{l}.json').read_text()) for l in IDIOMAS}
    problemas = 0

    for v in VARIANTES:
        base = RAIZ / v / 'index.html'
        if not base.exists():
            print(f'  ✗ falta {base}'); problemas += 1; continue

        for lang in IDIOMAS:
            root = LH.parse(str(base)).getroot()
            faltan = traducir(root, dics[lang], lang)

            # título y descripción
            for t in root.xpath('//title'):
                t.text = f'The One Bali — {META[lang]["sufijo"]}'
            for m in root.xpath('//meta[@name="description"]'):
                k = m.get('data-i18n-content')
                if k and k in dics[lang]:
                    m.set('content', dics[lang][k])

            out = RAIZ / v / lang
            out.mkdir(exist_ok=True)
            s = etree.tostring(root, encoding='unicode', method='html',
                               doctype='<!DOCTYPE html>')
            (out / 'index.html').write_text(reescribir_rutas(s))

            aviso = f'  ⚠ {len(faltan)} sin traducir' if faltan else ''
            print(f'  {v}/{lang}/index.html{aviso}')
            if faltan:
                problemas += 1
                print(f'     {sorted(faltan)[:6]}')

    # el selector del index en español también necesita sus hreflang
    for v in VARIANTES:
        p = RAIZ / v / 'index.html'
        root = LH.parse(str(p)).getroot()
        head = root.find('head')
        for link in head.xpath('./link[@rel="alternate"]'):
            head.remove(link)
        for l in ['es'] + IDIOMAS:
            ln = etree.SubElement(head, 'link')
            ln.set('rel', 'alternate'); ln.set('hreflang', l)
            ln.set('href', './' if l == 'es' else f'{l}/')
        ln = etree.SubElement(head, 'link')
        ln.set('rel', 'alternate'); ln.set('hreflang', 'x-default'); ln.set('href', './')
        p.write_text(etree.tostring(root, encoding='unicode', method='html',
                                    doctype='<!DOCTYPE html>'))

    print('\n  OK' if not problemas else f'\n  {problemas} avisos')
    return 1 if problemas else 0


if __name__ == '__main__':
    sys.exit(main())
