# The One Bali — web one-page estilo Apple

Web construida a partir del brochure oficial `(ES) The One Brochure_13.03.26` (24 páginas).
Toda la información, imágenes, premios, logos y mapas del PDF están en la página.

## Abrir la web

Sin build ni dependencias. Dos opciones:

- Doble clic en `index.html` (los vídeos de YouTube y las fuentes de Google necesitan conexión).
- O servirla en local:

```bash
python3 -m http.server 8080
```

y abrir `http://localhost:8080`.

Para publicarla basta con subir la carpeta completa (index.html, css/, js/, assets/) a cualquier hosting estático (Netlify, Vercel, GitHub Pages, cPanel…).

## Estructura

```
index.html          22 secciones, copy literal del brochure, enlaces reales (vídeos, Google Maps, prensa)
css/styles.css      sistema de diseño: tokens, tipografía, componentes, responsive, reduced-motion
js/main.js          GSAP ScrollTrigger + Lenis + Lucide: reveals, parallax, contadores, pin, lightbox, nav
assets/img/         85 imágenes extraídas del PDF (fotos .jpg, logos/mapas .png con transparencia)
assets/brochure.pdf copia del brochure para el botón "Descargar brochure"
tools/              script reproducible de extracción de assets (PyMuPDF + Pillow)
```

## Tipografía

El brochure usa **The Seasons** (títulos), **Tenor Sans** (cuerpo) y **Fahkwang** (etiquetas).
Tenor Sans y Fahkwang se cargan desde Google Fonts. The Seasons es comercial: se sustituye por
**Cormorant Garamond**. Si tienes la licencia, copia los `.woff2` en `assets/fonts/` y descomenta el
bloque `@font-face` al inicio de `css/styles.css`; el sistema la usará automáticamente.

## Animaciones y capa cinematográfica

- **Preloader** con logo y barra; al terminar arranca la intro del hero.
- **Hero scroll-story**: la imagen queda fija y las tres líneas del claim se revelan una a una al bajar; después aparecen subtítulo y botones.
- **Scroll horizontal pinneado** en Premios y Proyectos (escritorio). En móvil son carriles deslizables con snap.
- **Títulos partidos por palabras** que suben desde una máscara; numeración editorial (01, 02…) en cada sección.
- **Composiciones solapadas**: imagen principal + imagen flotante con parallax inverso (Marca, Magical Villas, Diseño).
- **Micro-interacciones** (sólo puntero fino): cursor personalizado con etiquetas (Ver, Leer, Arrastra, Desliza),
  botones magnéticos, zoom suave en hover sobre las imágenes, raíl lateral con progreso y nombre de sección.
- Reveals con stagger (`.reveal`, `[data-stagger]`), parallax (`[data-parallax]`), contadores (`[data-count]`),
  sección pinneada (Instalaciones), galería con scroll horizontal, nav con blur, lightbox de vídeo.
- Con `prefers-reduced-motion` (o sin JS) la página se muestra completa y estática: sin preloader, hero normal,
  carriles con scroll nativo. Para revisar las animaciones igualmente, abre `index.html?motion=1`.
- Etiquetas útiles en el HTML: `data-section="Nombre"` (raíl y numeración), `data-cursor="Texto"` (etiqueta del cursor),
  `data-parallax="8"` (negativo invierte el sentido).

## Formulario de contacto y descarga del brochure (Tally)

- El formulario es el de Tally `8197Ql` ("THE ONE - Ronald"); los campos (nombre completo, correo, teléfono)
  se definen en Tally. Los leads llegan a tu cuenta de Tally (Responses); allí puedes activar avisos por email
  o integraciones (Google Sheets, Notion, webhook…).
- **Apertura automática** a los 15 s de estar en la página, una sola vez por sesión y nunca si ya se envió.
  Espera a que la pestaña esté visible y a que no haya un vídeo abierto. Se cierra con la X, el fondo o Escape.
- **Descarga protegida**: todos los botones "Descargar brochure" abren el formulario; al enviarlo, el PDF se
  descarga solo y aparece un botón de respaldo. Desde entonces las descargas son directas (localStorage).
- **Barra fija inferior (móvil, ≤ 820 px)**: en cuanto se hace scroll aparece una barra con "Descargar brochure"
  que abre el mismo formulario. Se oculta mientras hay un modal o el menú abierto.
- Los textos del formulario (Full Name, Phone number, Email, Submit) se cambian desde Tally; la marca
  "Made with Tally" sólo se quita con el plan Pro de Tally.
- Para probar: `index.html?lead=3` abre el formulario a los 3 s. Para volver a empezar, borra en la consola
  `localStorage.removeItem('theone_lead_ok')` y `sessionStorage.removeItem('theone_lead_seen')`.

## Regenerar los assets desde el PDF

```bash
python3 -m venv tools/.venv
tools/.venv/bin/pip install -r tools/requirements.txt
tools/.venv/bin/python tools/extract_assets.py all
```
