/* 共通：ヘッダーのメニュー、スマホのヘッダーの出し入れ、スマホの固定バー
   （html.js クラスは <head> のインラインで付けている） */
(function () {
  'use strict';

  // ---------- スマホのメニュー ----------
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  var mq = window.matchMedia('(max-width: 899px)');

  var header = document.querySelector('.site-header');
  var menuOpen = false;
  function setOpen(open) {
    menuOpen = open;
    document.body.classList.toggle('menu-open', open);
    if (open && header) header.classList.remove('is-hidden');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.nav-toggle__label').textContent = open ? '閉じる' : 'メニュー';
    nav.hidden = !open;
  }
  function syncNav() {
    if (mq.matches) { setOpen(false); } else { nav.hidden = false; }
  }

  if (toggle && nav) {
    syncNav();
    mq.addEventListener('change', syncNav);
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    // メニューの中のリンクを押したら閉じる
    nav.addEventListener('click', function (e) {
      if (mq.matches && e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // ---------- スマホのヘッダー：下にスクロールしている間は隠し、少し上に戻したら出す ----------
  // ページの一番上・メニューを開いている間・キーボードのフォーカスがヘッダー内にあるときは、常に出す
  if (header) {
    var lastY = window.scrollY, upAcc = 0, ticking = false;
    var show = function () { header.classList.remove('is-hidden'); upAcc = 0; };
    var onScroll = function () {
      ticking = false;
      var y = Math.max(window.scrollY, 0);
      var d = y - lastY;
      lastY = y;
      if (!mq.matches || menuOpen || y <= header.offsetHeight) { show(); return; }
      if (d > 0) {
        upAcc = 0;
        if (!header.querySelector(':focus-visible')) header.classList.add('is-hidden');
      } else if (d < 0) {
        upAcc -= d;
        if (upAcc >= 10) show();
      }
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    header.addEventListener('focusin', show);
    mq.addEventListener('change', show);
  }

  // ---------- スマホの固定バー：ヒーローを過ぎてから表示 ----------
  var bar = document.getElementById('fixed-bar');
  var hero = document.querySelector('.hero, .hero-jr, .msg-hero, .voice-hero');
  if (bar && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-visible', !entries[0].isIntersecting);
    }).observe(hero);
  } else if (bar) {
    bar.classList.add('is-visible');
  }
})();
