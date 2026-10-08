/* TOPだけで使う動き（浮かぶ図形・スクロールで現れるカード）
   - 動きを減らす設定のときは、何も動かさない（最終状態のまま見せる）
   - JSが動かないときは、CSSの html:not(.js) で全文が見える */
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!reduce.matches) root.classList.add('motion-ok');

  // ---------- ヘッダー：少しスクロールしたらナビに影 ----------
  function onScrollHeader() { body.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  if (reduce.matches) return; // ここから先は「動きを減らす」でないときだけ

  // ---------- スクロールで現れる（カード類だけ。同じ並びの中で少しずつずらす） ----------
  var reveals = [].slice.call(document.querySelectorAll('[data-reveal]'));
  var groups = new Map();
  reveals.forEach(function (el) {
    var g = el.parentElement;
    var n = groups.get(g) || 0;
    el.style.setProperty('--delay', Math.min(n, 5) * 0.08 + 's');
    groups.set(g, n + 1);
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  // ---------- 浮かぶ図形：スクロールに合わせて少しずつずれる（画面内のものだけ計算） ----------
  var floats = [].slice.call(document.querySelectorAll('.fl[data-depth]'));
  var active = new Set();
  if ('IntersectionObserver' in window && floats.length) {
    var fio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) active.add(e.target); else active.delete(e.target); });
      requestTick();
    }, { rootMargin: '120px 0px' });
    floats.forEach(function (el) { fio.observe(el); });
  }
  var ticking = false;
  function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  function update() {
    ticking = false;
    var vh = window.innerHeight;
    active.forEach(function (el) {
      var host = el.offsetParent || el.parentElement;
      var r = host.getBoundingClientRect();
      var center = r.top + r.height / 2 - vh / 2;  // 章の中心が画面の中心から何pxずれているか
      var depth = parseFloat(el.dataset.depth) || 0.1;
      el.style.setProperty('--py', (-center * depth).toFixed(1) + 'px');
    });
  }
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
})();
