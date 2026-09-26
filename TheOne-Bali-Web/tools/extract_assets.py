#!/usr/bin/env python3
"""Extract every photo, logo, award badge and map from the brochure PDF.

Usage:  tools/.venv/bin/python tools/extract_assets.py [rasters|vectors|all]

Three extraction routes:
  photo      embedded JPEG -> resized JPG (max 2400 px wide)
  alpha      embedded image + its soft mask -> RGBA PNG (base upscaled to mask size)
  whitemask  soft mask only, filled white -> RGBA PNG (white logos on dark pages)
  vector     page rendered with background images removed (and optional text
             redactions) -> RGBA PNG crop, optionally colour-keyed
"""
import sys, os, io
import pymupdf
from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, 'assets', 'brochure.pdf')
OUT = os.path.join(ROOT, 'assets', 'img')
os.makedirs(OUT, exist_ok=True)

MAX_W = 2400
JPG_Q = 85

# name -> (page, xref, kind)
RASTERS = {
    # photos / renders
    'hero-facade':        (1, 2728, 'photo'),
    'aerial-sunset':      (2, 77,   'photo'),
    'bg-beach-blur':      (3, 95,   'photo'),
    'burj-al-arab':       (5, 312,  'photo'),
    'map-route-arcs':     (5, 310,  'alpha'),
    'bg-ocean-boat':      (6, 383,  'photo'),
    'press-construction-week': (7, 443, 'photo'),
    'press-gulf-economist':    (7, 444, 'photo'),
    'press-finance-world':     (7, 445, 'photo'),
    'projects-composite': (9, 555,  'alpha'),
    'dubai-skyline':      (10, 588, 'photo'),
    'magical-aerial':     (11, 623, 'photo'),
    'gallery-01': (12, 629, 'photo'), 'gallery-02': (12, 632, 'photo'), 'gallery-03': (12, 635, 'photo'),
    'gallery-04': (12, 638, 'photo'), 'gallery-05': (12, 641, 'photo'), 'gallery-06': (12, 644, 'photo'),
    'gallery-07': (12, 647, 'photo'), 'gallery-08': (12, 650, 'photo'), 'gallery-09': (12, 653, 'photo'),
    'aerial-villas-day':  (13, 711, 'photo'),
    'bg-ocean-texture':   (14, 1449, 'photo'),
    'map-bali-island':    (14, 732, 'alpha'),
    'map-pin':            (14, 803, 'alpha'),
    'map-nusa-dua-streets': (15, 827, 'alpha'),
    'aerial-night':       (16, 947, 'photo'),
    'facade-night':       (17, 1083, 'photo'),
    'pool-render':        (18, 1114, 'photo'),
    'reception-bell':     (19, 1186, 'photo'),
    'app-woman-phones':   (20, 1233, 'photo'),
    'beach-turquoise':    (21, 1262, 'photo'),
    'facade-pool':        (22, 1311, 'photo'),
    'kelingking':         (23, 1370, 'photo'),
    # badges / logos with masks
    'badge-asia-pacific-awards': (1, 2730, 'alpha'),
    'award-pillars':          (6, 385, 'whitemask'),
    'award-realtek':          (6, 387, 'whitemask'),
    'award-luxury-lifestyle': (6, 389, 'whitemask'),
    'award-uae-realty-2024':  (6, 391, 'whitemask'),
    'award-construction-innovation': (6, 393, 'whitemask'),
    'award-international-property':  (6, 395, 'whitemask'),
    'award-pioneer-50':       (6, 397, 'whitemask'),
    'award-uae-realty-2025':  (6, 399, 'whitemask'),
    'media-logos-strip':      (7, 447, 'alpha'),
    'partner-888':            (8, 480, 'alpha'),
    'partner-sng':            (8, 505, 'alpha'),
    'partner-gplus':          (8, 509, 'alpha'),
    'partner-dgroup':         (8, 524, 'alpha'),
    'project-unexpected':     (9, 557, 'whitemask'),
    'project-harrisoni':      (9, 559, 'whitemask'),
    'hotel-hilton':           (15, 862, 'whitemask'),
    'hotel-ritz-carlton':     (15, 864, 'whitemask'),
    'logo-wyndham-white-lowres':  (24, 1399, 'alpha'),
    'logo-registry-white-lowres': (24, 1401, 'alpha'),
}

def pix_to_pil(pix):
    if pix.n - pix.alpha >= 4:  # CMYK
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    mode = 'RGBA' if pix.alpha else ('RGB' if pix.n == 3 else 'L')
    return Image.frombytes(mode, (pix.width, pix.height), pix.samples)

def smask_xref(page, xref):
    for info in page.get_images(full=True):
        if info[0] == xref:
            return info[1]
    return 0

def save_photo(img, name):
    img = img.convert('RGB')
    if img.width > MAX_W:
        img = img.resize((MAX_W, round(img.height * MAX_W / img.width)), Image.LANCZOS)
    img.save(os.path.join(OUT, name + '.jpg'), quality=JPG_Q, optimize=True, progressive=True)
    return img.size

def extract_rasters(doc):
    for name, (pno, xref, kind) in RASTERS.items():
        page = doc[pno - 1]
        base = pix_to_pil(pymupdf.Pixmap(doc, xref))
        sm = smask_xref(page, xref)
        if kind == 'photo':
            size = save_photo(base, name)
        else:
            mask = pix_to_pil(pymupdf.Pixmap(doc, sm)).convert('L') if sm else None
            if kind == 'whitemask':
                img = Image.new('RGBA', mask.size, (255, 255, 255, 0))
                img.putalpha(mask)
            else:
                img = base.convert('RGBA')
                if mask is not None:
                    if img.size != mask.size:
                        img = img.resize(mask.size, Image.LANCZOS)
                    img.putalpha(mask)
            if img.width > MAX_W:
                img = img.resize((MAX_W, round(img.height * MAX_W / img.width)), Image.LANCZOS)
            img.save(os.path.join(OUT, name + '.png'), optimize=True)
            size = img.size
        print(f'{name:34s} p{pno:<2} {kind:9s} {size[0]}x{size[1]}')

# ---------- vector crops ----------
# Each entry: page, clip (x0,y0,x1,y1 in pt), dpi, images: 'delete_all' | list of xrefs to delete | None,
#             redact: list of (rect, graphics_mode) to remove text/graphics, key: None|'white'|'dark'
VECTORS = {
    # combined wordmark THE ONE | REGISTRY
    'logo-theone-registry-white': dict(page=14, clip=(52, 26, 280, 72), dpi=600, mode='redraw', key=None),
    'logo-theone-registry-dark':  dict(page=2,  clip=(52, 496, 335, 548), dpi=600, images='delete_all', key='dark'),
    # ALMAL
    'logo-almal-white': dict(page=6, clip=(668, 36, 790, 68), dpi=600, mode='redraw', key=None),
    'logo-almal-color': dict(page=8, clip=(668, 36, 790, 68), dpi=600, images='delete_all', key='dark'),
    # Wyndham
    'logo-wyndham-white': dict(page=14, clip=(683, 32, 787, 62), dpi=600, mode='redraw', key=None),
    'logo-wyndham-dark':  dict(page=3,  clip=(420, 96, 552, 136), dpi=600, images='delete_all', key='dark'),
    # The One (Bali) alone, Registry alone, The One by Almal
    'logo-theone-dark':      dict(page=3, clip=(70, 284, 195, 328), dpi=600, images='delete_all', key='dark'),
    'logo-registry-dark':    dict(page=3, clip=(410, 284, 555, 328), dpi=600, images='delete_all', key='dark'),
    'logo-theone-byalmal-white': dict(page=9, clip=(665, 178, 790, 220), dpi=600, mode='redraw', key=None),
    'logo-registry-white':   dict(page=24, clip=(420, 148, 565, 190), dpi=600, images='delete_all', key='white'),
    # Magical Bali Villas
    'logo-magical-villas-white': dict(page=11, clip=(55, 27, 155, 70), dpi=600, mode='redraw', key=None),
    # partners (vector ones)
    'partner-atmos':  dict(page=8, clip=(425, 290, 532, 378), dpi=600, images='delete_all', key='dark'),
    'partner-breasy': dict(page=8, clip=(440, 410, 512, 472), dpi=600, images='delete_all', key='dark'),
    # projects
    'project-smart-space': dict(page=9, clip=(190, 184, 358, 216), dpi=600, mode='redraw', key=None),
    # hotels
    'hotel-kempinski': dict(page=15, clip=(568, 350, 636, 428), dpi=600, mode='redraw', key=None),
    'hotel-mandarin':  dict(page=15, clip=(716, 362, 790, 414), dpi=600, images=None, key='white'),
    # maps (transparent overlays)
    'map-world-route': dict(page=5, clip=(0, 0, 470, 310), dpi=300, mode='redraw', key=None),
    'map-bali': dict(page=14, clip=(150, 0, 842.25, 595.5), dpi=300, images=[1449],
                     redact=[((40, 18, 400, 92), 2), ((40, 92, 400, 480), 0), ((40, 505, 210, 540), 0), ((40, 545, 130, 570), 0), ((680, 15, 795, 66), 2)], key=None),
    'map-nusa-dua': dict(page=15, clip=(0, 0, 560, 595.5), dpi=300, images=[1449],
                         redact=[((40, 18, 400, 92), 2), ((40, 545, 130, 570), 0), ((500, 170, 842, 330), 0), ((470, 336, 842, 445), 1, 2)], key=None),
}

def key_image(img, mode):
    """Turn a flat-background crop into a transparent PNG.
    white: keep white pixels (alpha from min channel) -> pure white logo
    dark : alpha from distance to white; colour un-premultiplied
    """
    img = img.convert('RGBA')
    r, g, b, a = img.split()
    if mode == 'white':
        m = ImageChops.darker(ImageChops.darker(r, g), b)  # min channel
        alpha = m.point(lambda v: 0 if v < 90 else (255 if v > 215 else round((v - 90) / 125 * 255)))
        out = Image.new('RGBA', img.size, (255, 255, 255, 255))
        out.putalpha(ImageChops.multiply(alpha, a))
        return out
    if mode == 'dark':
        inv = ImageChops.invert(img.convert('RGB'))
        ir, ig, ib = inv.split()
        m = ImageChops.lighter(ImageChops.lighter(ir, ig), ib)  # max distance from white
        alpha = m.point(lambda v: 0 if v < 18 else (255 if v > 110 else round((v - 18) / 92 * 255)))
        # un-premultiply against white:  F = (C - (1-a)*255) / a
        px = img.load(); al = alpha.load(); w, h = img.size
        out = Image.new('RGBA', img.size, (0, 0, 0, 0)); op = out.load()
        for y in range(h):
            for x in range(w):
                av = al[x, y]
                if av == 0:
                    continue
                af = av / 255
                R, G, B, _ = px[x, y]
                f = lambda c: max(0, min(255, round((c - (1 - af) * 255) / af)))
                op[x, y] = (f(R), f(G), f(B), av)
        return out
    return img


def render_redraw(doc, pno, clip, dpi, keep_images=None):
    """Replay only the vector paths that intersect `clip` on a blank transparent page
    (skips the full-page white background rects Canva adds) and render the clip."""
    page = doc[pno - 1]
    clip = pymupdf.Rect(*clip)
    out = pymupdf.open(); op = out.new_page(width=page.rect.width, height=page.rect.height)
    shape = op.new_shape()
    n = 0
    for path in page.get_drawings():
        r = pymupdf.Rect(path['rect'])
        if r.width >= page.rect.width * 0.9 and r.height >= page.rect.height * 0.9:
            continue  # page background
        if not r.intersects(clip):
            continue
        for it in path['items']:
            if it[0] == 'l': shape.draw_line(it[1], it[2])
            elif it[0] == 're': shape.draw_rect(it[1])
            elif it[0] == 'qu': shape.draw_quad(it[1])
            elif it[0] == 'c': shape.draw_bezier(it[1], it[2], it[3], it[4])
        lc = path.get('lineCap'); lc = max(lc) if isinstance(lc, (tuple, list)) else (lc or 0)
        so = path.get('stroke_opacity'); fo = path.get('fill_opacity')
        shape.finish(fill=path.get('fill'), color=path.get('color'), dashes=path.get('dashes'),
                     even_odd=bool(path.get('even_odd', True)), closePath=bool(path.get('closePath', True)),
                     lineJoin=path.get('lineJoin') or 0, lineCap=lc, width=path.get('width') or 1,
                     stroke_opacity=1 if so is None else so, fill_opacity=1 if fo is None else fo)
        n += 1
    shape.commit()
    # optionally paste back specific raster images (e.g. the route arcs) at their original rects
    for xref in (keep_images or []):
        for r in page.get_image_rects(xref):
            op.insert_image(r, pixmap=pymupdf.Pixmap(doc, xref), keep_proportion=False)
    pix = op.get_pixmap(clip=clip, dpi=dpi, alpha=True)
    out.close()
    return pix_to_pil(pix), n

def extract_vectors(doc, only=None):
    for name, spec in VECTORS.items():
        if only and name not in only:
            continue
        src = pymupdf.open(PDF)  # fresh copy per crop, we mutate the page
        page = src[spec['page'] - 1]
        imgs = spec.get('images')
        if spec.get('mode') == 'redraw':
            img, n = render_redraw(src, spec['page'], spec['clip'], spec['dpi'], spec.get('keep_images'))
            imgs = None; page = None
        if page is None:
            pass
        elif imgs == 'delete_all':
            for info in page.get_images():
                page.delete_image(info[0])
        elif isinstance(imgs, list):
            for x in imgs:
                page.delete_image(x)
        for red in spec.get('redact', []):
            rect, gmode = red[0], red[1]
            imode = red[2] if len(red) > 2 else 0
            page.add_redact_annot(pymupdf.Rect(*rect))
            page.apply_redactions(images=imode, graphics=gmode)
        if page is not None:
            pix = page.get_pixmap(clip=pymupdf.Rect(*spec['clip']), dpi=spec['dpi'], alpha=True)
            img = pix_to_pil(pix)
        if spec.get('key'):
            img = key_image(img, spec['key'])
        # trim transparent margins
        bbox = img.getchannel('A').getbbox()
        if bbox:
            pad = 6
            bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(img.width, bbox[2]+pad), min(img.height, bbox[3]+pad))
            img = img.crop(bbox)
        if img.width > MAX_W:
            img = img.resize((MAX_W, round(img.height * MAX_W / img.width)), Image.LANCZOS)
        img.save(os.path.join(OUT, name + '.png'), optimize=True)
        print(f'{name:34s} p{spec["page"]:<2} vector    {img.width}x{img.height}')
        src.close()


# crops taken from already-extracted photos: name -> (source, page, xref, box in page points)
CROPS = {
    'app-phones':        ('app-woman-phones', 20, 1233, (612, 191, 823, 456)),
    'app-woman':         ('app-woman-phones', 20, 1233, (70, 158, 236, 596)),
    'app-qr':            ('app-woman-phones', 20, 1233, (459, 398, 495, 434)),
    'badge-google-play': ('app-woman-phones', 20, 1233, (312, 405, 358, 423)),
    'badge-app-store':   ('app-woman-phones', 20, 1233, (364, 405, 412, 423)),
}
MEDIA = {  # cells of media-logos-strip.png (805x450, 4 cols x 5 rows) -> top row only (the 4 shown in the PDF)
    'media-khaleej-times': (0, 0, 200, 90), 'media-gulf-news': (200, 0, 400, 90),
    'media-forbes': (400, 0, 600, 90), 'media-whats-on': (600, 0, 805, 90),
}

def extract_crops(doc):
    for name, (srcname, pno, xref, box) in CROPS.items():
        page = doc[pno - 1]
        r = page.get_image_rects(xref)[0]
        im = pix_to_pil(pymupdf.Pixmap(doc, xref)).convert('RGB')
        sx, sy = im.width / r.width, im.height / r.height
        px = (round((box[0]-r.x0)*sx), round((box[1]-r.y0)*sy), round((box[2]-r.x0)*sx), round((box[3]-r.y0)*sy))
        c = im.crop(px)
        c.save(os.path.join(OUT, name + '.jpg'), quality=JPG_Q, optimize=True)
        print(f'{name:34s} p{pno:<2} crop      {c.width}x{c.height}')
    strip = Image.open(os.path.join(OUT, 'media-logos-strip.png')).convert('RGBA')
    for name, box in MEDIA.items():
        c = strip.crop(box); bb = c.getchannel('A').getbbox(); c = c.crop(bb) if bb else c
        c.save(os.path.join(OUT, name + '.png'), optimize=True)
        print(f'{name:34s} p7  media     {c.width}x{c.height}')

def postprocess():
    """Composite the route arcs on the world map, flatten the projects strip, derive extra logo colours."""
    S = 300 / 72
    if not os.path.exists(os.path.join(OUT, 'map-world-route.png')):
        return print('postprocess: nothing to do')
    world = Image.open(os.path.join(OUT, 'map-world-route.png')).convert('RGBA')
    arcs = Image.open(os.path.join(OUT, 'map-route-arcs.png')).convert('RGBA')
    x0, y0, x1, y1 = 183, 106, 362, 231  # placement rect of the arcs on page 5 (pt)
    world.save(os.path.join(OUT, 'map-world.png'), optimize=True)        # continents + planes only
    arcs = arcs.resize((round((x1-x0)*S), round((y1-y0)*S)), Image.LANCZOS)
    arcs.save(os.path.join(OUT, 'map-route-arcs.png'), optimize=True)   # route arcs, placed by CSS
    os.remove(os.path.join(OUT, 'map-world-route.png'))
    print('map-world + map-route-arcs', world.size, arcs.size)
    if os.path.exists(os.path.join(OUT, 'projects-composite.png')):
        comp = Image.open(os.path.join(OUT, 'projects-composite.png')).convert('RGBA')
        bg = Image.new('RGBA', comp.size, (11, 37, 69, 255)); bg.alpha_composite(comp)
        bg.convert('RGB').save(os.path.join(OUT, 'projects-composite.jpg'), quality=JPG_Q, optimize=True, progressive=True)
        os.remove(os.path.join(OUT, 'projects-composite.png'))
        print('projects-composite flattened -> jpg')
    for src, dst, rgb in [('logo-magical-villas-white', 'logo-magical-villas-dark', (43, 43, 43)),
                          ('logo-registry-dark', 'logo-registry-white', (255, 255, 255)),
                          ('logo-theone-dark', 'logo-theone-white', (255, 255, 255))]:
        im = Image.open(os.path.join(OUT, src + '.png')).convert('RGBA')
        out = Image.new('RGBA', im.size, rgb + (255,)); out.putalpha(im.getchannel('A'))
        out.save(os.path.join(OUT, dst + '.png'), optimize=True); print(dst, out.size)
    for n, w in [('map-nusa-dua', 1600), ('map-bali', 1800)]:
        im = Image.open(os.path.join(OUT, n + '.png')).convert('RGBA')
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS); im.save(os.path.join(OUT, n + '.png'), optimize=True)
        print(n, im.size)

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    doc = pymupdf.open(PDF)
    if what in ('rasters', 'all'):
        extract_rasters(doc)
    if what in ('vectors', 'all'):
        extract_vectors(doc, only=sys.argv[2:] or None)
    if what in ('crops', 'all'):
        extract_crops(doc)
    if what in ('post', 'all'):
        postprocess()
