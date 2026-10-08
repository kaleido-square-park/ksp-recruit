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
