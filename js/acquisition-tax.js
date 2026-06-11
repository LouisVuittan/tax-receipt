/*
 * 취득세 계산 엔진 (순수 함수 — UI와 분리)
 * ------------------------------------------------------------------
 * 입력만으로 결과가 결정되는 순수 함수 모음.
 * 화면(app.js)과 테스트(tests.html) 양쪽에서 동일하게 재사용한다.
 *
 * 적용 범위(커버리지):
 *   - 개인의 주택 유상취득(매매)
 *   - 1주택/다주택 중과, 조정/비조정, 일시적 2주택(중과 제외)
 *   - 지방교육세, 농어촌특별세(85㎡ 기준), 생애최초 감면
 * 미반영(주의 — 화면에 명시):
 *   - 법인 취득, 상속·증여, 분양권/입주권, 오피스텔, 농어촌주택 특례
 *   - 다주택 일시적 처분특례 외 개별 예외, 지방 읍·면 100㎡ 기준 등
 */
(function (global) {
  'use strict';

  var R = global.TAX_RULES_2026 || (typeof require !== 'undefined' ? require('./rules-2026.js') : null);
  if (!R) throw new Error('TAX_RULES_2026 데이터가 로드되지 않았습니다.');

  // 원 단위 반올림
  function won(n) { return Math.round(n); }

  /**
   * 주택 표준세율(1~3%) 계산
   * @param {number} price 취득가액(원)
   * @returns {number} 세율(소수, 예: 0.01)
   */
  function standardRate(price) {
    var h = R.housing;
    if (price <= h.threshold1) return h.rateUnder6;            // 6억 이하 1%
    if (price >= h.threshold2) return h.rateOver9;             // 9억 이상 3%
    // 6억~9억 누진비례: 세율(%) = price × 2 ÷ 3억 − 3
    // 위택스 기준: 세율을 "분수(소수)로 소수점 넷째자리까지" 반올림 (= 백분율 둘째자리).
    //   예) 7억 → 1.66667% = 0.0166667 → 0.0167 (1.67%). [2026-06-09 위택스 대조 확인]
    var pct = (price * 2 / 300000000) - 3; // 퍼센트 값 (예: 1.66667)
    var rate = pct / 100;                  // 분수 (예: 0.0166667)
    return Math.round(rate * 10000) / 10000;
  }

  /**
   * 적용 취득세율 + 중과 여부 판정
   * @param {object} input { price, houseCount, isAdjustedArea, isTemporaryTwoHouse }
   *   houseCount: 취득 후 보유하게 되는 총 주택 수 (1,2,3,4+)
   * @returns {{rate:number, heavy:('none'|'h8'|'h12'), reason:string}}
   */
  function resolveRate(input) {
    var price = input.price;
    var count = input.houseCount;
    var adjusted = !!input.isAdjustedArea;
    var temp = !!input.isTemporaryTwoHouse;

    // 생애최초 감면 대상 → 중과세율(제13조의2) 미적용 (지특법 제36조의3 ①).
    // 생애최초=무주택자이므로 취득 후 1주택이라 원칙적으로 중과 무관하나, 입력 오조작 대비 가드.
    if (input.isFirstHome) {
      return { rate: standardRate(price), heavy: 'none', reason: '생애최초(무주택) → 표준세율(1~3%), 중과 미적용' };
    }

    // 일시적 2주택 → 일반 표준세율
    if (temp) {
      return { rate: standardRate(price), heavy: 'none', reason: '일시적 2주택 → 일반 표준세율 적용' };
    }

    if (count <= 1) {
      return { rate: standardRate(price), heavy: 'none', reason: '1주택 → 표준세율(1~3%)' };
    }

    if (count === 2) {
      if (adjusted) return { rate: R.heavyTax.adjusted.twoHouse, heavy: 'h8', reason: '조정대상지역 2주택 → 8% 중과' };
      return { rate: standardRate(price), heavy: 'none', reason: '비조정 2주택 → 표준세율(1~3%)' };
    }

    if (count === 3) {
      if (adjusted) return { rate: R.heavyTax.adjusted.threePlus, heavy: 'h12', reason: '조정대상지역 3주택 → 12% 중과' };
      return { rate: R.heavyTax.nonAdjusted.threeHouse, heavy: 'h8', reason: '비조정 3주택 → 8% 중과' };
    }

    // 4주택 이상
    if (adjusted) return { rate: R.heavyTax.adjusted.threePlus, heavy: 'h12', reason: '조정대상지역 4주택 이상 → 12% 중과' };
    return { rate: R.heavyTax.nonAdjusted.fourPlus, heavy: 'h12', reason: '비조정 4주택 이상 → 12% 중과' };
  }

  /** 지방교육세 계산 */
  function localEduTax(price, rate, heavy) {
    if (heavy === 'none') return won(price * rate * R.localEduTax.generalMultiplier);
    return won(price * R.localEduTax.heavyRate); // 중과 시 0.4% 고정
  }

  /** 농어촌특별세 계산 (85㎡ 이하 비과세) */
  function ruralTax(price, area, heavy) {
    if (!area || area <= R.ruralTax.areaExemptThreshold) return 0;
    if (heavy === 'h8') return won(price * R.ruralTax.heavy8);
    if (heavy === 'h12') return won(price * R.ruralTax.heavy12);
    return won(price * R.ruralTax.general);
  }

  /** 생애최초 감면액 계산 (취득세 본세에만 적용 — 단순화) */
  function firstHomeReduction(price, baseTax, input) {
    if (!input.isFirstHome) return { amount: 0, reason: '' };
    if (price > R.firstHome.priceCap) {
      return { amount: 0, reason: '생애최초 감면 미적용 (실거래가 12억 초과)' };
    }
    var limit = input.isPopDecreaseArea ? R.firstHome.limitPopDecreaseArea : R.firstHome.limitDefault;
    var amount = Math.min(baseTax, limit);
    var reason = (baseTax <= limit)
      ? '생애최초 감면 → 산출세액이 한도(' + won(limit).toLocaleString() + '원) 이하라 전액 면제'
      : '생애최초 감면 → 한도 ' + won(limit).toLocaleString() + '원 감면';
    return { amount: won(amount), reason: reason };
  }

  /**
   * 메인 계산 함수
   * @param {object} input {
   *   price, area, houseCount, isAdjustedArea,
   *   isTemporaryTwoHouse, isFirstHome, isPopDecreaseArea
   * }
   */
  function calcAcquisitionTax(input) {
    var price = Number(input.price) || 0;
    if (price <= 0) {
      return { ok: false, error: '취득가액을 0보다 큰 값으로 입력하세요.' };
    }
    var area = Number(input.area) || 0;

    var rr = resolveRate({
      price: price,
      houseCount: Number(input.houseCount) || 1,
      isAdjustedArea: input.isAdjustedArea,
      isTemporaryTwoHouse: input.isTemporaryTwoHouse,
      isFirstHome: input.isFirstHome,
    });

    var baseTax = won(price * rr.rate);                 // 취득세 본세(감면 전)
    var reduction = firstHomeReduction(price, baseTax, input);
    var acqTax = baseTax - reduction.amount;            // 취득세 본세(감면 후)
    var edu = localEduTax(price, rr.rate, rr.heavy);    // 지방교육세
    var rural = ruralTax(price, area, rr.heavy);        // 농어촌특별세
    var total = acqTax + edu + rural;

    var notes = [rr.reason];
    if (reduction.reason) notes.push(reduction.reason);
    if (area && area <= R.ruralTax.areaExemptThreshold) notes.push('전용 85㎡ 이하 → 농어촌특별세 비과세');
    // 소형주택(전용60㎡↓·3억[수도권6억]↓·아파트 제외)은 인구감소지역이 아니어도 300만 한도 대상이나
    // 본 계산기 미반영 → 200만 적용 시 안내만 노출 (지특법 제36조의3 ①1호 가·나·다목)
    if (input.isFirstHome && !input.isPopDecreaseArea && price <= R.firstHome.priceCap) {
      notes.push('참고: 전용 60㎡ 이하·3억(수도권 6억) 이하 비아파트(도시형생활주택·다가구 등)는 300만원 한도 대상일 수 있습니다 → 위택스·관할청 확인.');
    }

    return {
      ok: true,
      rate: rr.rate,
      heavy: rr.heavy,
      acquisitionTaxBeforeReduction: baseTax,
      reduction: reduction.amount,
      acquisitionTax: acqTax,
      localEduTax: edu,
      ruralTax: rural,
      total: total,
      notes: notes,
    };
  }

  var AcqTax = {
    standardRate: standardRate,
    resolveRate: resolveRate,
    calcAcquisitionTax: calcAcquisitionTax,
  };

  if (typeof window !== 'undefined') window.AcqTax = AcqTax;
  if (typeof module !== 'undefined') module.exports = AcqTax;
})(typeof window !== 'undefined' ? window : global);
