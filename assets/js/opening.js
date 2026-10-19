/* TOPの入口の動き
   - オープニング（このタブで初めて開いたときだけ）：サイトと同じ淡い緑の画面に光の粒が瞬きながら現れ、
     画面の中央に集まり、ふんわり光った中からロゴが現れて、ふわっとヒーローに切り替わる（約2.4秒）
   - ヒーローの図形：画面の端から飛んできて、小さく弾んで止まる（毎回。オープニングがあるときは終わりに重ねる）
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

  // 読み込みに時間がかかって、覆いがもう長く出ていたら、オープニングはやめる
  var late = performance.now() > 2500;
  if (!root.classList.contains('opening') || !cover || !canAnimate || !hero || late) {
    if (cover) cover.remove();
    root.classList.remove('opening');
    introShapes(100);
    return;
  }

  // ---------- オープニング ----------
  // 時間はページを開いてからの目安（ms）。覆いがすでに出ていた分（最大0.2秒）は差し引く
  var lag = Math.min(200, performance.now());
  function at(t) { return Math.max(0, t - lag); }

  cover.classList.add('is-live');
  var vw = window.innerWidth, vh = window.innerHeight;
  var cx = vw / 2, cy = vh / 2; // 光が集まる場所：画面の中央

  var bg = el('div', 'op-bg', cover);

  // やわらかい光（ロゴのまわりがふんわり明るくなる程度）
  var g = Math.min(vw, vh) * 0.9;
  var glow = el('div', 'op-glow', cover);
  glow.style.cssText = 'left:' + (cx - g / 2) + 'px;top:' + (cy - g / 2) + 'px;width:' + g + 'px;height:' + g + 'px';

  // ロゴ（支給の画像そのまま。幅はスマホで画面の64%、最大420px）
  var lw = Math.min(vw * 0.64, 420), lh = lw * 237 / 903;
  var logo = window.opLogo || new Image(); // <head> で読み込みを始めたもの
  logo.className = 'op-logo';
  logo.alt = '';
  if (!logo.src) logo.src = 'assets/img/logo/tringsmith-logo.png';
  cover.appendChild(logo);
  logo.style.cssText = 'left:' + (cx - lw / 2) + 'px;top:' + (cy - lh / 2) + 'px;width:' + lw + 'px;height:' + lh + 'px';

  // 光の粒（サイトのオレンジ・ロゴの緑・ロゴの多色を濃くした色）。PCは少し多く、画面の幅に合わせて大きく（最大1.6倍）
  var colors = ['#F99000', '#63A43C', '#E0675C', '#E2B100', '#3E8ED0', '#9466C2', '#436E28'];
  var count = vw < 900 ? 22 : 32;
  var k = Math.min(Math.max(vw / 390, 1), 1.6);
  var anims = [];
  var minD = Math.min(vw, vh) * 0.18;
  for (var n = 0; n < count; n++) {
    var x = rnd(0.05, 0.95) * vw, y = rnd(0.06, 0.94) * vh;
    var d = Math.hypot(x - cx, y - cy);
    if (d < minD) { x = cx + (x - cx) / (d || 1) * minD; y = cy + (y - cy) / (d || 1) * minD; }
    var star = Math.random() < 0.4;
    var sp = el('span', 'op-spark' + (star ? ' op-star' : ''), cover);
    sp.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--s:' + ((star ? rnd(12, 22) : rnd(8, 15)) * k).toFixed(1) + 'px;--c:' + colors[n % colors.length];
    var dot = el('i', '', sp);

    // 瞬き：現れて、1回だけ少し暗くなって、また明るく（1つの粒の点滅は1秒に3回より少ない）→ 中央でふくらみながら消える
    var t0 = 200 + rnd(0, 400), tEnd = 1320, D = tEnd - t0;
    var o = function (t) { return (t - t0) / D; };
    anims.push(dot.animate([
      { opacity: 0, transform: 'scale(.3)' },
      { opacity: 1, transform: 'scale(1)', offset: o(t0 + 150) },
      { opacity: 0.4, transform: 'scale(.7)', offset: o(t0 + 320) },
      { opacity: 1, transform: 'scale(1.05)', offset: o(t0 + 500) },
      { opacity: 1, transform: 'scale(.8)', offset: o(1180) },
      { opacity: 0, transform: 'scale(1.8)' }
    ], { duration: D, delay: at(t0), easing: 'ease-in-out', fill: 'both' }));

    // 集まる：ゆるやかに、少しずつ遅れて画面の中央へ
    var tg = 700 + rnd(0, 150);
    anims.push(sp.animate([
      { translate: '0px 0px' },
      { translate: (cx - x) + 'px ' + (cy - y) + 'px' }
    ], { duration: 1200 + rnd(0, 60) - tg, delay: at(tg), easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' }));
  }

  // ぱっと光る（やわらかく）
  anims.push(glow.animate([
    { opacity: 0, transform: 'scale(.3)' },
    { opacity: 0.9, transform: 'scale(1)', offset: 0.35 },
    { opacity: 0.55, transform: 'scale(1.15)', offset: 0.7 },
    { opacity: 0, transform: 'scale(1.3)' }
  ], { duration: 700, delay: at(1100), easing: 'ease-out', fill: 'both' }));

  // ロゴが現れ（少し小さい・薄い → 元の大きさ）、ふわっと薄れる（1.2〜1.7秒で現れ、1.7〜2.3秒で薄れる）
  // 1つのアニメーションにまとめる（同じ要素に2つ重ねると、読み込み中に動かなくなるため）
  anims.push(logo.animate([
    { opacity: 0, transform: 'scale(.94)', easing: 'cubic-bezier(.2,.6,.3,1)' },
    { opacity: 1, transform: 'scale(1)', offset: 500 / 1100, easing: 'ease-in-out' },
    { opacity: 0, transform: 'scale(1.03)' }
  ], { duration: 1100, delay: at(1200), fill: 'both' }));

  // 覆いが消えて、ヒーローが見える → 覆いを取り除く
  var bgAnim = bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, delay: at(1750), easing: 'ease-in-out', fill: 'both' });
  anims.push(bgAnim);

  var shapes = introShapes(at(1800));

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
  // 操作されたら、すぐに完成した画面へ（図形も定位置に）
  function skip() {
    if (ended) return;
    shapes.forEach(function (a) { a.finish(); });
    end();
  }
  // 幅が変わったら終わる（スマホでアドレスバーが出入りするだけの高さの変化では終わらない）
  function onResize() { if (window.innerWidth !== vw) skip(); }
  bgAnim.onfinish = end;
  skipEvents.forEach(function (t) { window.addEventListener(t, skip, opts); });
  window.addEventListener('scroll', skip, opts);
  window.addEventListener('resize', onResize);
})();
