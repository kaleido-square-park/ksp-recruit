/* TOPの入口の動き
   - オープニング（このタブで初めて開いたときだけ）：紺の画面に光の粒が瞬きながら現れ、
     写真の真ん中に集まり、光の中から写真が見えてくる（約1.8秒）
   - ヒーローの図形：画面の端から飛んできて、小さく弾んで止まる（毎回。オープニングがあるときは途中から重ねる）
   - タップ・スクロール・キー操作で、すぐに完成した画面に飛ぶ
   - 動きは transform と opacity だけ。覆いは飾り（aria-hidden）で、見出しや本文はHTMLのまま
   - 動きを減らす設定・JSが動かないときは、何もしない（最初から完成した画面） */
(function () {
  'use strict';

  var root = document.documentElement;
  var cover = document.querySelector('.op-cover');
  if (!root.classList.contains('motion-ok')) { if (cover) cover.remove(); return; }
  var canAnimate = !!Element.prototype.animate;
  var hero = document.querySelector('.hero-jr');

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    e.className = cls;
    parent.appendChild(e);
    return e;
  }

  // ---------- ヒーローの図形：近い方の端の外から飛んできて、少し行き過ぎて戻る ----------
  function introShapes(delay) {
    root.classList.add('hero-in');
    if (!hero || !canAnimate) return [];
    var hr = hero.getBoundingClientRect();
    var shapes = [].slice.call(hero.querySelectorAll('.fl i')).filter(function (i) { return i.getClientRects().length; });
    return shapes.map(function (i, n) {
      var r = i.getBoundingClientRect();
      var s = r.left + r.width / 2 < hr.left + hr.width / 2 ? 1 : -1; // 1＝左から右へ
      var dx = s > 0 ? hr.left - r.right - 24 : hr.right - r.left + 24;
      var dy = (n % 2 ? 1 : -1) * Math.min(60, hr.height * 0.08);
      return i.animate([
        { translate: dx + 'px ' + dy + 'px', transform: 'rotate(' + (-s * 160) + 'deg)', opacity: 0, easing: 'cubic-bezier(.22,.7,.3,1)' },
        { opacity: 0.85, offset: 0.2 },
        { translate: s * 6 + 'px 0px', transform: 'rotate(' + s * 8 + 'deg)', offset: 0.72, easing: 'ease-in-out' },
        { translate: '0px 0px', transform: 'rotate(0deg)', opacity: 0.85 }
      ], { duration: 540, delay: delay + n * 50, fill: 'backwards' });
    });
  }

  // 読み込みに時間がかかって、紺の画面がもう長く出ていたら、オープニングはやめる
  var late = performance.now() > 2500;
  if (!root.classList.contains('opening') || !cover || !canAnimate || !hero || late) {
    if (cover) cover.remove();
    root.classList.remove('opening');
    introShapes(100);
    return;
  }

  // ---------- オープニング ----------
  // 時間はページを開いてからの目安（ms）。紺の画面がすでに出ていた分（最大0.2秒）は差し引く
  var lag = Math.min(200, performance.now());
  function at(t) { return Math.max(0, t - lag); }

  cover.classList.add('is-live');
  var vw = window.innerWidth, vh = window.innerHeight;
  var img = hero.querySelector('.hero-jr__photo img');
  var box = img.parentElement;
  var pr = box.getBoundingClientRect();
  // 光が集まる場所：写真の真ん中（画面の外にはみ出すときは画面の中に寄せる）
  var cx = Math.min(Math.max(pr.left + pr.width / 2, 40), vw - 40);
  var cy = Math.min(Math.max(pr.top + pr.height / 2, 40), vh - 40);

  var bg = el('div', 'op-bg', cover);

  // 写真（本物の写真と同じ場所・同じ大きさ。上に、あらかじめぼかした小さい写真を重ねる）
  var photo = el('div', 'op-photo', cover);
  // 端は内側の整数pxにそろえる（本物の写真より1pxでも大きいと、表示の速さの計測で別の画像として数えられるため）
  var L = Math.ceil(pr.left), T = Math.ceil(pr.top);
  photo.style.cssText = 'left:' + L + 'px;top:' + T + 'px;width:' + (Math.floor(pr.right) - L) + 'px;height:' + (Math.floor(pr.bottom) - T) + 'px;border-radius:' + getComputedStyle(box).borderRadius;
  var sharp = el('img', '', photo);
  sharp.alt = '';
  sharp.src = img.currentSrc || img.src;
  var blur = el('img', '', photo);
  blur.alt = '';
  blur.src = 'assets/img/photos/hero-blur.webp';

  // やわらかい光のかたまり
  var g = Math.min(Math.max(pr.width, pr.height) * 0.9, Math.max(vw, vh) * 0.8);
  var glow = el('div', 'op-glow', cover);
  glow.style.cssText = 'left:' + (cx - g / 2) + 'px;top:' + (cy - g / 2) + 'px;width:' + g + 'px;height:' + g + 'px';

  // 光の粒（ロゴの多色をやわらげた色と白）
  var colors = ['var(--k-red)', 'var(--k-orange)', 'var(--k-yellow)', 'var(--k-green)', 'var(--k-blue)', 'var(--k-purple)', '#fff', '#FFF4D6'];
  var count = vw < 900 ? 24 : 30;
  var anims = [];
  var minD = Math.min(vw, vh) * 0.18;
  for (var n = 0; n < count; n++) {
    var x = rnd(0.05, 0.95) * vw, y = rnd(0.06, 0.94) * vh;
    var d = Math.hypot(x - cx, y - cy);
    if (d < minD) { x = cx + (x - cx) / (d || 1) * minD; y = cy + (y - cy) / (d || 1) * minD; }
    var star = Math.random() < 0.4;
    var sp = el('span', 'op-spark' + (star ? ' op-star' : ''), cover);
    sp.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--s:' + (star ? rnd(12, 22) : rnd(7, 15)).toFixed(1) + 'px;--c:' + colors[n % colors.length];
    var dot = el('i', '', sp);

    // 瞬き：現れて、1回だけ少し暗くなって、また明るく（1つの粒の点滅は1秒に3回より少ない）→ 集まりきって消える
    var t0 = 200 + rnd(0, 400), tEnd = 1250, D = tEnd - t0;
    var o = function (t) { return (t - t0) / D; };
    anims.push(dot.animate([
      { opacity: 0, transform: 'scale(.3)' },
      { opacity: 1, transform: 'scale(1)', offset: o(t0 + 150) },
      { opacity: 0.35, transform: 'scale(.7)', offset: o(t0 + 320) },
      { opacity: 1, transform: 'scale(1.05)', offset: o(t0 + 500) },
      { opacity: 1, transform: 'scale(.5)', offset: o(1150) },
      { opacity: 0, transform: 'scale(.3)' }
    ], { duration: D, delay: at(t0), easing: 'ease-in-out', fill: 'both' }));

    // 集まる：ゆるやかに、少しずつ遅れて写真の真ん中へ
    var tg = 700 + rnd(0, 150);
    anims.push(sp.animate([
      { translate: '0px 0px' },
      { translate: (cx - x) + 'px ' + (cy - y) + 'px' }
    ], { duration: 1200 + rnd(0, 60) - tg, delay: at(tg), easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' }));
  }

  anims.push(glow.animate([
    { opacity: 0, transform: 'scale(.25)' },
    { opacity: 1, transform: 'scale(.8)', offset: 0.45 },
    { opacity: 0.9, transform: 'scale(1.1)', offset: 0.6 },
    { opacity: 0, transform: 'scale(1.8)' }
  ], { duration: 800, delay: at(850), easing: 'ease-out', fill: 'both' }));

  // 景色が見えてくる：少し大きい状態から元の大きさへ戻りながら現れ、ぼけが解ける
  // 拡大するのは枠の中の写真だけ（枠は本物の写真と同じ大きさのまま。本物より大きく描かない）
  anims.push(photo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, delay: at(1000), easing: 'ease-out', fill: 'both' }));
  [sharp, blur].forEach(function (im) {
    anims.push(im.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 800, delay: at(1000), easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' }));
  });
  anims.push(blur.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: at(1250), easing: 'ease-in-out', fill: 'both' }));

  // 紺の覆いが消える → 覆いを取り除く
  var bgAnim = bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: at(1350), easing: 'ease-in-out', fill: 'both' });
  anims.push(bgAnim);

  var shapes = introShapes(at(1300));
  var afterT = setTimeout(afterglow, at(1600));
  var afters = [];

  // 余韻：写真が鮮明になったあと、2〜3粒のキラキラが写真の上でふっと消える
  function afterglow() {
    var media = hero.querySelector('.hero-jr__media');
    if (!media) return;
    [[0.24, 0.3], [0.7, 0.22], [0.56, 0.7]].forEach(function (p, k) {
      var a = el('span', 'op-after op-star', media);
      a.setAttribute('aria-hidden', 'true');
      afters.push(a);
      a.style.cssText = 'left:' + p[0] * 100 + '%;top:' + p[1] * 100 + '%;--s:' + (16 + k * 3) + 'px;--c:' + colors[(k * 3 + 2) % 6];
      var i = el('i', '', a);
      i.animate([
        { opacity: 0, transform: 'scale(.3) rotate(0deg)' },
        { opacity: 1, transform: 'scale(1) rotate(20deg)', offset: 0.35 },
        { opacity: 0, transform: 'scale(.2) rotate(45deg)' }
      ], { duration: 560, delay: k * 120, easing: 'ease-out', fill: 'both' }).onfinish = function () { a.remove(); };
    });
  }

  var ended = false;
  var opts = { capture: true, passive: true };
  var skipEvents = ['pointerdown', 'touchstart', 'wheel', 'keydown'];
  function end() {
    if (ended) return;
    ended = true;
    skipEvents.forEach(function (t) { window.removeEventListener(t, skip, opts); });
    window.removeEventListener('scroll', skip, opts);
    window.removeEventListener('resize', onResize);
    anims.forEach(function (a) { a.cancel(); });
    cover.remove();
    root.classList.remove('opening');
  }
  // 操作されたら、すぐに完成した画面へ（図形も定位置に。余韻は出さない）
  function skip() {
    if (ended) return;
    clearTimeout(afterT);
    shapes.forEach(function (a) { a.finish(); });
    afters.forEach(function (a) { a.remove(); });
    end();
  }
  // 幅が変わったら終わる（スマホでアドレスバーが出入りするだけの高さの変化では終わらない）
  function onResize() { if (window.innerWidth !== vw) skip(); }
  bgAnim.onfinish = end;
  skipEvents.forEach(function (t) { window.addEventListener(t, skip, opts); });
  window.addEventListener('scroll', skip, opts);
  window.addEventListener('resize', onResize);
})();
