/*
 * 주택분 종합부동산세(종부세) 계산 엔진 (순수 함수 — UI와 분리)
 * ------------------------------------------------------------------
 * 적용 범위(커버리지, v1):
 *   - 개인 보유 주택분 종부세 (공시가격 합계 → 기본공제 → 공정시장가액비율 60% → 과세표준 → 세율)
 *   - 1세대1주택 12억 공제 / 그 외 9억 공제, 2주택 이하 일반세율·3주택 이상 중과세율
 *   - 재산세 중복분 공제(이중과세 조정, 시행령 제5조의3 공식)
 *   - 1세대1주택 고령자·장기보유 세액공제(합산 80% 한도)
 *   - 농어촌특별세(종부세액 20%)
 * 미반영(화면에 명시):
 *   - 세부담상한(150%, 직전연도 총세액 필요), 합산배제(임대·사원용주택 등),
 *     부부공동명의 특례, 법인(공제 없음·단일세율), 다주택 재산세 공제의 주택별 정밀 배분.
 * 단수처리: 세목별 10원 미만 절사(국세 고지 관행).
 */
(function (global) {
  'use strict';

  var R = global.JONGBU_RULES_2026 || (typeof require !== 'undefined' ? require('./rules-jongbu-2026.js') : null);
  if (!R) throw new Error('JONGBU_RULES_2026 데이터가 로드되지 않았습니다.');

  function floor10(n) { return Math.floor(n / 10) * 10; }

  /** 종부세 세율표: 과표 × rate - deduct */
  function bracketTax(brackets, base) {
    for (var i = 0; i < brackets.length; i++) {
      if (base <= brackets[i].upTo) {
        return base * brackets[i].rate - brackets[i].deduct;
      }
    }
    var last = brackets[brackets.length - 1];
    return base * last.rate - last.deduct;
  }

  /** 재산세 표준세율 누진표: base + (과표-over)×rate */
  function propertyTax(base) {
    var t = R.propertyTaxBrackets;
    for (var i = 0; i < t.length; i++) {
      if (base <= t[i].upTo) return t[i].base + (base - t[i].over) * t[i].rate;
    }
    var last = t[t.length - 1];
    return last.base + (base - last.over) * last.rate;
  }

  /** 연령·보유기간으로 세액공제율 조회 (해당 표에서 가장 높은 충족 구간) */
  function lookupRate(table, value, key) {
    for (var i = 0; i < table.length; i++) {
      if (value >= table[i][key]) return table[i].rate;
    }
    return 0;
  }

  /**
   * 메인 계산 함수
   * @param {object} input {
   *   price(공시가격 합계, 원), houseCount(주택 수: 1|2|3 — 3은 3주택 이상),
   *   isOneHouse(1세대 1주택 여부), age(나이, 1주택 세액공제용), holdYears(보유연수)
   * }
   */
  function calcJongbuTax(input) {
    var price = Number(input.price) || 0;
    var count = Number(input.houseCount) || 1;
    var oneHouse = !!input.isOneHouse;
    var age = Number(input.age) || 0;
    var holdYears = Number(input.holdYears) || 0;

    if (price <= 0) return { ok: false, error: '공시가격 합계를 0보다 큰 값으로 입력하세요.' };

    var notes = [];

    // 1) 기본공제 (1세대1주택 12억 / 그 외 9억)
    var deduction = oneHouse ? R.basicDeduction.oneHouse : R.basicDeduction.other;
    var excess = price - deduction;

    if (excess <= 0) {
      notes.push('공시가격 합계가 기본공제(' + (deduction / 100000000) + '억) 이하 → 종합부동산세 대상 아님(0원).');
      return {
        ok: true, taxable: 0, deduction: deduction, beforeCredit: 0,
        propertyTaxCredit: 0, afterPropertyTax: 0, elderlyRate: 0, longHoldRate: 0,
        creditRate: 0, creditAmount: 0, jongbuTax: 0, ruralTax: 0, total: 0, notes: notes,
      };
    }

    // 2) 과세표준 = 초과분 × 공정시장가액비율
    var taxable = Math.floor(excess * R.fairMarketRatio);
    notes.push('과세표준 = (공시 ' + (price / 100000000) + '억 − 공제 ' + (deduction / 100000000) +
      '억) × 공정시장가액비율 ' + (R.fairMarketRatio * 100) + '% = ' + taxable.toLocaleString() + '원');

    // 3) 종부세 산출세액 (3주택 이상이면 중과세율)
    var heavy = count >= 3;
    var brackets = heavy ? R.heavyBrackets : R.generalBrackets;
    var beforeCredit = Math.max(0, bracketTax(brackets, taxable));
    notes.push(heavy ? '3주택 이상 → 중과세율(0.5~5.0%) 적용' : '2주택 이하 → 일반세율(0.5~2.7%) 적용');

    // 4) 재산세 중복분 공제 (이중과세 조정)
    //    분자 = 종부세 과세표준 × 재산세 공정시장가액비율 × 재산세 표준 최고세율(0.4%)
    //    분모 = (공시 합계 × 재산세 공정시장가액비율)에 재산세 표준세율 누진 적용
    //    공제 = 부과세액합계 × (분자/분모) — 1주택은 부과세액합계=분모라 공제=분자
    var numer = taxable * R.propertyTaxFairRatio * R.propertyTaxTopRate;
    var denom = propertyTax(price * R.propertyTaxFairRatio);
    // 부과세액합계/분모 ≈ 1(1주택 기준) → 공제 = 분자(numer). 분모는 0 분모 방지·참고용.
    var propertyCredit = denom > 0 ? floor10(numer) : 0;
    if (propertyCredit > beforeCredit) propertyCredit = beforeCredit;
    var afterPropertyTax = Math.max(0, beforeCredit - propertyCredit);
    notes.push('재산세 중복분 공제 ' + propertyCredit.toLocaleString() + '원 차감(이중과세 조정).' +
      (count >= 2 ? ' ※ 다주택은 주택별 공시가 구성에 따라 실제와 차이날 수 있음.' : ''));

    // 5) 1세대1주택 세액공제 (고령자 + 장기보유, 합산 80% 한도)
    var elderlyRate = 0, longHoldRate = 0, creditRate = 0, creditAmount = 0;
    if (oneHouse) {
      elderlyRate = lookupRate(R.elderlyCredit, age, 'minAge');
      longHoldRate = lookupRate(R.longHoldCredit, holdYears, 'minYears');
      creditRate = Math.min(R.creditCap, elderlyRate + longHoldRate);
      creditAmount = floor10(afterPropertyTax * creditRate);
      if (creditRate > 0) {
        notes.push('1세대1주택 세액공제 ' + Math.round(creditRate * 100) + '% (고령자 ' +
          Math.round(elderlyRate * 100) + '% + 장기보유 ' + Math.round(longHoldRate * 100) +
          '%, 한도 80%) → ' + creditAmount.toLocaleString() + '원 공제');
      }
    } else {
      notes.push('고령자·장기보유 세액공제는 1세대1주택자만 적용됩니다.');
    }

    // 6) 종부세 납부세액 + 농어촌특별세
    var jongbuTax = floor10(Math.max(0, afterPropertyTax - creditAmount));
    var ruralTax = floor10(jongbuTax * R.ruralTaxRate);
    var total = jongbuTax + ruralTax;

    notes.push('농어촌특별세 = 종부세액 × ' + (R.ruralTaxRate * 100) + '% = ' + ruralTax.toLocaleString() + '원');
    notes.push('과세기준일 6/1 · 납기 12월 · 세부담상한(150%)·합산배제는 미반영');

    return {
      ok: true,
      deduction: deduction,
      taxable: taxable,
      heavy: heavy,
      beforeCredit: floor10(beforeCredit),
      propertyTaxCredit: propertyCredit,
      afterPropertyTax: floor10(afterPropertyTax),
      elderlyRate: elderlyRate,
      longHoldRate: longHoldRate,
      creditRate: creditRate,
      creditAmount: creditAmount,
      jongbuTax: jongbuTax,
      ruralTax: ruralTax,
      total: total,
      notes: notes,
    };
  }

  var Jongbu = {
    bracketTax: bracketTax,
    propertyTax: propertyTax,
    calcJongbuTax: calcJongbuTax,
  };

  if (typeof window !== 'undefined') window.Jongbu = Jongbu;
  if (typeof module !== 'undefined') module.exports = Jongbu;
})(typeof window !== 'undefined' ? window : global);
