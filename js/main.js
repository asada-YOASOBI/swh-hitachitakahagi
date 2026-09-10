(function () {
  'use strict';

  var HEADER_SCROLL_THRESHOLD_PX = 24;
  var HEADER_HIDE_AFTER_PX = 320;
  var REVEAL_ROOT_MARGIN = '0px 0px -18% 0px';
  var ANCHOR_OFFSET_PX = -72;
  var body = document.body;
  var header = document.querySelector('.header');
  // OS の「動きを減らす」設定では止めない（りり指示：動的HP。りりのWindowsはこの設定がONで、止めると動きが一切見えない）。
  // 静止撮影用の html.no-motion でだけ止める
  var prefersReducedMotion = document.documentElement.classList.contains('no-motion');
  // 動き（GSAP・Lenis）は描画後にフッターの読み込み処理が読み、swh:motion-ready を投げてから initMotion が動く
  var lenis = null;

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


  function initMotion() {
    if (prefersReducedMotion || !window.gsap || !window.ScrollTrigger) return;
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);
    if (typeof window.Lenis === 'function') {
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }

  // ---------- ファーストビュー：写真がゆっくり寄り、スクロールで沈む ----------
  function fvMotion() {
    if (!fv) return;
    gsap.from('.fv__pic img', { scale: 1.06, duration: 2, ease: 'power2.out' });
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

  // ---------- ご予約の前に：画面に固定して3項目を順に出す（必ず読ませるための「止まり」） ----------
  function noticePin() {
    var notice = document.querySelector('.notice');
    if (!notice) return;
    var items = notice.querySelectorAll('.rows__item');
    var timeline = gsap.timeline({
      scrollTrigger: { trigger: notice, start: 'top top', end: '+=90%', pin: true, scrub: 0.5, anticipatePin: 1 },
    });
    timeline.from(items, { autoAlpha: 0, y: 24, duration: 0.6, stagger: 0.5, ease: 'power2.out' });
    // 3つ目が出そろってからも少し止める
    timeline.to({}, { duration: 0.8 });
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

    fvMotion();
    noticePin();
    countUp();
    gsap.matchMedia().add('(min-width: 901px)', function () { parallaxPhotos(); });
    ScrollTrigger.refresh();
  }

  if (window.gsap && window.ScrollTrigger) initMotion();
  else document.addEventListener('swh:motion-ready', initMotion);
})();
