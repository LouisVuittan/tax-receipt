/* 양도소득세 UI 연결 (엔진 yangdo-tax.js, 데이터 rules-yangdo-2026.js) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORAGE_KEY = 'yangdo_input_v1';

  var els = {
    salePrice: $('salePrice'), buyPrice: $('buyPrice'), expenses: $('expenses'),
    holdYears: $('holdYears'), liveYears: $('liveYears'), houseCount: $('houseCount'),
    isOneHouseExempt: $('isOneHouseExempt'), isAdjustedArea: $('isAdjustedArea'),
    saleKorean: $('saleKorean'), buyKorean: $('buyKorean'),
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

  // 금액 입력: 콤마 + 한글 표기
  function bindMoney(input, koreanEl) {
    input.addEventListener('input', function () {
      var d = digits(input.value);
      input.value = d ? fmt(d) : '';
      if (koreanEl) koreanEl.textContent = d ? toKorean(Number(d)) : '';
      save();
    });
  }
  bindMoney(els.salePrice, els.saleKorean);
  bindMoney(els.buyPrice, els.buyKorean);
  bindMoney(els.expenses, null);

  // 기간 입력: 숫자·소수점만
  ['holdYears', 'liveYears'].forEach(function (k) {
    els[k].addEventListener('input', function () {
      els[k].value = els[k].value.replace(/[^0-9.]/g, '');
      save();
    });
  });
  ['houseCount', 'isOneHouseExempt', 'isAdjustedArea']
    .forEach(function (k) { els[k].addEventListener('change', save); });

  function readInput() {
    return {
      salePrice: Number(digits(els.salePrice.value)),
      buyPrice: Number(digits(els.buyPrice.value)),
      expenses: Number(digits(els.expenses.value)),
      holdYears: Number(els.holdYears.value),
      liveYears: Number(els.liveYears.value),
      houseCount: Number(els.houseCount.value),
      isOneHouseExempt: els.isOneHouseExempt.checked,
      isAdjustedArea: els.isAdjustedArea.checked,
    };
  }

  function calc() {
    var r = window.Yangdo.calcYangdoTax(readInput());
    var card = $('resultCard');
    if (!r.ok) { alert(r.error); return; }

    $('totalAmount').textContent = fmt(r.total) + ' 원';
    $('gainOut').textContent = fmt(r.gain) + ' 원';
    $('taxableOut').textContent = fmt(r.taxableGain) + ' 원';
    $('ltsdOut').textContent = r.ltsd ? '− ' + fmt(r.ltsd) + ' 원 (' + (r.ltsdRate * 100).toFixed(0) + '%)' : '0 원';
    $('incomeOut').textContent = fmt(r.incomeAmount) + ' 원';
    $('baseOut').textContent = fmt(r.taxBase) + ' 원';
    $('rateOut').textContent = r.exempt ? '비과세' : (r.appliedRate * 100).toFixed(0) + '%';
    $('taxOut').textContent = fmt(r.calculatedTax) + ' 원';
    $('localOut').textContent = fmt(r.localTax) + ' 원';
    $('grandOut').textContent = fmt(r.total) + ' 원';

    var ul = $('notesOut'); ul.innerHTML = '';
    r.notes.forEach(function (n) { var li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });

    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window._lastResult = r;
  }

  $('calcBtn').addEventListener('click', calc);

  $('resetBtn').addEventListener('click', function () {
    ['salePrice', 'buyPrice', 'expenses', 'holdYears', 'liveYears'].forEach(function (k) { els[k].value = ''; });
    els.houseCount.value = '1';
    els.isOneHouseExempt.checked = false;
    els.isAdjustedArea.checked = false;
    els.saleKorean.textContent = ''; els.buyKorean.textContent = '';
    $('resultCard').hidden = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });

  $('copyBtn').addEventListener('click', function () {
    var r = window._lastResult; if (!r) return;
    var text = '[양도소득세 계산 결과]\n' +
      '양도차익: ' + fmt(r.gain) + '원\n' +
      '장기보유특별공제: ' + fmt(r.ltsd) + '원\n' +
      '과세표준: ' + fmt(r.taxBase) + '원\n' +
      '양도소득세: ' + fmt(r.calculatedTax) + '원\n' +
      '지방소득세: ' + fmt(r.localTax) + '원\n' +
      '합계: ' + fmt(r.total) + '원\n(참고용 추정치 · 양도소득세계산기 2026)';
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
      if (v.salePrice) { els.salePrice.value = fmt(v.salePrice); els.saleKorean.textContent = toKorean(v.salePrice); }
      if (v.buyPrice) { els.buyPrice.value = fmt(v.buyPrice); els.buyKorean.textContent = toKorean(v.buyPrice); }
      if (v.expenses) els.expenses.value = fmt(v.expenses);
      if (v.holdYears) els.holdYears.value = v.holdYears;
      if (v.liveYears) els.liveYears.value = v.liveYears;
      if (v.houseCount) els.houseCount.value = v.houseCount;
      els.isOneHouseExempt.checked = !!v.isOneHouseExempt;
      els.isAdjustedArea.checked = !!v.isAdjustedArea;
    } catch (e) {}
  }
  load();
})();
