(function () {
  'use strict';

  var HEADER_SCROLL_THRESHOLD_PX = 24;
  var HEADER_HIDE_AFTER_PX = 320;
  var REVEAL_ROOT_MARGIN = '0px 0px -18% 0px';
  var ANCHOR_OFFSET_PX = -72;
  var body = document.body;
  var header = document.querySelector('.header');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap === 'object' || typeof window.gsap === 'function';
  var useMotion = !prefersReducedMotion && hasGsap;

  // ---------- 慣性スクロール（Lenis）。reduce 指定時と未読込時は素のスクロール ----------
  var lenis = null;
  if (!prefersReducedMotion && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    if (useMotion) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  } else if (useMotion) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  // ページ内リンク。tripla の予約ボタンは data 属性で SDK が拾うので触らない
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: ANCHOR_OFFSET_PX });
      else target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  });

  // ---------- ヘッダー：背景付与＋下スクロールで隠れ、上スクロールで戻る ----------
  var lastScrollY = window.scrollY;
  function updateHeader() {
    if (!header) return;
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > HEADER_SCROLL_THRESHOLD_PX);
    var isScrollingDown = y > lastScrollY && y > HEADER_HIDE_AFTER_PX;
    header.classList.toggle('is-hidden', isScrollingDown && !body.classList.contains('menu-open'));
    lastScrollY = y;
  }
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  // ファーストビューとフッターでは右下の固定CTAを引っ込める（ヘッダーとフッターに予約があるため）
  var fv = document.querySelector('.fv');
  var footer = document.querySelector('.footer');
  if ('IntersectionObserver' in window) {
    if (fv) {
      body.classList.add('in-fv');
      new IntersectionObserver(function (entries) {
        body.classList.toggle('in-fv', entries[0].isIntersecting);
      }, { threshold: 0.15 }).observe(fv);
    }
    if (footer) {
      new IntersectionObserver(function (entries) {
        body.classList.toggle('at-footer', entries[0].isIntersecting);
      }, { threshold: 0.2 }).observe(footer);
    }
  }

  // ---------- メニュー ----------
  var menuButton = document.querySelector('.pill--menu');
  function setMenu(isOpen) {
    body.classList.toggle('menu-open', isOpen);
    if (menuButton) menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (lenis) { if (isOpen) lenis.stop(); else lenis.start(); }
  }
  if (menuButton) {
    menuButton.addEventListener('click', function () { setMenu(!body.classList.contains('menu-open')); });
    document.querySelectorAll('.overlay a').forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && body.classList.contains('menu-open')) setMenu(false);
    });
  }

  // ---------- 出現（IntersectionObserver＋クラス付与） ----------
  var revealTargets = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    revealTargets.forEach(function (el) { el.classList.add('is-inview'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: REVEAL_ROOT_MARGIN });
    revealTargets.forEach(function (el) { observer.observe(el); });
  }

  if (!useMotion) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;

  // ---------- ファーストビュー：写真がゆっくり寄り、スクロールで沈む ----------
  function fvMotion() {
    if (!fv) return;
    gsap.from('.fv__pic img', { scale: 1.08, duration: 2.4, ease: 'power2.out' });
    gsap.from('.fv__eyebrow, .fv__catch, .fv__lead', { autoAlpha: 0, y: 26, duration: 1, ease: 'power2.out', stagger: 0.14, delay: 0.3 });
    gsap.from('.fv__facts, .fv__scroll', { autoAlpha: 0, duration: 1, ease: 'power2.out', delay: 1.1 });
    gsap.from('.header .brand, .header .nav a, .header .pill', { autoAlpha: 0, y: -10, duration: 0.8, ease: 'power2.out', stagger: 0.06, delay: 0.9, clearProps: 'all' });
    gsap.fromTo('.fv__scroll i', { scaleY: 0 }, { scaleY: 1, duration: 1.4, ease: 'power2.inOut', repeat: -1, repeatDelay: 0.4, transformOrigin: 'top' });
    gsap.to('.fv__pic', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: fv, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.fv__body, .fv__facts', { autoAlpha: 0, y: -30, ease: 'none', scrollTrigger: { trigger: fv, start: '35% top', end: '85% top', scrub: true } });
  }

  // ---------- 写真のパララックス（scrub）とコラージュの速度差 ----------
  function parallaxPhotos() {
    document.querySelectorAll('.photo[data-parallax]').forEach(function (frame) {
      var img = frame.querySelector('img');
      if (!img) return;
      gsap.fromTo(img, { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
    });
    document.querySelectorAll('.collage__item').forEach(function (item, index) {
      var distance = [-60, 40, -30, 70][index % 4];
      gsap.fromTo(item, { y: -distance }, {
        y: distance, ease: 'none',
        scrollTrigger: { trigger: '.scenes', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
    });
  }

  // ---------- 巨大数字のカウントアップ ----------
  function countUp() {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      if (isNaN(end)) return;
      var counter = { value: 0 };
      gsap.to(counter, {
        value: end, duration: 1.4, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate: function () { el.textContent = Math.round(counter.value); },
      });
    });
  }

  document.fonts.ready.then(function () {
    fvMotion();
    countUp();
    gsap.matchMedia().add('(min-width: 901px)', function () { parallaxPhotos(); });
    ScrollTrigger.refresh();
  });
})();
