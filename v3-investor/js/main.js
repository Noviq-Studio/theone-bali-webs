/* =====================================================================
   THE ONE BALI — V3 · INVESTOR DECK
   JS mínimo y funcional: sin GSAP, sin Lenis, sin scroll hijack.
   Prioriza LCP y tiempo hasta la primera interacción.
   La captura de leads vive en js/leads.js (compartido con V1 y V2).
   ===================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var toArray = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- iconos ---------- */
  function icons() { if (window.lucide && lucide.createIcons) lucide.createIcons(); }
  icons();

  /* ---------- nav ---------- */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('nav-burger');
  function closeMenu() {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }
  if (burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    toArray('.nav__links a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  }

  /* ---------- barra inferior en móvil ---------- */
  var dock = document.getElementById('dockbar');
  var onScroll = function () {
    if (dock) dock.classList.toggle('is-on', scrollY > 600);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- reveals con IntersectionObserver (barato) ---------- */
  var reveals = toArray('.reveal');
  if (!reduce && 'IntersectionObserver' in window && reveals.length) {
    html.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- contadores ---------- */
  var counters = toArray('[data-count]');
  function fmtCount(v, el) {
    var n = Math.round(v);
    if (el.getAttribute('data-format') === 'es') return n.toLocaleString('es-ES');
    var pad = el.getAttribute('data-pad');
    if (pad) return String(n).padStart(parseInt(pad, 10), '0');
    return String(n);
  }
  function runCounter(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (reduce) { el.textContent = fmtCount(target, el); return; }
    var t0 = performance.now(), dur = 1100;
    (function step(t) {
      var k = Math.min((t - t0) / dur, 1);
      el.textContent = fmtCount(target * (1 - Math.pow(1 - k, 3)), el);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  if ('IntersectionObserver' in window && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        runCounter(e.target);
        cio.unobserve(e.target);
      });
    }, { threshold: .5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = fmtCount(parseFloat(el.getAttribute('data-count')), el); });
  }

  /* ---------- barras del reparto de unidades ---------- */
  var bars = toArray('[data-plan]');
  if (bars.length) {
    var bio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var v = parseFloat(el.getAttribute('data-plan'));
        var max = parseFloat(el.getAttribute('data-plan-max')) || 100;
        el.style.width = Math.max(4, (v / max) * 100) + '%';
        bio.unobserve(el);
      });
    }, { threshold: .4 });
    bars.forEach(function (el) { bio.observe(el); });
  }

  /* ---------- calculadora de retorno ----------
     Modelo deliberadamente simple y declarado como tal en la página:
     renta anual constante sobre el importe, sin impuestos, gastos ni
     revalorización. Sirve para dimensionar, no para decidir.        */
  var cAmount = document.getElementById('calc-amount');
  if (cAmount) {
    var cRoi = document.getElementById('calc-roi');
    var cYears = document.getElementById('calc-years');
    var outAmount = document.getElementById('calc-amount-out');
    var outRoi = document.getElementById('calc-roi-out');
    var outYears = document.getElementById('calc-years-out');
    var outYear = document.getElementById('calc-year');
    var outTotal = document.getElementById('calc-total');
    var outPay = document.getElementById('calc-payback');

    var usd = function (n) {
      return Math.round(n).toLocaleString('es-ES') + ' $';
    };
    var compact = function (n) {
      if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + 'M $';
      if (n >= 1e3) return Math.round(n / 1e3) + 'K $';
      return usd(n);
    };

    function calc() {
      var amount = +cAmount.value;
      var roi = +cRoi.value;
      var years = +cYears.value;

      outAmount.textContent = amount.toLocaleString('es-ES') + ' USD';
      outRoi.textContent = roi + ' %';
      outYears.textContent = years + (years === 1 ? ' año' : ' años');

      var perYear = amount * roi / 100;
      outYear.textContent = compact(perYear);
      outTotal.textContent = compact(perYear * years);
      outPay.textContent = roi > 0 ? (100 / roi).toFixed(1).replace('.', ',') : '—';
    }
    [cAmount, cRoi, cYears].forEach(function (el) {
      el.addEventListener('input', calc);
    });
    calc();
  }

  /* ---------- lightbox de vídeo ---------- */
  var lb = document.getElementById('lightbox');
  var lbVideo = document.getElementById('lightbox-video');
  var lastFocus = null;
  function openVideo(id) {
    lastFocus = document.activeElement;
    lbVideo.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
      '?autoplay=1&rel=0&modestbranding=1" title="Vídeo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
    lb.hidden = false;
    document.body.classList.add('is-locked');
    lb.querySelector('.lightbox__close').focus();
  }
  function closeVideo() {
    lb.hidden = true;
    lbVideo.innerHTML = '';
    document.body.classList.remove('is-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (window.TheOneLeads) TheOneLeads.resumeAuto();
  }
  toArray('[data-video]').forEach(function (b) {
    b.addEventListener('click', function () { openVideo(b.getAttribute('data-video')); });
  });
  if (lb) {
    toArray('[data-close]', lb).forEach(function (el) { el.addEventListener('click', closeVideo); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeVideo(); });
  }

  /* ---------- hooks del módulo de leads ---------- */
  if (window.TheOneLeads) {
    TheOneLeads.canAutoOpen = function () { return !lb || lb.hidden; };
    TheOneLeads.onOpen = icons;
  }

  /* los iconos inyectados por leads.js necesitan un segundo pase */
  addEventListener('load', icons);
})();
