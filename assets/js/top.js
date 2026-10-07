/* TOPだけで使う動き（写真の切り替え・停止ボタン・浮かぶ図形・スクロールで現れるカード・見学パネル）
   - 動きを減らす設定のときは、何も動かさない（最終状態のまま見せる）
   - JSが動かないときは、CSSの html:not(.js) で全文・1枚目の写真が見える */
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!reduce.matches) root.classList.add('motion-ok');

  // 停止状態は、このタブの中だけ覚えておく（使えないときは無視）
  var KEY = 'ksp-top-paused';
  function loadPaused() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function savePaused(v) { try { sessionStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} }

  // ---------- ヘッダー：少しスクロールしたらナビに影 ----------
  function onScrollHeader() { body.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  // ---------- ヒーローの写真：5秒ごとにゆっくり切り替え（停止ボタンあり） ----------
  var slides = [].slice.call(document.querySelectorAll('.hero-jr__slide'));
  var dots = [].slice.call(document.querySelectorAll('.hero-jr__dot'));
  var toggle = document.querySelector('.motion-toggle');
  var hero = document.querySelector('.hero-jr');
  var current = 0, timer = null, heroVisible = true;
  var paused = loadPaused() || reduce.matches;

  function show(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) {
      s.classList.toggle('is-current', k === current);
      s.setAttribute('aria-hidden', String(k !== current));
    });
    dots.forEach(function (d, k) { d.classList.toggle('is-current', k === current); });
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() {
    stopTimer();
    if (paused || !heroVisible || slides.length < 2) return;
    timer = setInterval(function () { show(current + 1); }, 5000);
  }
  function setPaused(v) {
    paused = v;
    body.classList.toggle('is-paused', v);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(v));
      toggle.querySelector('.motion-toggle__label').textContent = v ? '再生' : '停止';
      toggle.setAttribute('aria-label', v ? '写真の切り替えと動きを再生' : '写真の切り替えと動きを停止');
    }
    startTimer();
  }

  if (slides.length) {
    show(0);
    if (toggle) toggle.addEventListener('click', function () {
      var v = !paused; setPaused(v); savePaused(v);
    });
    if (hero && 'IntersectionObserver' in window) {
      // 画面外では切り替えを止める
      new IntersectionObserver(function (es) {
        heroVisible = es[0].isIntersecting;
        body.classList.toggle('is-hero-off', !heroVisible); // 浮かぶ図形の揺れも止める
        startTimer();
      }).observe(hero);
    }
    setPaused(paused);
    reduce.addEventListener('change', function () { if (reduce.matches) setPaused(true); });
  }

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

/* 見学パネル（「見学を相談する」で開く）
   - JSなし：ボタンは #tour へのリンクのまま。ページ内の電話番号・メールアドレスへ移動する
   - JSあり：画面の下から開く（PCは中央）。×・背景・Escで閉じる。開いている間は背景を inert にして、操作をパネルの中にとどめる */
(function () {
  'use strict';
  var tour = document.getElementById('tour');
  if (!tour) return;
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  // 背景を inert にするため、main の外（body の末尾）へ移す
  document.body.appendChild(tour);
  tour.setAttribute('role', 'dialog');
  tour.setAttribute('aria-modal', 'true');

  var sheet = tour.querySelector('.tour__sheet');
  var closeBtn = tour.querySelector('.tour__close');
  var copyBtn = tour.querySelector('.tour__copy');
  var mail = tour.querySelector('.tour__mail');
  var msg = tour.querySelector('.tour__msg');
  var others = [].slice.call(document.querySelectorAll('.skip-link, .site-header, main, .site-footer, .fixed-bar'));
  var opener = null, closeTimer = null;

  function focusables() {
    return [].slice.call(sheet.querySelectorAll('a[href], button:not([disabled])')).filter(function (el) { return el.offsetParent !== null; });
  }
  function open(e) {
    e.preventDefault();
    clearTimeout(closeTimer);
    opener = e.currentTarget;
    msg.textContent = '';
    tour.classList.add('is-open');
    root.classList.add('is-locked');
    others.forEach(function (el) { el.inert = true; });
    // 1フレーム待ってから表示（下から上がる動き）
    requestAnimationFrame(function () { requestAnimationFrame(function () { tour.classList.add('is-shown'); }); });
    closeBtn.focus();
  }
  function close() {
    if (!tour.classList.contains('is-open')) return;
    tour.classList.remove('is-shown');
    others.forEach(function (el) { el.inert = false; });
    root.classList.remove('is-locked');
    closeTimer = setTimeout(function () { tour.classList.remove('is-open'); }, reduce.matches ? 0 : 300);
    if (opener) opener.focus();
  }

  [].slice.call(document.querySelectorAll('[data-tour-open]')).forEach(function (btn) {
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.addEventListener('click', open);
  });
  closeBtn.addEventListener('click', close);
  tour.addEventListener('click', function (e) { if (e.target === tour) close(); }); // 背景のタップ
  document.addEventListener('keydown', function (e) {
    if (!tour.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { // パネルの中で一周させる
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // コピー：使えるときはクリップボードへ。http のプレビューなどで使えないときは、選択状態にして案内する
  function selectMail() {
    var r = document.createRange(); r.selectNodeContents(mail);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function fallback() {
    selectMail();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    if (ok) { msg.textContent = 'アドレスをコピーしました'; return; }
    msg.textContent = window.matchMedia('(pointer: coarse)').matches
      ? 'アドレスを選択しました。長押しでコピーできます'
      : 'アドレスを選択しました。Ctrl+C（Macは⌘+C）でコピーできます';
  }
  copyBtn.addEventListener('click', function () {
    var text = mail.textContent.trim();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { msg.textContent = 'アドレスをコピーしました'; }, fallback);
    } else {
      fallback();
    }
  });
})();
