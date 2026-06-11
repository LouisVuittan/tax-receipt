/*
 * 주택분 재산세 계산 엔진 (순수 함수 — UI와 분리)
 * ------------------------------------------------------------------
 * 적용 범위(커버리지, v1):
 *   - 개인 소유 주택분 재산세 (공시가격 → 공정시장가액비율 → 과세표준 → 누진세율)
 *   - 1세대1주택 공정시장가액비율 특례(43~45%) + 특례세율(공시 9억 이하, -0.05%p)
 *   - 재산세 도시지역분(0.14%), 지방교육세(본세 20%), 7월/9월 분납
 * 미반영(화면에 명시):
 *   - 과세표준상한제(직전연도 과표 필요), 지역자원시설세(건물분 시가표준액 필요),
 *     감면·재산세 도시지역분 비과세 지역 판정(도시지역 여부는 사용자 입력), 별장·고급주택 중과 등
 * 단수처리: 세목별 10원 미만 절사(지방세 고지 관행).
 */
(function (global) {
  'use strict';

  var R = global.JAESAN_RULES_2026 || (typeof require !== 'undefined' ? require('./rules-jaesan-2026.js') : null);
  if (!R) throw new Error('JAESAN_RULES_2026 데이터가 로드되지 않았습니다.');

  function floor10(n) { return Math.floor(n / 10) * 10; }

  /** 공정시장가액비율: 1세대1주택이면 공시가격 구간별 43~45%, 그 외 60% */
  function fairRatio(price, oneHouse) {
    if (!oneHouse) return R.fairMarketRatio.default;
    var t = R.fairMarketRatio.oneHouse;
    for (var i = 0; i < t.length; i++) {
      if (price <= t[i].upTo) return t[i].ratio;
    }
    return t[t.length - 1].ratio;
  }

  /** 누진표에서 본세 계산: base + (과표 - over) × rate */
  function progressive(brackets, taxBase) {
    for (var i = 0; i < brackets.length; i++) {
      if (taxBase <= brackets[i].upTo) {
        var b = brackets[i];
        return b.base + (taxBase - b.over) * b.rate;
      }
    }
    var last = brackets[brackets.length - 1];
    return last.base + (taxBase - last.over) * last.rate;
  }

  /**
   * 메인 계산 함수
   * @param {object} input {
   *   price(주택공시가격), isOneHouse(1세대1주택), isUrban(도시지역분 부과 대상)
   * }
   */
  function calcJaesanTax(input) {
    var price = Number(input.price) || 0;
    var oneHouse = !!input.isOneHouse;
    var urban = !!input.isUrban;

    if (price <= 0) return { ok: false, error: '주택 공시가격을 0보다 큰 값으로 입력하세요.' };

    var notes = [];

    // 1) 과세표준 = 공시가격 × 공정시장가액비율
    var ratio = fairRatio(price, oneHouse);
    var taxBase = Math.floor(price * ratio);
    notes.push('공정시장가액비율 ' + (ratio * 100) + '% ' +
      (oneHouse ? '(1세대1주택 특례)' : '(다주택 등 일반 60%)') +
      ' → 과세표준 ' + taxBase.toLocaleString() + '원');

    // 2) 본세: 1세대1주택 + 공시 9억 이하면 특례세율, 아니면 표준세율
    var useSpecial = oneHouse && price <= R.specialRateLimit;
    var mainTax = floor10(progressive(useSpecial ? R.specialBrackets : R.standardBrackets, taxBase));
    if (useSpecial) {
      notes.push('1세대1주택 특례세율 적용 (공시가격 9억 이하, 구간별 -0.05%p)');
    } else if (oneHouse) {
      notes.push('공시가격 9억 초과 → 특례세율 미적용 (표준세율 0.1~0.4%)');
    } else {
      notes.push('표준세율 0.1~0.4% 누진 적용');
    }

    // 3) 도시지역분 (과세표준 × 0.14%)
    var urbanTax = urban ? floor10(taxBase * R.urbanRate) : 0;
    if (!urban) notes.push('도시지역 아님 → 재산세 도시지역분(0.14%) 미부과');

    // 4) 지방교육세 (본세 × 20%)
    var eduTax = floor10(mainTax * R.eduRate);

    var total = mainTax + urbanTax + eduTax;

    // 5) 분납 (7월/9월 절반씩, 본세 20만원 이하는 7월 일괄 가능)
    var half1 = floor10(total / 2);
    var half2 = total - half1;
    if (mainTax <= R.julyLumpSum) {
      notes.push('재산세(본세) 20만원 이하 → 7월에 전액 일괄 고지될 수 있음');
    }
    notes.push('과세기준일 6월 1일 소유자 기준 · 세부담 변동(과세표준상한제)은 미반영');

    return {
      ok: true,
      ratio: ratio,
      taxBase: taxBase,
      useSpecialRate: useSpecial,
      mainTax: mainTax,
      urbanTax: urbanTax,
      eduTax: eduTax,
      total: total,
      half1: half1,
      half2: half2,
      notes: notes,
    };
  }

  var Jaesan = {
    fairRatio: fairRatio,
    progressive: progressive,
    calcJaesanTax: calcJaesanTax,
  };

  if (typeof window !== 'undefined') window.Jaesan = Jaesan;
  if (typeof module !== 'undefined') module.exports = Jaesan;
})(typeof window !== 'undefined' ? window : global);
