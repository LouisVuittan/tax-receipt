/* 종합부동산세 UI 연결 (엔진 jongbu-tax.js, 데이터 rules-jongbu-2026.js) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORAGE_KEY = 'jongbu_input_v1';

  var els = {
    price: $('price'),
    priceKorean: $('priceKorean'),
    houseCount: $('houseCount'),
    isOneHouse: $('isOneHouse'),
    age: $('age'),
    holdYears: $('holdYears'),
    creditBox: $('creditBox'),
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

  function houseCount() {
    return Number(els.houseCount.value) || 1;
  }

  /** 1주택일 때만 1세대1주택 체크·세액공제 입력 활성화 */
  function syncOneHouseState() {
    var isOne = houseCount() === 1;
    els.isOneHouse.disabled = !isOne;
    if (!isOne) els.isOneHouse.checked = false;
    var creditActive = isOne && els.isOneHouse.checked;
    els.creditBox.style.display = creditActive ? '' : 'none';
  }

  els.price.addEventListener('input', function () {
    var d = digits(els.price.value);
    els.price.value = d ? fmt(d) : '';
    els.priceKorean.textContent = d ? toKorean(Number(d)) : '';
    save();
  });
  els.houseCount.addEventListener('change', function () { syncOneHouseState(); save(); });
  els.isOneHouse.addEventListener('change', function () { syncOneHouseState(); save(); });
  [els.age, els.holdYears].forEach(function (el) {
    el.addEventListener('input', function () { el.value = digits(el.value); save(); });
  });

  function readInput() {
    var count = houseCount();
    var isOne = count === 1 && els.isOneHouse.checked;
    return {
      price: Number(digits(els.price.value)),
      houseCount: count,
      isOneHouse: isOne,
      age: isOne ? Number(els.age.value || 0) : 0,
      holdYears: isOne ? Number(els.holdYears.value || 0) : 0,
    };
  }

  function calc() {
    var r = window.Jongbu.calcJongbuTax(readInput());
    var card = $('resultCard');
    if (!r.ok) { alert(r.error); return; }

    $('totalAmount').textContent = fmt(r.total) + ' 원';
    $('taxableOut').textContent = fmt(r.taxable) + ' 원';
    $('beforeOut').textContent = fmt(r.beforeCredit) + ' 원';
    $('propOut').textContent = '− ' + fmt(r.propertyTaxCredit) + ' 원';
    $('afterPropOut').textContent = fmt(r.afterPropertyTax) + ' 원';
    $('creditOut').textContent = (r.creditRate ? '(' + Math.round(r.creditRate * 100) + '%) ' : '') + '− ' + fmt(r.creditAmount) + ' 원';
    $('jongbuOut').textContent = fmt(r.jongbuTax) + ' 원';
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
    els.price.value = '';
    els.priceKorean.textContent = '';
    els.houseCount.value = '1';
    els.isOneHouse.checked = true;
    els.age.value = '';
    els.holdYears.value = '';
    syncOneHouseState();
    $('resultCard').hidden = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });

  $('copyBtn').addEventListener('click', function () {
    var r = window._lastResult; if (!r) return;
    var text = '[종합부동산세 계산 결과]\n' +
      '과세표준: ' + fmt(r.taxable) + '원\n' +
      '산출세액: ' + fmt(r.beforeCredit) + '원\n' +
      '재산세 공제: −' + fmt(r.propertyTaxCredit) + '원\n' +
      (r.creditAmount ? '세액공제(' + Math.round(r.creditRate * 100) + '%): −' + fmt(r.creditAmount) + '원\n' : '') +
      '종합부동산세: ' + fmt(r.jongbuTax) + '원\n' +
      '농어촌특별세: ' + fmt(r.ruralTax) + '원\n' +
      '합계: ' + fmt(r.total) + '원\n' +
      '(참고용 추정치 · 종합부동산세계산기 2026)';
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
      els.houseCount.value = String(v.houseCount || 1);
      els.isOneHouse.checked = !!v.isOneHouse;
      if (v.age) els.age.value = v.age;
      if (v.holdYears) els.holdYears.value = v.holdYears;
    } catch (e) {}
    syncOneHouseState();
  }
  load();
})();
