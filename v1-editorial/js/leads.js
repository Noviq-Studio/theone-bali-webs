/* =====================================================================
   THE ONE BALI — captura de leads unificada (v1 / v2 / v3)
   ---------------------------------------------------------------------
   Las tres variantes embeben el MISMO formulario de Tally (8197Ql) y
   etiquetan cada lead con su origen, de modo que en Responses de Tally
   se ve en una sola tabla qué variante convirtió.

   CONFIGURACIÓN (en el HTML de cada variante):
     <body data-variant="editorial">        editorial | cinematic | investor
           data-lead-logo="assets/img/logo-theone-registry-dark.png"   (opcional)

   REQUISITO EN TALLY — crear estos campos ocultos ("Hidden fields") en el
   formulario 8197Ql, con EXACTAMENTE estos nombres:
     variante · idioma · origen · utm_source · utm_medium · utm_campaign · landing
   Sin ellos el formulario sigue funcionando, pero los leads llegan sin
   distinguir de qué web vienen.

   NOMBRADO: todo el modal usa el prefijo .leadgate / --leadgate-*.
   NO usar .lead: en estas webs .lead es la clase tipográfica de los
   párrafos de entradilla (<p class="lead lead--light">) y colisiona.

   EMBEBIDO INLINE (p. ej. formulario en el hero de V3):
     <div data-lead-inline="hero"></div>
   leads.js mete dentro el iframe de Tally ya etiquetado, lo autoajusta
   de alto y lo sustituye por el mensaje de gracias al enviarse.

   API pública:
     TheOneLeads.open('download' | 'auto' | 'cta')
     TheOneLeads.close()
     TheOneLeads.captured                       -> boolean
     TheOneLeads.onOpen / onClose  = function   -> hooks por variante
                                                   (parar Lenis, cursor…)
   Pruebas:
     ?lead=3   abre el formulario a los 3 s
     Reset:    localStorage.removeItem('theone_lead_ok')
               sessionStorage.removeItem('theone_lead_seen')
   ===================================================================== */
(function (window, document) {
  'use strict';

  var FORM_ID   = '8197Ql';
  var TALLY_ORIGIN = 'https://tally.so';
  var LEAD_KEY  = 'theone_lead_ok';
  var LEAD_SEEN = 'theone_lead_seen';
  var AUTO_DELAY = 15000;

  var VARIANT = document.body.getAttribute('data-variant') || 'editorial';
  var LOGO     = document.body.getAttribute('data-lead-logo') || '';
  /* Las versiones /en/ y /de/ viven un nivel más abajo, así que la ruta del
     brochure se toma de un enlace real de la página en lugar de fijarla. */
  var refPdf   = document.querySelector('a[href$="brochure.pdf"]');
  var BROCHURE = refPdf ? refPdf.getAttribute('href') : 'assets/brochure.pdf';

  /* El modal lo pinta este módulo, así que sus textos no pasan por el
     extractor de i18n: viven aquí, en los tres idiomas del sitio. */
  var LANG = (document.documentElement.lang || 'es').slice(0, 2).toLowerCase();
  var STRINGS = {
    es: {
      auto:     ['¿Te interesa The One Bali?', 'Déjanos tu nombre completo, correo y teléfono: te enviamos toda la información y podrás descargar el brochure del proyecto.'],
      download: ['Descarga el brochure del proyecto', 'Déjanos tu nombre completo, correo y teléfono y la descarga empezará al instante.'],
      cta:      ['Hablemos de The One Bali', 'Déjanos tus datos y un asesor te contacta con disponibilidad, precios y plan de pago.'],
      doneTitle: '¡Gracias! Ya tienes acceso.',
      doneText:  'La descarga empieza automáticamente. Si no arranca, usa el botón.',
      doneBtn:   'Descargar brochure',
      note:      'Sin compromiso. Puedes cerrar esta ventana cuando quieras.',
      close:     'Cerrar',
      formTitle: 'Formulario de contacto The One Bali'
    },
    en: {
      auto:     ['Interested in The One Bali?', 'Leave us your full name, email and phone: we will send you all the information and you can download the project brochure.'],
      download: ['Download the project brochure', 'Leave us your full name, email and phone and the download will start straight away.'],
      cta:      ['Let\u2019s talk about The One Bali', 'Leave your details and an adviser will contact you with availability, prices and payment plan.'],
      doneTitle: 'Thank you! You now have access.',
      doneText:  'The download starts automatically. If it does not, use the button.',
      doneBtn:   'Download brochure',
      note:      'No obligation. You can close this window whenever you like.',
      close:     'Close',
      formTitle: 'The One Bali contact form'
    },
    de: {
      auto:     ['Interesse an The One Bali?', 'Hinterlassen Sie Namen, E-Mail und Telefon: Wir senden Ihnen alle Informationen und Sie k\u00f6nnen die Projektbrosch\u00fcre herunterladen.'],
      download: ['Projektbrosch\u00fcre herunterladen', 'Hinterlassen Sie Namen, E-Mail und Telefon \u2013 der Download startet sofort.'],
      cta:      ['Sprechen wir \u00fcber The One Bali', 'Hinterlassen Sie Ihre Daten und ein Berater meldet sich mit Verf\u00fcgbarkeit, Preisen und Zahlungsplan.'],
      doneTitle: 'Vielen Dank! Sie haben jetzt Zugang.',
      doneText:  'Der Download startet automatisch. Falls nicht, nutzen Sie die Schaltfl\u00e4che.',
      doneBtn:   'Brosch\u00fcre herunterladen',
      note:      'Unverbindlich. Sie k\u00f6nnen dieses Fenster jederzeit schlie\u00dfen.',
      close:     'Schlie\u00dfen',
      formTitle: 'Kontaktformular The One Bali'
    }
  };
  var T = STRINGS[LANG] || STRINGS.es;
  var COPY = { auto: T.auto, download: T.download, cta: T.cta };

  /* ---------- estado ---------- */
  var captured = false, seen = false, isOpen = false, pending = false, lastFocus = null;
  try { captured = localStorage.getItem(LEAD_KEY) === '1'; } catch (e) {}
  try { seen = sessionStorage.getItem(LEAD_SEEN) === '1'; } catch (e) {}

  /* ---------- URL del formulario con el etiquetado de origen ----------
     Arrastramos las UTM de la landing para saber no sólo qué variante
     convirtió, sino de qué campaña venía el visitante.                 */
  function tallyUrl(origen) {
    var base = TALLY_ORIGIN + '/embed/' + FORM_ID;
    var p = new URLSearchParams({
      alignLeft: '1', hideTitle: '1', transparentBackground: '1', dynamicHeight: '1',
      variante: VARIANT,
      idioma: LANG,
      origen: origen || 'auto',
      landing: location.hostname + location.pathname
    });
    var incoming = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']
      .forEach(function (k) { if (incoming.get(k)) p.set(k, incoming.get(k)); });
    return base + '?' + p.toString();
  }

  /* ---------- markup del modal ----------
     Se inyecta desde JS para que las tres variantes compartan exactamente
     la misma estructura y accesibilidad. Cada variante lo tematiza por CSS
     con las custom properties --leadgate-*.                                  */
  var root = document.createElement('div');
  root.className = 'leadgate';
  root.id = 'leadgate';
  root.hidden = true;
  root.innerHTML =
    '<div class="leadgate__backdrop" data-lead-close></div>' +
    '<div class="leadgate__panel" role="dialog" aria-modal="true" aria-labelledby="leadgate-title">' +
      '<button class="leadgate__close" type="button" data-lead-close aria-label="' + T.close + '">&times;</button>' +
      (LOGO ? '<img class="leadgate__logo" src="' + LOGO + '" alt="The One Bali">' : '') +
      '<h2 class="leadgate__title" id="leadgate-title"></h2>' +
      '<p class="leadgate__text"></p>' +
      '<div class="leadgate__form">' +
        '<iframe title="' + T.formTitle + '" loading="lazy" ' +
                'width="100%" height="230" frameborder="0" marginheight="0" marginwidth="0"></iframe>' +
      '</div>' +
      '<div class="leadgate__done" hidden>' +
        '<p class="leadgate__doneTitle">' + T.doneTitle + '</p>' +
        '<p class="leadgate__doneText">' + T.doneText + '</p>' +
        '<a class="leadgate__doneBtn" href="' + BROCHURE + '" download="The-One-Bali-Brochure.pdf">' + T.doneBtn + '</a>' +
      '</div>' +
      '<p class="leadgate__note">' + T.note + '</p>' +
    '</div>';
  document.body.appendChild(root);

  var inline = [];                /* iframes embebidos fuera del modal */
  var frame = root.querySelector('iframe');
  var elTitle = root.querySelector('.leadgate__title');
  var elText  = root.querySelector('.leadgate__text');
  var elForm  = root.querySelector('.leadgate__form');
  var elDone  = root.querySelector('.leadgate__done');
  var elClose = root.querySelector('.leadgate__close');

  function doneMarkup() {
    return '<div class="leadgate__done">' +
      '<p class="leadgate__doneTitle">' + T.doneTitle + '</p>' +
      '<p class="leadgate__doneText">' + T.doneText + '</p>' +
      '<a class="leadgate__doneBtn" href="' + BROCHURE + '" download="The-One-Bali-Brochure.pdf">' + T.doneBtn + '</a>' +
      '</div>';
  }

  /* El script oficial de Tally sólo se carga la primera vez que hace falta. */
  function loadTallyScript() {
    var w = TALLY_ORIGIN + '/widgets/embed.js';
    if (window.Tally || document.querySelector('script[src="' + w + '"]')) return;
    var sc = document.createElement('script');
    sc.src = w;
    document.body.appendChild(sc);
  }
  function loadTally(origen) {
    frame.src = tallyUrl(origen);
    loadTallyScript();
  }

  function setHeight(h) {
    if (typeof h !== 'number' || h < 100) return;
    var px = Math.ceil(h) + 'px';
    [frame].concat(inline).forEach(function (f) {
      if (!f) return;
      f.style.height = px;
      f.style.minHeight = '0';
    });
  }

  function triggerDownload() {
    var a = document.createElement('a');
    a.href = BROCHURE;
    a.download = 'The-One-Bali-Brochure.pdf';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- foco atrapado dentro del modal ---------- */
  function focusables() {
    return Array.prototype.filter.call(
      root.querySelectorAll('button, a[href], iframe, [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null || el === elClose; }
    );
  }
  function onKeydown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open(mode) {
    if (isOpen) return;
    isOpen = true;
    var copy = COPY[mode] || COPY.auto;
    elTitle.textContent = copy[0];
    elText.textContent = copy[1];
    elForm.hidden = captured;
    elDone.hidden = !captured;
    if (!captured && !frame.getAttribute('src')) loadTally(mode);
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('is-modal');
    document.body.classList.add('is-locked');
    if (typeof api.onOpen === 'function') api.onOpen();
    elClose.focus();
    seen = true;
    try { sessionStorage.setItem(LEAD_SEEN, '1'); } catch (e) {}
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.hidden = true;
    document.documentElement.classList.remove('is-modal');
    document.body.classList.remove('is-locked');
    if (typeof api.onClose === 'function') api.onClose();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  root.querySelectorAll('[data-lead-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });
  document.addEventListener('keydown', onKeydown);

  /* ---------- el brochure pasa por el formulario hasta que hay lead ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('a[href$="brochure.pdf"]'), function (a) {
    if (a.closest('.leadgate')) return;
    a.addEventListener('click', function (e) {
      if (captured) return;              /* ya dejó sus datos: descarga directa */
      e.preventDefault();
      open('download');
    });
  });

  /* ---------- cualquier botón marcado abre el formulario ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-lead-open]'), function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      open(el.getAttribute('data-lead-open') || 'cta');
    });
  });

  /* ---------- formularios embebidos fuera del modal ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-lead-inline]'), function (host) {
    var origen = host.getAttribute('data-lead-inline') || 'inline';
    if (captured) { host.innerHTML = doneMarkup(); return; }
    var f = document.createElement('iframe');
    f.title = 'Formulario de contacto The One Bali';
    f.setAttribute('loading', 'lazy');
    f.width = '100%'; f.height = '230'; f.frameBorder = '0';
    f.style.border = '0'; f.style.width = '100%';
    f.src = tallyUrl(origen);
    host.appendChild(f);
    inline.push(f);
    loadTallyScript();
  });

  /* ---------- Tally avisa por postMessage al enviarse ---------- */
  window.addEventListener('message', function (e) {
    if (e.origin !== TALLY_ORIGIN) return;
    var data = e.data;
    try { if (typeof data === 'string') data = JSON.parse(data); } catch (err) { return; }
    if (!data || !data.event) return;
    if (data.payload && typeof data.payload.height === 'number') setHeight(data.payload.height);
    if (data.event !== 'Tally.FormSubmitted') return;
    captured = api.captured = true;
    try { localStorage.setItem(LEAD_KEY, '1'); } catch (err) {}
    elForm.hidden = true;
    elDone.hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll('[data-lead-inline]'), function (host) {
      host.innerHTML = doneMarkup();
    });
    inline.length = 0;
    if (typeof api.onSubmit === 'function') api.onSubmit(VARIANT);
    setTimeout(triggerDownload, 700);
  });

  /* ---------- apertura automática ---------- */
  var m = /[?&]lead=(\d+)/.exec(location.search);
  var delay = m ? parseInt(m[1], 10) * 1000 : AUTO_DELAY;
  if (!captured && !seen) {
    setTimeout(function () {
      if (captured || isOpen || seen) return;
      /* Si la pestaña está oculta o la variante dice que espere
         (p. ej. hay un vídeo abierto), lo dejamos pendiente. */
      if (document.hidden || (typeof api.canAutoOpen === 'function' && !api.canAutoOpen())) {
        pending = true; return;
      }
      open('auto');
    }, delay);
    document.addEventListener('visibilitychange', function () {
      if (!pending || document.hidden) return;
      if (typeof api.canAutoOpen === 'function' && !api.canAutoOpen()) return;
      pending = false;
      open('auto');
    });
  }

  /* Permite a la variante reintentar la apertura pendiente (al cerrar un vídeo). */
  function resumeAuto() {
    if (!pending || captured || isOpen) return;
    pending = false;
    setTimeout(function () { open('auto'); }, 800);
  }

  var api = window.TheOneLeads = {
    open: open,
    close: close,
    resumeAuto: resumeAuto,
    variant: VARIANT,
    captured: captured,
    onOpen: null,      /* la variante para su smooth-scroll aquí  */
    onClose: null,     /* …y lo reanuda aquí                      */
    onSubmit: null,    /* opcional: disparar evento de analítica  */
    canAutoOpen: null  /* opcional: devolver false para posponer  */
  };
})(window, document);
