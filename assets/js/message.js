/* 想いのページ：読み進み具合のバー、目次の現在地、目次の開閉
   （動きは付けない。バーの伸びと現在地の印だけ） */
(function () {
  'use strict';

  var body = document.body;
  function onScrollHeader() { body.classList.toggle('is-scrolled', window.scrollY > 8); }

  // ---------- 読み進み具合のバー ----------
  var bar = document.querySelector('.progress__bar');
  var ticking = false;
  // 幅の広い画面で固定している目次は、フッターの手前で止める（フッターに重ならない）
  var tocBox = document.querySelector('.toc__box');
  var footer = document.querySelector('.site-footer');
  var tocWide = window.matchMedia('(min-width: 1280px)');
  function stopTocAtFooter() {
    if (!tocBox || !footer) return;
    if (!tocWide.matches) { tocBox.style.transform = ''; return; }
    var gap = footer.getBoundingClientRect().top - (tocBox.offsetTop + tocBox.offsetHeight) - 24;
    tocBox.style.transform = gap < 0 ? 'translateY(' + gap.toFixed(1) + 'px)' : '';
  }
  function update() {
    ticking = false;
    onScrollHeader();
    stopTocAtFooter();
    if (!bar) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();

  // ---------- 目次：スマホは閉じて始める／PC（幅の広い画面）は常に開く ----------
  var box = document.querySelector('.toc__box');
  var wide = window.matchMedia('(min-width: 1280px)');
  function syncToc() {
    if (!box) return;
    box.open = wide.matches;
  }
  syncToc();
  wide.addEventListener('change', syncToc);
  if (box) {
    box.addEventListener('toggle', function () { if (wide.matches && !box.open) box.open = true; });
    // 目次のリンクを押したら、スマホでは閉じる
    box.addEventListener('click', function (e) {
      if (!wide.matches && e.target.closest('.toc__list a')) box.open = false;
    });
  }

  // ---------- 目次：いま読んでいる章に印を付ける ----------
  var links = [].slice.call(document.querySelectorAll('.toc__list a'));
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  var chapters = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);

  function setCurrent(id) {
    links.forEach(function (a) {
      if (a === map[id]) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  if ('IntersectionObserver' in window && chapters.length) {
    // 画面の上から35%の線をまたいでいる章を「いま」とする
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setCurrent(en.target.id); });
    }, { rootMargin: '-35% 0px -64% 0px' });
    chapters.forEach(function (c) { io.observe(c); });
  }
})();
