/* UI 연결 (계산 엔진은 acquisition-tax.js, 데이터는 rules-2026.js) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORAGE_KEY = 'acqtax_input_v1';

  var els = {
    price: $('price'), area: $('area'), houseCount: $('houseCount'),
    isAdjustedArea: $('isAdjustedArea'), isTemporaryTwoHouse: $('isTemporaryTwoHouse'),
    isFirstHome: $('isFirstHome'), isPopDecreaseArea: $('isPopDecreaseArea'),
    priceKorean: $('priceKorean'),
  };

  function digits(s) { return (s || '').replace(/[^0-9]/g, ''); }
  function fmt(n) { return Number(n).toLocaleString('ko-KR'); }

  // 억/만원 한글 표기
  function toKorean(won) {
    if (!won) return '';
    var eok = Math.floor(won / 100000000);
    var man = Math.floor((won % 100000000) / 10000);
    var parts = [];
    if (eok) parts.push(eok + '억');
    if (man) parts.push(fmt(man) + '만');
    var rest = won % 10000;
    if (rest) parts.push(fmt(rest));
    return parts.join(' ') + ' 원';
  }

  // 취득가액 입력 콤마 + 한글 표기
  els.price.addEventListener('input', function () {
    var d = digits(els.price.value);
    els.price.value = d ? fmt(d) : '';
    els.priceKorean.textContent = d ? toKorean(Number(d)) : '';
    save();
  });
  els.area.addEventListener('input', function () {
    els.area.value = els.area.value.replace(/[^0-9.]/g, '');
    save();
  });
  ['houseCount', 'isAdjustedArea', 'isTemporaryTwoHouse', 'isFirstHome', 'isPopDecreaseArea']
    .forEach(function (k) { els[k].addEventListener('change', save); });

  function readInput() {
    return {
      price: Number(digits(els.price.value)),
      area: Number(els.area.value),
      houseCount: Number(els.houseCount.value),
      isAdjustedArea: els.isAdjustedArea.checked,
      isTemporaryTwoHouse: els.isTemporaryTwoHouse.checked,
      isFirstHome: els.isFirstHome.checked,
      isPopDecreaseArea: els.isPopDecreaseArea.checked,
    };
  }

  var rateText = { none: '일반(1~3%)', h8: '8% 중과', h12: '12% 중과' };

  function calc() {
    var input = readInput();
    var r = window.AcqTax.calcAcquisitionTax(input);
    var card = $('resultCard');
    if (!r.ok) { alert(r.error); return; }

    $('totalAmount').textContent = fmt(r.total) + ' 원';
    $('rateOut').textContent = (r.rate * 100).toFixed(2).replace(/\.00$/, '') + '% (' + rateText[r.heavy] + ')';
    $('baseOut').textContent = fmt(r.acquisitionTaxBeforeReduction) + ' 원';
    $('reduceOut').textContent = r.reduction ? '− ' + fmt(r.reduction) + ' 원' : '0 원';
    $('acqOut').textContent = fmt(r.acquisitionTax) + ' 원';
    $('eduOut').textContent = fmt(r.localEduTax) + ' 원';
    $('ruralOut').textContent = fmt(r.ruralTax) + ' 원';
    $('grandOut').textContent = fmt(r.total) + ' 원';

    var ul = $('notesOut'); ul.innerHTML = '';
    r.notes.forEach(function (n) { var li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });

    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window._lastResult = r;
  }

  $('calcBtn').addEventListener('click', calc);

  $('resetBtn').addEventListener('click', function () {
    els.price.value = ''; els.area.value = ''; els.houseCount.value = '1';
    ['isAdjustedArea', 'isTemporaryTwoHouse', 'isFirstHome', 'isPopDecreaseArea']
      .forEach(function (k) { els[k].checked = false; });
    els.priceKorean.textContent = '';
    $('resultCard').hidden = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });

  $('copyBtn').addEventListener('click', function () {
    var r = window._lastResult; if (!r) return;
    var text = '[취득세 계산 결과]\n' +
      '적용세율: ' + (r.rate * 100).toFixed(2) + '%\n' +
      '취득세: ' + fmt(r.acquisitionTax) + '원\n' +
      '지방교육세: ' + fmt(r.localEduTax) + '원\n' +
      '농어촌특별세: ' + fmt(r.ruralTax) + '원\n' +
      '합계: ' + fmt(r.total) + '원\n(참고용 추정치 · 취득세계산기 2026)';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { alert('결과를 복사했습니다.'); });
    } else { alert(text); }
  });

  // localStorage 보존 (배포 코드 전용 — 실패해도 무시)
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readInput())); } catch (e) {}
  }
  function load() {
    try {
      var s = localStorage.getItem(STORAGE_KEY); if (!s) return;
      var v = JSON.parse(s);
      if (v.price) { els.price.value = fmt(v.price); els.priceKorean.textContent = toKorean(v.price); }
      if (v.area) els.area.value = v.area;
      if (v.houseCount) els.houseCount.value = v.houseCount;
      els.isAdjustedArea.checked = !!v.isAdjustedArea;
      els.isTemporaryTwoHouse.checked = !!v.isTemporaryTwoHouse;
      els.isFirstHome.checked = !!v.isFirstHome;
      els.isPopDecreaseArea.checked = !!v.isPopDecreaseArea;
    } catch (e) {}
  }
  load();
})();
