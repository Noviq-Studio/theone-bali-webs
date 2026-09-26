/* THE ONE BALI — interacción y animaciones (capa cinematográfica + micro-interacciones)
   Dependencias (CDN): GSAP 3 + ScrollTrigger, Lenis (smooth scroll), Lucide (iconos).
   Degradación: sin JS, sin GSAP o con prefers-reduced-motion la página se muestra completa y estática. */
(function () {
  'use strict';

  var html = document.documentElement;
  /* ?motion=1 fuerza las animaciones aunque el sistema pida movimiento reducido (útil para revisar). */
  var forceMotion = /[?&]motion=1/.test(window.location.search);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches && !forceMotion;
  if (forceMotion) html.classList.add('force-motion');
  var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var lenis = null;
  var loader = document.getElementById('loader');
  var toArray = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  /* ---------- iconos ---------- */
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

  /* ---------- nav ---------- */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('nav-burger');
  var dockbar = document.getElementById('dockbar');
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('is-scrolled', y > 40);
    /* barra fija de descarga (móvil): aparece en cuanto se empieza a hacer scroll */
    if (dockbar) dockbar.classList.toggle('is-visible', y > window.innerHeight * 0.35);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function closeMenu() {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
  }
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
  });
  nav.querySelectorAll('.nav__links a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  /* ---------- lightbox de vídeo (YouTube) ---------- */
  var lb = document.getElementById('lightbox');
  var lbVideo = document.getElementById('lightbox-video');
  var cursorEl = document.getElementById('cursor');
  var lastFocus = null;

  var autoLeadPending = false; /* el formulario automático espera si hay un vídeo abierto */

  function openVideo(id) {
    lastFocus = document.activeElement;
    lbVideo.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1" ' +
      'title="Vídeo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    lb.hidden = false;
    html.classList.add('is-modal');
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    if (cursorEl) cursorEl.classList.remove('is-visible', 'is-label', 'is-hover');
    lb.querySelector('.lightbox__close').focus();
  }
  function closeVideo() {
    lb.hidden = true;
    lbVideo.innerHTML = '';
    html.classList.remove('is-modal');
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (autoLeadPending) { autoLeadPending = false; setTimeout(function () { openLead('auto'); }, 800); }
  }
  toArray('[data-video]').forEach(function (b) {
    b.addEventListener('click', function () { openVideo(b.getAttribute('data-video')); });
  });
  lb.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', closeVideo); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeVideo(); });

  /* ---------- formulario de contacto / descarga del brochure (Tally) ----------
     - Salta solo a los 15 s de estar en la página (una vez por sesión, nunca si ya se envió).
     - Todos los botones "Descargar brochure" abren el formulario; al enviarlo, el PDF se descarga
       automáticamente y el lead queda registrado en Tally. Se puede cerrar siempre.            */
  var lead = document.getElementById('lead');
  var leadFrame = lead.querySelector('iframe[data-tally-src]');
  var leadTitle = document.getElementById('lead-title');
  var leadText = lead.querySelector('.gate__text');
  var leadForm = lead.querySelector('.gate__form');
  var leadDone = lead.querySelector('.gate__done');
  var LEAD_KEY = 'theone_lead_ok', LEAD_SEEN = 'theone_lead_seen';
  var leadOpen = false, leadCaptured = false, leadSeen = false;
  try { leadCaptured = localStorage.getItem(LEAD_KEY) === '1'; } catch (e) {}
  try { leadSeen = sessionStorage.getItem(LEAD_SEEN) === '1'; } catch (e) {}

  var LEAD_COPY = {
    auto: ['¿Te interesa The One Bali?', 'Déjanos tu nombre completo, correo y teléfono: te enviamos toda la información y podrás descargar el brochure del proyecto.'],
    download: ['Descarga el brochure del proyecto', 'Déjanos tu nombre completo, correo y teléfono y la descarga empezará al instante.']
  };

  /* Cargamos el formulario al abrir el modal (no antes) y ajustamos su alto con los mensajes
     que Tally envía desde el iframe; el script oficial se carga además por compatibilidad. */
  function loadTally() {
    if (!leadFrame.getAttribute('src')) leadFrame.src = leadFrame.getAttribute('data-tally-src');
    var w = 'https://tally.so/widgets/embed.js';
    if (typeof Tally !== 'undefined' || document.querySelector('script[src="' + w + '"]')) return;
    var sc = document.createElement('script');
    sc.src = w;
    document.body.appendChild(sc);
  }
  function tallyHeight(h) {
    if (typeof h !== 'number' || h < 100) return;
    leadFrame.style.height = Math.ceil(h) + 'px';
    leadFrame.style.minHeight = '0';
  }
  function triggerDownload() {
    var a = document.createElement('a');
    a.href = 'assets/brochure.pdf'; a.download = 'The-One-Bali-Brochure.pdf';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function openLead(mode) {
    if (leadOpen) return;
    leadOpen = true;
    var copy = LEAD_COPY[mode] || LEAD_COPY.auto;
    leadTitle.textContent = copy[0]; leadText.textContent = copy[1];
    leadForm.hidden = leadCaptured; leadDone.hidden = !leadCaptured;
    if (!leadCaptured) loadTally();
    lastFocus = document.activeElement;
    lead.hidden = false;
    html.classList.add('is-modal');
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    if (cursorEl) cursorEl.classList.remove('is-visible', 'is-label', 'is-hover');
    lead.querySelector('.gate__close').focus();
    leadSeen = true;
    try { sessionStorage.setItem(LEAD_SEEN, '1'); } catch (e) {}
  }
  function closeLead() {
    if (!leadOpen) return;
    leadOpen = false;
    lead.hidden = true;
    html.classList.remove('is-modal');
    document.body.classList.remove('is-locked');
    if (lenis && lb.hidden) lenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  lead.querySelectorAll('[data-lead-close]').forEach(function (el) { el.addEventListener('click', closeLead); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && leadOpen) closeLead(); });

  /* botones de descarga: pasan por el formulario hasta que el lead esté registrado */
  toArray('a[href$="brochure.pdf"]').forEach(function (a) {
    if (a.closest('.gate')) return;
    a.addEventListener('click', function (e) {
      if (leadCaptured) return; /* ya dejó sus datos: descarga directa */
      e.preventDefault();
      openLead('download');
    });
  });

  /* Tally avisa por postMessage cuando el formulario se envía */
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://tally.so') return;
    var data = e.data;
    try { if (typeof data === 'string') data = JSON.parse(data); } catch (err) { return; }
    if (!data || !data.event) return;
    if (data.payload && typeof data.payload.height === 'number') tallyHeight(data.payload.height);
    if (data.event !== 'Tally.FormSubmitted') return;
    leadCaptured = true;
    try { localStorage.setItem(LEAD_KEY, '1'); } catch (err) {}
    leadForm.hidden = true; leadDone.hidden = false;
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    setTimeout(triggerDownload, 700);
  });

  /* apertura automática a los 15 s (?lead=5 en la URL cambia los segundos, útil para probar) */
  var leadDelayMatch = /[?&]lead=(\d+)/.exec(window.location.search);
  var leadDelay = leadDelayMatch ? parseInt(leadDelayMatch[1], 10) * 1000 : 15000;
  if (!leadCaptured && !leadSeen) {
    setTimeout(function () {
      if (leadCaptured || leadOpen || leadSeen) return;
      if (!lb.hidden || document.hidden) { autoLeadPending = true; return; }
      openLead('auto');
    }, leadDelay);
    document.addEventListener('visibilitychange', function () {
      if (autoLeadPending && !document.hidden && lb.hidden) { autoLeadPending = false; openLead('auto'); }
    });
  }

  /* ---------- contadores ---------- */
  var counters = toArray('[data-count]');
  function fmt(v, el) {
    var n = Math.round(v);
    if (el.getAttribute('data-format') === 'es') return n.toLocaleString('es-ES');
    if (el.getAttribute('data-pad')) return String(n).padStart(parseInt(el.getAttribute('data-pad'), 10), '0');
    return String(n);
  }
  function setFinalCounters() { counters.forEach(function (el) { el.textContent = fmt(parseFloat(el.getAttribute('data-count')), el); }); }
  function removeLoader() { if (loader && loader.parentNode) loader.parentNode.removeChild(loader); loader = null; }

  /* Sin GSAP o con movimiento reducido: todo visible, valores finales, y salimos. */
  if (reduce || !hasGsap) { removeLoader(); setFinalCounters(); return; }

  /* =================================================================
     A partir de aquí: modo cinematográfico
     ================================================================= */
  html.classList.add('motion');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scroll (Lenis) ---------- */
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    /* nota: Lenis borra del <html> cualquier clase que contenga "lenis", por eso el nombre es otro */
    html.classList.add('has-smooth');
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    /* Ojo: no usar gsap.ticker.lagSmoothing(0) aquí; rompe los tweens from() (terminan en su estado inicial). */
    lenis.stop(); /* bloqueado hasta que termine el preloader */
    toArray('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -40, duration: 1.4 });
      });
    });
  }

  /* ---------- numeración editorial + raíl de progreso ---------- */
  var sections = toArray('[data-section]');
  sections.forEach(function (s, i) {
    if (i === 0) return;
    var eb = s.querySelector('.eyebrow');
    if (!eb) return;
    var num = document.createElement('span');
    num.className = 'eyebrow__num';
    num.textContent = String(i).padStart(2, '0');
    eb.insertBefore(num, eb.firstChild);
  });
  var rail = document.getElementById('rail');
  var railIndex = rail.querySelector('.rail__index');
  var railName = rail.querySelector('.rail__name');
  var railFill = rail.querySelector('.rail__fill');
  var railCurrent = -1;
  function updateRail(progress) {
    railFill.style.transform = 'scaleY(' + progress + ')';
    rail.classList.toggle('is-visible', progress > 0.015);
    var mid = window.innerHeight * 0.5, active = 0;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= mid) active = i;
    }
    if (active === railCurrent) return;
    railCurrent = active;
    railIndex.textContent = String(active).padStart(2, '0');
    railName.textContent = sections[active].getAttribute('data-section');
  }
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (st) { updateRail(st.progress); } });

  /* ---------- títulos partidos por palabras ---------- */
  function splitWords(el) {
    if (el.getAttribute('data-split')) return [];
    var inners = [];
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) return; /* <br> y otros elementos se conservan */
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        var w = document.createElement('span'); w.className = 'w';
        var i = document.createElement('span'); i.className = 'w__i'; i.textContent = part;
        w.appendChild(i); frag.appendChild(w); inners.push(i);
      });
      el.replaceChild(frag, node);
    });
    el.setAttribute('data-split', '1');
    return inners;
  }
  toArray('.title, .statement, .media__claim--big').forEach(function (el) {
    if (el.classList.contains('hero__title')) return;
    el.classList.remove('reveal');
    var inners = splitWords(el);
    if (!inners.length) return;
    gsap.fromTo(inners, { yPercent: 130 }, {
      yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.045,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  /* ---------- reveals ---------- */
  toArray('.reveal').forEach(function (el) {
    gsap.fromTo(el, { y: 36, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });
  toArray('[data-stagger]').forEach(function (group) {
    var items = Array.prototype.slice.call(group.children);
    gsap.fromTo(items, { y: 36, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.09,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true }
    });
  });

  /* ---------- parallax ---------- */
  toArray('[data-parallax]').forEach(function (el) {
    var amt = parseFloat(el.getAttribute('data-parallax')) || 10;
    var frame = el.closest('.media, .stack__float, .section__bg, .tour__bg, .location__map') || el.parentElement;
    var trigger = frame.closest('section, header') || frame;
    gsap.fromTo(el, { yPercent: -amt / 2 }, {
      yPercent: amt / 2, ease: 'none',
      scrollTrigger: { trigger: trigger, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* ---------- contadores animados ---------- */
  counters.forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 92%', once: true,
      onEnter: function () {
        gsap.to(obj, { v: target, duration: 1.8, ease: 'power2.out', onUpdate: function () { el.textContent = fmt(obj.v, el); } });
      }
    });
  });

  /* ---------- hero: scroll-story (las tres líneas se revelan al bajar) ---------- */
  var lines = toArray('.hero__line');
  var heroIntro = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
    .fromTo('.hero__logo', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2 }, 0)
    .fromTo(lines[0], { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3 }, 0.15)
    .fromTo('.hero__brand', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.12 }, 0.6)
    .fromTo('.hero__badge', { y: -80, opacity: 0 }, { y: 0, opacity: 1, duration: 1.4, ease: 'power2.out' }, 0.3)
    .fromTo('.hero__scroll', { opacity: 0 }, { opacity: 1, duration: 1 }, 1.1);

  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.6 } })
    .fromTo('.hero__bg img', { scale: 1.12 }, { scale: 1, ease: 'none', duration: 10 }, 0)
    .fromTo('.hero__scroll', { opacity: 1 }, { opacity: 0, duration: 0.8, immediateRender: false }, 0.2)
    .fromTo(lines[0], { opacity: 1, y: 0 }, { opacity: 0.4, y: -16, duration: 1.4, immediateRender: false }, 1.6)
    .fromTo(lines[1], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.4 }, 1.8)
    .fromTo(lines[1], { opacity: 1, y: 0 }, { opacity: 0.4, y: -16, duration: 1.4, immediateRender: false }, 3.8)
    .fromTo(lines[2], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.4 }, 4.0)
    .fromTo([lines[0], lines[1]], { opacity: 0.4, y: -16 }, { opacity: 1, y: 0, duration: 1.4, immediateRender: false }, 6.0)
    .fromTo('.hero__sub', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2 }, 6.6)
    .fromTo('.hero__cta .btn', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, stagger: 0.25 }, 7.2);

  /* ---------- sección pinneada (Instalaciones) ---------- */
  gsap.fromTo('.pinned__img', { scale: 1.18 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.pinned', start: 'top bottom', end: 'bottom bottom', scrub: true }
  });
  gsap.fromTo('.pinned__content > *', { y: 30, opacity: 0 }, {
    y: 0, opacity: 1, stagger: 0.12, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: '.pinned', start: 'top 35%', once: true }
  });

  /* ---------- scroll horizontal pinneado (Premios, Proyectos) — sólo escritorio ---------- */
  var mm = gsap.matchMedia();
  mm.add('(min-width: 821px)', function () {
    var cleanups = [];
    toArray('.hpin').forEach(function (sec) {
      var sticky = sec.querySelector('.hpin__sticky');
      var track = sec.querySelector('.hpin__track');
      if (!sticky || !track) return;
      sec.classList.add('is-pinned');
      /* scrollWidth no incluye el padding derecho: se suma para que la última tarjeta acabe con margen */
      var dist = function () {
        var padR = parseFloat(getComputedStyle(track).paddingRight) || 0;
        return Math.max(0, track.scrollWidth - track.clientWidth + padR);
      };
      gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: sec, pin: sticky, start: 'top top', end: function () { return '+=' + dist(); },
          scrub: 0.5, invalidateOnRefresh: true, anticipatePin: 1
        }
      });
      cleanups.push(function () { sec.classList.remove('is-pinned'); gsap.set(track, { clearProps: 'x' }); });
    });
    return function () { cleanups.forEach(function (fn) { fn(); }); };
  });

  /* ---------- micro-interacciones (sólo puntero fino) ---------- */
  if (finePointer) {
    /* cursor personalizado */
    html.classList.add('has-cursor');
    var dot = cursorEl.querySelector('.cursor__dot');
    var ring = cursorEl.querySelector('.cursor__ring');
    var label = cursorEl.querySelector('.cursor__label');
    var dx = gsap.quickTo(dot, 'x', { duration: 0.1, ease: 'power3' });
    var dy = gsap.quickTo(dot, 'y', { duration: 0.1, ease: 'power3' });
    var rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
    var ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    window.addEventListener('mousemove', function (e) {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      if (lb.hidden) cursorEl.classList.add('is-visible');
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cursorEl.classList.remove('is-visible'); });
    document.addEventListener('mouseover', function (e) {
      var labelled = e.target.closest('[data-cursor]');
      var interactive = e.target.closest('a, button, .gallery__track img, .panel, .award');
      if (labelled && !(labelled.classList.contains('hpin__track') && labelled.closest('.is-pinned'))) {
        label.textContent = labelled.getAttribute('data-cursor');
        cursorEl.classList.add('is-label'); cursorEl.classList.remove('is-hover');
      } else if (interactive) {
        cursorEl.classList.add('is-hover'); cursorEl.classList.remove('is-label');
      } else {
        cursorEl.classList.remove('is-hover', 'is-label');
      }
    });

    /* botones magnéticos (los del hero no: los mueve la scroll-story) */
    toArray('.btn:not(.hero__cta .btn), .tour__play, .nav__burger, .lightbox__close').forEach(function (el) {
      var mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      var my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * 0.32);
        my((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      el.addEventListener('mouseleave', function () { mx(0); my(0); });
    });

    /* zoom suave en hover sobre las imágenes enmarcadas */
    toArray('.media, .stack__float').forEach(function (frame) {
      var img = frame.querySelector('img');
      if (!img) return;
      frame.addEventListener('mouseenter', function () { gsap.to(img, { scale: 1.05, duration: 1.4, ease: 'power2.out' }); });
      frame.addEventListener('mouseleave', function () { gsap.to(img, { scale: 1, duration: 1.2, ease: 'power2.out' }); });
    });
  }

  /* ---------- preloader → intro del hero ---------- */
  var loadStart = performance.now();
  var bar = loader ? loader.querySelector('.loader__bar span') : null;
  var finished = false;
  if (bar) gsap.to(bar, { scaleX: 0.82, duration: 1.8, ease: 'power2.out' });
  function finishLoader() {
    if (finished) return;
    finished = true;
    var tl = gsap.timeline();
    if (loader) {
      tl.to(bar, { scaleX: 1, duration: 0.3, ease: 'power1.inOut' })
        .to(loader.querySelector('.loader__inner'), { opacity: 0, y: -14, duration: 0.5, ease: 'power2.in' }, '+=0.1')
        .to(loader, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.15');
    }
    tl.add(function () { if (lenis) lenis.start(); }, '-=0.3')
      .add(function () { heroIntro.play(); }, '-=0.75')
      .add(function () { removeLoader(); ScrollTrigger.refresh(); });
    /* respaldo con temporizador: si el navegador limita requestAnimationFrame (pestaña en segundo plano,
       ahorro de energía…), el preloader se retira igualmente y el hero arranca */
    setTimeout(function () {
      if (!loader) return;
      removeLoader();
      if (lenis) lenis.start();
      heroIntro.play();
      ScrollTrigger.refresh();
    }, 2600);
  }
  function ready() {
    /* mínimo 1,6 s desde el inicio de la navegación (no desde que cargó el script) */
    var wait = Math.max(0, 1600 - performance.now());
    setTimeout(finishLoader, wait);
  }
  /* Basta con que estén la imagen del hero y las fuentes: no esperamos al `load` de las 85 imágenes. */
  var heroImg = document.querySelector('.hero__bg img');
  var heroReady = heroImg && heroImg.decode ? heroImg.decode().catch(function () {}) : Promise.resolve();
  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.all([heroReady, fontsReady]).then(ready, ready);
  setTimeout(finishLoader, Math.max(400, 3000 - performance.now())); /* tope: ~3 s desde la navegación aunque la red vaya lenta */

  /* recalcular tras cargar imágenes y fuentes */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
