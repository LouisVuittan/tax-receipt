/* 증여세 UI 연결 (엔진 jeungyeo-tax.js, 데이터 rules-jeungyeo-2026.js) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORAGE_KEY = 'jeungyeo_input_v1';

  var els = {
    amount: $('amount'),
    amountKorean: $('amountKorean'),
    relation: $('relation'),
    prior: $('prior'),
    priorKorean: $('priorKorean'),
    useMarriageBirth: $('useMarriageBirth'),
    isSkip: $('isSkip'),
    onTimeReport: $('onTimeReport'),
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

  function bindMoney(input, koreanEl) {
    input.addEventListener('input', function () {
      var d = digits(input.value);
      input.value = d ? fmt(d) : '';
      koreanEl.textContent = d ? toKorean(Number(d)) : '';
      save();
    });
  }
  bindMoney(els.amount, els.amountKorean);
  bindMoney(els.prior, els.priorKorean);

  /* 관계에 따라 의미 없는 옵션 비활성화 */
  function syncOptions() {
    var rel = els.relation.value;
    var directDown = rel === 'adult' || rel === 'minor';
    els.useMarriageBirth.disabled = rel !== 'adult';
    if (rel !== 'adult') els.useMarriageBirth.checked = false;
    els.isSkip.disabled = !directDown;
    if (!directDown) els.isSkip.checked = false;
  }
  els.relation.addEventListener('change', function () { syncOptions(); save(); });
  ['useMarriageBirth', 'isSkip', 'onTimeReport'].forEach(function (k) {
    els[k].addEventListener('change', save);
  });

  function readInput() {
    return {
      amount: Number(digits(els.amount.value)),
      relation: els.relation.value,
      prior: Number(digits(els.prior.value)),
      useMarriageBirth: els.useMarriageBirth.checked,
      isSkip: els.isSkip.checked,
      onTimeReport: els.onTimeReport.checked,
    };
  }

  function calc() {
    var r = window.Jeungyeo.calcJeungyeoTax(readInput());
    var card = $('resultCard');
    if (!r.ok) { alert(r.error); return; }

    $('totalAmount').textContent = fmt(r.finalTax) + ' 원';
    $('totalValueOut').textContent = fmt(r.totalValue) + ' 원';
    $('deductionOut').textContent = '− ' + fmt(r.deduction) + ' 원';
    $('baseOut').textContent = fmt(r.taxBase) + ' 원';
    $('calcOut').textContent = fmt(r.calcTax) + ' 원';
    $('surchargeOut').textContent = r.surcharge ? '+ ' + fmt(r.surcharge) + ' 원' : '0 원';
    $('priorCreditOut').textContent = r.priorCredit ? '− ' + fmt(r.priorCredit) + ' 원' : '0 원';
    $('reportCreditOut').textContent = r.reportCredit ? '− ' + fmt(r.reportCredit) + ' 원' : '0 원';
    $('grandOut').textContent = fmt(r.finalTax) + ' 원';

    var ul = $('notesOut'); ul.innerHTML = '';
    r.notes.forEach(function (n) { var li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });

    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window._lastResult = r;
  }

  $('calcBtn').addEventListener('click', calc);

  $('resetBtn').addEventListener('click', function () {
    els.amount.value = '';
    els.amountKorean.textContent = '';
    els.prior.value = '';
    els.priorKorean.textContent = '';
    els.relation.value = 'adult';
    els.useMarriageBirth.checked = false;
    els.isSkip.checked = false;
    els.onTimeReport.checked = true;
    syncOptions();
    $('resultCard').hidden = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });

  $('copyBtn').addEventListener('click', function () {
    var r = window._lastResult; if (!r) return;
    var text = '[증여세 계산 결과]\n' +
      '증여재산(합산): ' + fmt(r.totalValue) + '원\n' +
      '증여재산공제: ' + fmt(r.deduction) + '원\n' +
      '과세표준: ' + fmt(r.taxBase) + '원\n' +
      '산출세액: ' + fmt(r.calcTax) + '원' +
      (r.surcharge ? ' (+세대생략 할증 ' + fmt(r.surcharge) + '원)' : '') + '\n' +
      '납부세액: ' + fmt(r.finalTax) + '원\n' +
      '(참고용 추정치 · 증여세계산기 2026)';
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
      if (v.amount) { els.amount.value = fmt(v.amount); els.amountKorean.textContent = toKorean(v.amount); }
      if (v.prior) { els.prior.value = fmt(v.prior); els.priorKorean.textContent = toKorean(v.prior); }
      if (v.relation) els.relation.value = v.relation;
      els.useMarriageBirth.checked = !!v.useMarriageBirth;
      els.isSkip.checked = !!v.isSkip;
      els.onTimeReport.checked = v.onTimeReport !== false;
    } catch (e) {}
  }
  load();
  syncOptions();
})();
