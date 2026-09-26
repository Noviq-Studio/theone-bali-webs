# The One Bali — 3 variantes

Tres webs con **la misma información** del brochure oficial y **tres estilos distintos**,
cada una en **español, inglés y alemán**, y las nueve páginas conectadas
**al mismo panel de leads** (Tally, formulario `8197Ql`).

| Variante | Estilo | Estrategia | Canal ideal |
|---|---|---|---|
| [`v1-editorial/`](v1-editorial/) | **Editorial Luxe** — hueso, tinta carbón, arena y teal profundo. Serif en caja baja, filetes finos, botones rectos | Confianza primero: narrativa larga, CTA en pausas naturales | Orgánico, Instagram, comprador que decide por marca |
| [`v2-cinematic/`](v2-cinematic/) | **Dark Cinematic** — negro, paneles de vidrio, oro y degradado atardecer. Syne + Sora + Space Mono | Emocional: inmersión primero, formulario en modal | Meta/TikTok Ads, móvil, navegación nocturna |
| [`v3-investor/`](v3-investor/) | **Investor Deck** — blanco estructurado, navy y esmeralda. Inter con cifras tabulares | Directa: formulario *above the fold* + calculadora de ROI | Google Ads, LinkedIn, inversor que compara números |

`TheOne-Bali-Web/` es la web original. **No se ha modificado**: queda como referencia y
como origen de los assets. V1 partió de una copia suya.

## Abrir en local

```bash
python3 -m http.server 8099
```

Luego `http://localhost:8099/` para el comparador, o directamente:

| | Español | English | Deutsch |
|---|---|---|---|
| V1 | `/v1-editorial/` | `/v1-editorial/en/` | `/v1-editorial/de/` |
| V2 | `/v2-cinematic/` | `/v2-cinematic/en/` | `/v2-cinematic/de/` |
| V3 | `/v3-investor/` | `/v3-investor/en/` | `/v3-investor/de/` |

> Los assets (35 MB) **no se duplican**: cada variante tiene un symlink `assets -> ../TheOne-Bali-Web/assets`.
> El servidor de Python lo resuelve sin problema; para subir a producción usa `deploy.sh`, que lo copia de verdad.

## ⚠️ Paso pendiente en tu cuenta de Tally

Las tres webs ya envían el origen de cada lead por URL, pero **Tally sólo guarda un
parámetro si existe un campo oculto con ese nombre exacto**. Ahora mismo el formulario
`8197Ql` sólo tiene *Full Name*, *Phone number* y *Email*, así que **los leads llegan sin
distinguir de qué web vienen**.

En el editor de Tally → *Add question* → **Hidden field**, crea estos (respetando
minúsculas, sin acentos):

| Campo | Qué guarda |
|---|---|
| `variante` | `editorial` · `cinematic` · `investor` ← **el importante** |
| `idioma` | `es` · `en` · `de` |
| `origen` | `auto` (pop-up) · `download` (brochure) · `hero` (form del hero de V3) · `cta` |
| `landing` | dominio + ruta desde la que se envió |
| `utm_source` `utm_medium` `utm_campaign` `utm_content` `utm_term` | campaña de procedencia |
| `gclid` `fbclid` | clic de Google / Meta Ads |

Con `variante` e `idioma` creados ya puedes filtrar Responses por web y por lengua y
comparar conversión. Los demás son opcionales pero cuestan lo mismo y dan mucho contexto.

## Estructura

```
shared/leads.js     módulo ÚNICO de captura (modal, gate del brochure, etiquetado)
shared/leads.css    base del modal; cada variante lo tematiza con tokens --leadgate-*
i18n/es.json        diccionario extraído del HTML español (fuente de verdad)
i18n/en.json        traducción inglesa
i18n/de.json        traducción alemana
tools/i18n_extract.py  etiqueta el HTML con data-i18n y regenera es.json
tools/i18n_build.py    genera <variante>/en/ y <variante>/de/
v1|v2|v3/           index.html (ES) + en/ + de/ + css/ + js/ + copia de leads.js/css
deploy.sh           prepara dist/<variante>/ con los assets resueltos
publish-pages.sh    regenera la vista previa de GitHub Pages (rama gh-pages)
sync-shared.sh      propaga shared/leads.* y regenera los idiomas
```

## Idiomas

Cada idioma es una **página estática real** con su propia URL, no una traducción
en el cliente. Ventajas: sin parpadeo, funciona sin JavaScript, cada lengua es
indexable y los `hreflang` apuntan correctamente entre las tres.

**Las páginas `en/` y `de/` son generadas: no las edites a mano.** El flujo es:

1. El contenido vive en `<variante>/index.html` (español), etiquetado con `data-i18n="tXXXXXXXX"`.
2. La clave es un hash del texto español, así que la misma frase comparte clave en V1, V2 y V3:
   **359 cadenas únicas cubren las tres webs**.
3. `tools/i18n_build.py` cruza ese HTML con `i18n/en.json` y `i18n/de.json` y escribe `en/` y `de/`.

### Cambiar un texto

```bash
# 1. edítalo en el index.html español de cada variante que lo use
# 2. vuelve a extraer (añade las claves nuevas a i18n/es.json)
python3 tools/i18n_extract.py v1-editorial v2-cinematic v3-investor
# 3. traduce las claves nuevas en i18n/en.json y i18n/de.json
# 4. regenera
./sync-shared.sh
```

Si falta alguna traducción, `i18n_build.py` lo avisa y deja el texto español en su lugar
en vez de dejar un hueco.

### Textos del modal de leads

El modal lo pinta `leads.js`, así que sus textos **no** pasan por el extractor: viven en
el objeto `STRINGS` dentro de `shared/leads.js`, en los tres idiomas. Si añades un idioma,
hay que añadirlo también ahí.

### Notas de maquetación

El alemán es ~25 % más largo que el español y forma compuestos como *Immobilienverwaltung*.
Las tres variantes llevan una capa de seguridad tipográfica al final de su `styles.css`
(`overflow-wrap`, `hyphens: auto` sólo bajo `html[lang="de"]`, botones que envuelven).
Si añades componentes con cajas estrechas, compruébalos en alemán.

### El módulo de leads

Idéntico en las tres (mismo hash). Configuración por atributos en `<body>`:

```html
<body data-variant="investor" data-lead-logo="assets/img/logo-theone-registry-dark.png">
```

API: `TheOneLeads.open('download'|'auto'|'cta')`, `.close()`, `.resumeAuto()`,
y los hooks `onOpen` / `onClose` / `canAutoOpen` / `onSubmit` que cada variante usa para
convivir con su propio scroll suave, cursor o lightbox.

Formulario embebido fuera del modal (lo usa el hero de V3):

```html
<div data-lead-inline="hero"></div>
```

> **Nombrado:** el modal usa el prefijo `.leadgate` / `--leadgate-*`.
> **No uses `.lead`**: en estas webs es la clase tipográfica de los párrafos de entradilla.

### Probar la captura

- `?lead=3` abre el formulario a los 3 s (por defecto son 15 s).
- Reiniciar el estado: en consola
  `localStorage.removeItem('theone_lead_ok'); sessionStorage.removeItem('theone_lead_seen')`
- El pop-up automático **no salta** si la pestaña está oculta o hay un vídeo abierto: queda
  pendiente y se lanza al volver. Es intencionado.

## Guía rápida para publicar (para quien no ha tocado el proyecto)

Cada variante es una web **estática**: HTML, CSS, JS e imágenes. No hay backend,
base de datos ni build de Node. Sirve cualquier hosting estático.

**Vista previa en línea:** <https://noviq-studio.github.io/theone-bali-webs/>
(comparador con las tres variantes y sus versiones `/en/` y `/de/`). Se sirve desde la
rama `gh-pages`. Tras cambiar algo en `main`, ejecuta `./publish-pages.sh` para actualizarla.

**Vista previa en local (sin publicar nada):**

```bash
python3 -m http.server 8099   # y abre http://localhost:8099/
```

**Publicar UNA variante en un dominio propio:**

```bash
git clone <url-de-este-repo>
cd <carpeta>
./deploy.sh v3-investor        # o v1-editorial / v2-cinematic
```

Sube el **contenido** de `dist/v3-investor/` a la raíz del dominio. Ya incluye
`assets/` con las imágenes y el brochure, y las carpetas `en/` y `de/`.

- **Netlify / Vercel / Cloudflare Pages:** arrastra la carpeta `dist/<variante>` o
  conecta el repo y pon como *publish directory* `dist/<variante>` con *build command*
  `./deploy.sh <variante>`.
- **cPanel / FTP:** copia el contenido de `dist/<variante>` en `public_html/`.

> En Windows sin bash: copia la carpeta de la variante a mano y sustituye su
> `assets` (que es un enlace simbólico) por una copia real de `TheOne-Bali-Web/assets/`.

Los formularios envían a Tally (formulario `8197Ql`); no hay claves ni secretos en el
código, así que no hace falta configurar nada más para que la web funcione.

## Publicar

```bash
./deploy.sh v3-investor
```

Sube el contenido de `dist/v3-investor/` a la raíz del dominio o subdominio.
Incluye ya `en/` y `de/`, así que los idiomas quedan en `tudominio.com/en/` y `/de/`.
Al ser estático vale cualquier hosting: Netlify, Vercel, GitHub Pages, cPanel.

## Diferencias técnicas entre variantes

| | V1 Editorial | V2 Cinematic | V3 Investor |
|---|---|---|---|
| Librerías | GSAP + ScrollTrigger + Lenis + Lucide | Igual que V1 | **Sólo Lucide** |
| Motion | Medio (reveals, parallax) | Alto (pins, scrub, cursor) | Mínimo (IntersectionObserver) |
| Preloader / cursor / raíl | Sí | Sí | No |
| Hero | Scroll-story pinneado | Scroll-story a pantalla completa | Estático con formulario |
| Secciones exclusivas | — | — | Calculadora de ROI, FAQ |
| Peso JS de terceros | ~120 KB | ~120 KB | ~10 KB |

V3 es deliberadamente la más ligera: carga antes y eso se nota en campañas de pago.

## Aviso sobre la calculadora de ROI (V3)

Aplica un retorno anual constante sobre el importe invertido. **No** descuenta impuestos,
gastos de gestión, periodos de vacío ni inflación, y no contempla revalorización ni venta
del activo. El 22 % es el retorno máximo publicado por el desarrollador, **no un
rendimiento garantizado**. La propia página lo declara junto al simulador y en el FAQ.
