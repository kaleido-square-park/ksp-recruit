/* アクセス解析（Google アナリティクス 4）
   - 本番のURL（recruit.tringsmith.co.jp）で開いたときだけ読み込む。それ以外（プレビューなど）では何もしない
   - 押されたことを記録するリンク（それぞれ別のイベント）
     airwork_click：Airワークの求人ページ（job＝職種名、area＝村上／胎内）
     tel_click    ：電話（link_url＝tel:番号）
     mail_click   ：メール（link_url＝mailto:アドレス）
     どれも placement（ページのどこで押されたか）と link_text を付ける */
(function () {
  'use strict';

  var ID = 'G-3G5SG8WVXV';
  var HOSTS = ['recruit.tringsmith.co.jp'];
  if (HOSTS.indexOf(location.hostname) === -1) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID);
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);

  // ページのどこで押されたか
  function placement(a) {
    if (a.closest('.tour')) return 'tour_panel';             // 見学の相談パネル
    if (a.closest('.fixed-bar')) return 'fixed_bar';         // スマホの固定バー
    if (a.closest('.site-footer__consult')) return 'footer_consult'; // フッターの相談窓口
    if (a.closest('.site-footer')) return 'footer';
    if (a.closest('.site-header')) return 'header';
    var sec = a.closest('section[id], article[id]');
    return sec ? sec.id : 'main';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    var p = { link_text: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 100), placement: placement(a) };
    var name;
    if (/^https:\/\/arwrk\.net\//.test(a.href)) {
      name = 'airwork_click';
      var t = a.closest('.jcard') && a.closest('.jcard').querySelector('.jcard__title');
      p.job = t ? t.textContent.trim() : '';
      var area = p.link_text.match(/村上|胎内/);
      if (area) p.area = area[0];
      p.link_url = a.href;
    } else if (/^tel:/i.test(href)) {
      name = 'tel_click';
      p.link_url = href;
    } else if (/^mailto:/i.test(href)) {
      name = 'mail_click';
      p.link_url = href.split('?')[0];
    } else {
      return;
    }
    gtag('event', name, p);
  }, true);
})();
