/* 상속세 UI 연결 (엔진 sangsok-tax.js, 데이터 rules-sangsok-2026.js) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORAGE_KEY = 'sangsok_input_v1';

  var els = {
    estate: $('estate'),
    estateKorean: $('estateKorean'),
    debt: $('debt'),
    debtKorean: $('debtKorean'),
    funeral: $('funeral'),
    funeralKorean: $('funeralKorean'),
    financial: $('financial'),
    financialKorean: $('financialKorean'),
    hasSpouse: $('hasSpouse'),
    spouseAmount: $('spouseAmount'),
    spouseAmountKorean: $('spouseAmountKorean'),
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
  bindMoney(els.estate, els.estateKorean);
  bindMoney(els.debt, els.debtKorean);
  bindMoney(els.funeral, els.funeralKorean);
  bindMoney(els.financial, els.financialKorean);
  bindMoney(els.spouseAmount, els.spouseAmountKorean);

  /* 배우자 없으면 실제 상속액 입력 비활성화 */
  function syncOptions() {
    var on = els.hasSpouse.checked;
    els.spouseAmount.disabled = !on;
    if (!on) { els.spouseAmount.value = ''; els.spouseAmountKorean.textContent = ''; }
  }
  els.hasSpouse.addEventListener('change', function () { syncOptions(); save(); });
  els.onTimeReport.addEventListener('change', save);

  function readInput() {
    return {
      estate: Number(digits(els.estate.value)),
      debt: Number(digits(els.debt.value)),
      funeral: Number(digits(els.funeral.value)),
      financial: Number(digits(els.financial.value)),
      hasSpouse: els.hasSpouse.checked,
      spouseAmount: Number(digits(els.spouseAmount.value)),
      onTimeReport: els.onTimeReport.checked,
    };
  }

  function calc() {
    var r = window.Sangsok.calcSangsokTax(readInput());
    var card = $('resultCard');
    if (!r.ok) { alert(r.error); return; }

    $('totalAmount').textContent = fmt(r.finalTax) + ' 원';
    $('grossOut').textContent = fmt(r.grossValue) + ' 원';
    $('lumpOut').textContent = '− ' + fmt(r.lumpDeduction) + ' 원';
    $('spouseOut').textContent = r.spouseDeduction ? '− ' + fmt(r.spouseDeduction) + ' 원' : '0 원';
    $('finOut').textContent = r.finDeduction ? '− ' + fmt(r.finDeduction) + ' 원' : '0 원';
    $('baseOut').textContent = fmt(r.taxBase) + ' 원';
    $('calcOut').textContent = fmt(r.calcTax) + ' 원';
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
    ['estate', 'debt', 'funeral', 'financial', 'spouseAmount'].forEach(function (k) {
      els[k].value = '';
      els[k + 'Korean'].textContent = '';
    });
    els.hasSpouse.checked = true;
    els.onTimeReport.checked = true;
    syncOptions();
    $('resultCard').hidden = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });

  $('copyBtn').addEventListener('click', function () {
    var r = window._lastResult; if (!r) return;
    var text = '[상속세 계산 결과]\n' +
      '상속세 과세가액: ' + fmt(r.grossValue) + '원\n' +
      '공제 합계: ' + fmt(r.totalDeduction) + '원 (일괄 ' + fmt(r.lumpDeduction) +
      (r.spouseDeduction ? ' + 배우자 ' + fmt(r.spouseDeduction) : '') +
      (r.finDeduction ? ' + 금융 ' + fmt(r.finDeduction) : '') + ')\n' +
      '과세표준: ' + fmt(r.taxBase) + '원\n' +
      '납부세액: ' + fmt(r.finalTax) + '원\n' +
      '(참고용 추정치 · 상속세계산기 2026)';
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
      [['estate', v.estate], ['debt', v.debt], ['funeral', v.funeral],
       ['financial', v.financial], ['spouseAmount', v.spouseAmount]].forEach(function (p) {
        if (p[1]) { els[p[0]].value = fmt(p[1]); els[p[0] + 'Korean'].textContent = toKorean(p[1]); }
      });
      els.hasSpouse.checked = v.hasSpouse !== false;
      els.onTimeReport.checked = v.onTimeReport !== false;
    } catch (e) {}
  }
  load();
  syncOptions();
})();
