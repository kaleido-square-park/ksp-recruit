/* ② 「福祉の仕事」のイメージを3つこわす
   - 白いカード（よくあるイメージ）が画面に入ったら、ひびが入って割れ、下から「本当の姿」が出る
   - 文字はすべてHTMLのまま。破片・ひびは飾り（aria-hidden）
   - 破片の動きは transform と opacity だけ（スマホでもカクつかないように）
   - 動きを減らす設定のときは、最初から割れた後の形を見せる
   - JSが動かないときは、CSSの初期状態（全文が見える）のまま */
(function () {
  'use strict';

  var wall = document.getElementById('wall');
  if (!wall) return;
  var cards = [].slice.call(wall.querySelectorAll('.wall__myth'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var canAnimate = !!Element.prototype.animate;

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    e.className = cls;
    e.setAttribute('aria-hidden', 'true');
    parent.appendChild(e);
    return e;
  }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function clamp01(p) { return p < 0 ? 0 : p > 1 ? 1 : p; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function finish(card) {
    card.classList.add('is-broken');
    card.parentElement.classList.add('is-open');
  }

  // ---------- 1枚のカードを割る（約1.1秒） ----------
  var CRACK = 500, FLY = 650; // ひび 0.5秒 → 割れて落ちる 0.65秒

  // カードを、ゆがんだ格子 → 三角形に分ける（ひびの線＝破片の境目）
  function shards(w, h) {
    var C = Math.max(4, Math.min(7, Math.round(w / 80))), R = h > 120 ? 3 : 2;
    var cw = w / C, ch = h / R, V = [], i, j;
    for (i = 0; i <= C; i++) {
      V[i] = [];
      for (j = 0; j <= R; j++) {
        var x = i * cw, y = j * ch;
        if (i > 0 && i < C) x += rnd(-0.3, 0.3) * cw;
        if (j > 0 && j < R) y += rnd(-0.3, 0.3) * ch;
        V[i][j] = [x, y];
      }
    }
    var T = [];
    for (i = 0; i < C; i++) {
      for (j = 0; j < R; j++) {
        var a = V[i][j], b = V[i + 1][j], c = V[i + 1][j + 1], d = V[i][j + 1];
        if (Math.random() < 0.5) { T.push([a, b, c]); T.push([a, c, d]); }
        else { T.push([a, b, d]); T.push([b, c, d]); }
      }
    }
    return T;
  }

  function breakCard(card) {
    var w = card.offsetWidth, h = card.offsetHeight;
    var ix = w * rnd(0.62, 0.78), iy = h * rnd(0.4, 0.6); // 当たる点（文字の少ない右寄り）
    var tris = shards(w, h);

    // 白い面を破片に置きかえる（見た目は同じ。ここから破片が動く）
    var box = el('div', 'wall__shards', card);
    // 破片は三角形を囲む大きさだけの層にする（動かす面を小さくして軽くする）
    var radius = getComputedStyle(card).borderTopLeftRadius;
    var parts = tris.map(function (t) {
      var x0 = Math.floor(Math.min(t[0][0], t[1][0], t[2][0])), y0 = Math.floor(Math.min(t[0][1], t[1][1], t[2][1]));
      var x1 = Math.ceil(Math.max(t[0][0], t[1][0], t[2][0])), y1 = Math.ceil(Math.max(t[0][1], t[1][1], t[2][1]));
      var s = el('i', '', box);
      s.style.cssText = 'left:' + x0 + 'px;top:' + y0 + 'px;width:' + (x1 - x0) + 'px;height:' + (y1 - y0) + 'px;clip-path:polygon(' +
        t.map(function (p) { return (p[0] - x0).toFixed(1) + 'px ' + (p[1] - y0).toFixed(1) + 'px'; }).join(',') + ')';
      // 中身はカードと同じ白い面（角の丸みも同じ）を、破片の位置に合わせてずらしたもの
      var face = el('b', '', s);
      face.style.cssText = 'left:' + -x0 + 'px;top:' + -y0 + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + radius;
      var cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      s.style.transformOrigin = (cx - x0).toFixed(1) + 'px ' + (cy - y0).toFixed(1) + 'px';
      return { s: s, cx: cx, cy: cy };
    });
    card.classList.add('is-cracking');

    // ひび：当たった点に近い線から順に伸びる（小さなcanvas。0.5秒だけ描く）
    var edges = [], seen = {};
    tris.forEach(function (t) {
      for (var k = 0; k < 3; k++) {
        var p = t[k], q = t[(k + 1) % 3];
        var onEdge = (p[0] === q[0] && (p[0] === 0 || p[0] === w)) || (p[1] === q[1] && (p[1] === 0 || p[1] === h));
        var key = [p.join(), q.join()].sort().join('|');
        if (seen[key] || onEdge) continue;
        seen[key] = 1;
        var dp = Math.hypot(p[0] - ix, p[1] - iy), dq = Math.hypot(q[0] - ix, q[1] - iy);
        edges.push(dp <= dq ? { a: p, b: q, d: dp } : { a: q, b: p, d: dq });
      }
    });
    var maxD = edges.reduce(function (m, e) { return Math.max(m, e.d); }, 1);
    var cv = el('canvas', 'wall__crack', card);
    cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
    var g = cv.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.strokeStyle = 'rgba(34, 58, 18, .7)';
    g.lineWidth = 1.5; g.lineCap = 'round';

    // 小さく揺れる（左右3pxまで）
    card.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(3px)' },
      { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }
    ], { duration: 300, delay: CRACK - 300 });

    var t0 = null;
    function crack(now) {
      if (t0 === null) t0 = now;
      var p = easeOut(clamp01((now - t0) / CRACK));
      g.clearRect(0, 0, w, h);
      g.beginPath();
      edges.forEach(function (e) {
        var s = clamp01((p * 1.25 * maxD - e.d) / 70);
        if (s <= 0) return;
        g.moveTo(e.a[0], e.a[1]);
        g.lineTo(e.a[0] + (e.b[0] - e.a[0]) * s, e.a[1] + (e.b[1] - e.a[1]) * s);
      });
      g.stroke();
      if (p < 1) requestAnimationFrame(crack); else shatter();
    }
    requestAnimationFrame(crack);

    function shatter() {
      cv.remove();
      finish(card);
      // 光：当たった点からぱっと広がって消える
      var glow = el('i', 'wall__glow', card);
      glow.style.left = ix + 'px'; glow.style.top = iy + 'px';
      glow.animate([
        { transform: 'translate(-50%, -50%) scale(.2)', opacity: 0.9 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }
      ], { duration: 360, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'forwards' });
      // 破片：外へはじけて、落ちながら消える（放物線を点でたどる）
      var last;
      parts.forEach(function (f) {
        var dx = f.cx - ix, dy = f.cy - iy, dist = Math.hypot(dx, dy) || 1;
        var vx = dx / dist * rnd(60, 180) + rnd(-30, 30), vy = -rnd(80, 240) + dy * 0.6, va = rnd(-340, 340);
        var kf = [];
        for (var n = 0; n <= 6; n++) {
          var u = n / 6 * FLY / 1000;
          kf.push({
            transform: 'translate(' + (vx * u).toFixed(1) + 'px,' + (vy * u + 700 * u * u).toFixed(1) + 'px) rotate(' + (va * u).toFixed(1) + 'deg)',
            opacity: n < 3 ? 1 : 1 - (n - 2) / 4
          });
        }
        last = f.s.animate(kf, { duration: FLY, fill: 'forwards' });
      });
      last.onfinish = function () { box.remove(); glow.remove(); card.classList.remove('is-cracking'); };
    }
  }

  if (reduce || !canAnimate || !('IntersectionObserver' in window)) {
    cards.forEach(finish);
    return;
  }

  // 準備ができてから、本当の姿を隠す（JSが途中で止まっても本文は消えない）
  wall.classList.add('is-armed');

  // 判定の線：画面の上から6割の位置。線より上に来たら再生する。
  // 上側は大きく広げてあるので、メニューで飛んだり速くスクロールしたりして
  // 一気に通り過ぎたカードも拾える（そのときは動かさずに割れた後の形にする）
  var header = document.querySelector('.site-header');
  var nextAt = 0, GAP = 700;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var past = e.boundingClientRect.bottom < (header ? header.offsetHeight : 64);
      if (past) { finish(e.target); return; }
      // 同時に画面に入ったとき（PCなど）は、1枚ずつ順に割る
      var now = performance.now(), at = Math.max(now, nextAt);
      nextAt = at + GAP;
      setTimeout(function () { breakCard(e.target); }, at - now);
    });
  }, { rootMargin: '100000px 0px -40% 0px', threshold: 0 });
  cards.forEach(function (c) { io.observe(c); });
})();
