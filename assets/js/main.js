/* 共通：ヘッダーのメニュー、スマホの固定バー
   （html.js クラスは <head> のインラインで付けている） */
(function () {
  'use strict';

  // ---------- スマホのメニュー ----------
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  var mq = window.matchMedia('(max-width: 899px)');

  function setOpen(open) {
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

  // ---------- スマホの固定バー：ヒーローを過ぎてから表示 ----------
  var bar = document.getElementById('fixed-bar');
  var hero = document.querySelector('.hero, .hero-jr, .msg-hero');
  if (bar && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-visible', !entries[0].isIntersecting);
    }).observe(hero);
  } else if (bar) {
    bar.classList.add('is-visible');
  }
})();
