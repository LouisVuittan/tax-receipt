/* 재산세 UI 연결 (엔진 jaesan-tax.js, 데이터 rules-jaesan-2026.js) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORAGE_KEY = 'jaesan_input_v1';

  var els = {
    price: $('price'),
    isOneHouse: $('isOneHouse'),
    isUrban: $('isUrban'),
    priceKorean: $('priceKorean'),
  };

  function digits(s) { return (s || '').replace(/[^0-9]/g, ''); }
  function fmt(n) { return Number(n).toLocaleString('ko-KR'); }

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

  els.price.addEventListener('input', function () {
    var d = digits(els.price.value);
    els.price.value = d ? fmt(d) : '';
    els.priceKorean.textContent = d ? toKorean(Number(d)) : '';
    save();
  });
  ['isOneHouse', 'isUrban'].forEach(function (k) { els[k].addEventListener('change', save); });

  function readInput() {
    return {
      price: Number(digits(els.price.value)),
      isOneHouse: els.isOneHouse.checked,
      isUrban: els.isUrban.checked,
    };
  }

  function calc() {
    var r = window.Jaesan.calcJaesanTax(readInput());
    var card = $('resultCard');
    if (!r.ok) { alert(r.error); return; }

    $('totalAmount').textContent = fmt(r.total) + ' 원';
    $('baseOut').textContent = fmt(r.taxBase) + ' 원 (' + (r.ratio * 100) + '%)';
    $('rateOut').textContent = r.useSpecialRate ? '1주택 특례세율 (0.05~0.35%)' : '표준세율 (0.1~0.4%)';
    $('mainOut').textContent = fmt(r.mainTax) + ' 원';
    $('urbanOut').textContent = fmt(r.urbanTax) + ' 원';
    $('eduOut').textContent = fmt(r.eduTax) + ' 원';
    $('grandOut').textContent = fmt(r.total) + ' 원';
    $('half1Out').textContent = fmt(r.half1) + ' 원';
    $('half2Out').textContent = fmt(r.half2) + ' 원';

    var ul = $('notesOut'); ul.innerHTML = '';
    r.notes.forEach(function (n) { var li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });

    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window._lastResult = r;
  }

  $('calcBtn').addEventListener('click', calc);

  $('resetBtn').addEventListener('click', function () {
    els.price.value = '';
    els.priceKorean.textContent = '';
    els.isOneHouse.checked = true;
    els.isUrban.checked = true;
    $('resultCard').hidden = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });

  $('copyBtn').addEventListener('click', function () {
    var r = window._lastResult; if (!r) return;
    var text = '[재산세 계산 결과]\n' +
      '과세표준: ' + fmt(r.taxBase) + '원 (공정시장가액비율 ' + (r.ratio * 100) + '%)\n' +
      '재산세(본세): ' + fmt(r.mainTax) + '원\n' +
      '도시지역분: ' + fmt(r.urbanTax) + '원\n' +
      '지방교육세: ' + fmt(r.eduTax) + '원\n' +
      '합계: ' + fmt(r.total) + '원 (7월 ' + fmt(r.half1) + ' + 9월 ' + fmt(r.half2) + ')\n' +
      '(참고용 추정치 · 재산세계산기 2026)';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { alert('결과를 복사했습니다.'); });
    } else { alert(text); }
  });

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readInput())); } catch (e) {}
  }
  function load() {
    try {
      var s = localStorage.getItem(STORAGE_KEY); if (!s) return;
      var v = JSON.parse(s);
      if (v.price) { els.price.value = fmt(v.price); els.priceKorean.textContent = toKorean(v.price); }
      els.isOneHouse.checked = !!v.isOneHouse;
      els.isUrban.checked = !!v.isUrban;
    } catch (e) {}
  }
  load();
})();
