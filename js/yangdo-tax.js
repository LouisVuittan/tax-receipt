/*
 * 양도소득세(주택) 계산 엔진 (순수 함수 — UI와 분리)
 * ------------------------------------------------------------------
 * 적용 범위(커버리지, v1):
 *   - 개인의 주택 양도(1세대1주택 비과세·고가주택 안분 / 다주택 / 단기보유)
 *   - 장기보유특별공제 표1(일반)·표2(1세대1주택)
 *   - 다주택 중과(조정지역 2주택+20%p, 3주택+30%p, 장특공제 배제)
 *   - 양도소득 기본공제 250만, 기본세율 6~45% 누진, 지방소득세 10%
 * 미반영(화면에 명시):
 *   - 분양권·입주권 단기세율 차이, 비교과세(단기 vs 중과 큰 세액), 다주택 중과 경과조치(5/9 이전 계약),
 *     1세대1주택 비과세 세부요건 판정(거주·보유 충족은 사용자 입력으로 가정), 감면·이월과세 등
 */
(function (global) {
  'use strict';

  var R = global.YANGDO_RULES_2026 || (typeof require !== 'undefined' ? require('./rules-yangdo-2026.js') : null);
  if (!R) throw new Error('YANGDO_RULES_2026 데이터가 로드되지 않았습니다.');

  function won(n) { return Math.round(n); }
  function clamp0(n) { return n < 0 ? 0 : n; }

  /** 기본세율 누진: 과세표준 → {rate, deduct} */
  function bracket(base) {
    var b = R.baseBrackets;
    for (var i = 0; i < b.length; i++) {
      if (base <= b[i].upTo) return b[i];
    }
    return b[b.length - 1];
  }

  /** 장기보유특별공제 표1(일반) 공제율 */
  function ltsdGeneral(holdYears) {
    var g = R.ltsd.general;
    var y = Math.floor(holdYears);
    if (y < g.startYear) return 0;
    return Math.min(g.max, Math.min(y, g.maxYears) * g.perYear);
  }

  /** 장기보유특별공제 표2(1세대1주택) 공제율 (보유+거주) */
  function ltsdOwnerOcc(holdYears, liveYears) {
    var o = R.ltsd.ownerOcc;
    var hy = Math.floor(holdYears), ly = Math.floor(liveYears);
    var hold = hy < o.hold.startYear ? 0 : Math.min(o.hold.max, Math.min(hy, o.hold.maxYears) * o.hold.perYear);
    var live = ly < o.live.startYear ? 0 : Math.min(o.live.max, Math.min(ly, o.live.maxYears) * o.live.perYear);
    return Math.min(o.max, hold + live);
  }

  /**
   * 메인 계산 함수
   * @param {object} input {
   *   salePrice(양도가액), buyPrice(취득가액), expenses(필요경비),
   *   holdYears(보유연수), liveYears(거주연수),
   *   houseCount(1,2,3+), isAdjustedArea(조정대상지역),
   *   isOneHouseExempt(1세대1주택 비과세 요건 충족)
   * }
   */
  function calcYangdoTax(input) {
    var salePrice = Number(input.salePrice) || 0;
    var buyPrice = Number(input.buyPrice) || 0;
    var expenses = Number(input.expenses) || 0;
    var holdYears = Number(input.holdYears) || 0;
    var liveYears = Number(input.liveYears) || 0;
    var houseCount = Number(input.houseCount) || 1;
    var adjusted = !!input.isAdjustedArea;
    var oneHouse = !!input.isOneHouseExempt;

    if (salePrice <= 0) return { ok: false, error: '양도가액을 0보다 큰 값으로 입력하세요.' };

    var gain = salePrice - buyPrice - expenses; // 양도차익
    var notes = [];

    if (gain <= 0) {
      return {
        ok: true, exempt: false, gain: gain, taxableGain: 0, ltsdRate: 0, ltsd: 0,
        incomeAmount: 0, taxBase: 0, appliedRate: 0, calculatedTax: 0, localTax: 0, total: 0,
        notes: ['양도차익이 0 이하(양도차손) → 납부할 양도소득세 없음'],
      };
    }

    // 1세대1주택 비과세 / 고가주택 안분
    var taxableGain = gain;
    var isHighValue1House = false;
    if (oneHouse) {
      if (salePrice <= R.highValueThreshold) {
        return {
          ok: true, exempt: true, gain: gain, taxableGain: 0, ltsdRate: 0, ltsd: 0,
          incomeAmount: 0, taxBase: 0, appliedRate: 0, calculatedTax: 0, localTax: 0, total: 0,
          notes: ['1세대 1주택 비과세 → 양도가액 12억 이하라 전액 비과세 (납부세액 0)'],
        };
      }
      taxableGain = gain * (salePrice - R.highValueThreshold) / salePrice; // 12억 초과분 안분
      isHighValue1House = true;
      notes.push('1세대 1주택 고가주택 → 12억 초과분만 과세 (과세대상 양도차익 ' + won(taxableGain).toLocaleString() + '원)');
    }

    // 단기보유 판정 (주택)
    var short = holdYears < 1 ? 'under1' : (holdYears < 2 ? 'under2' : null);

    // 다주택 중과 판정 (보유 2년 이상 + 조정 + 다주택, 비과세 아님)
    var heavy = null;
    if (!short && !oneHouse && adjusted) {
      if (houseCount >= 3) heavy = 'h30';
      else if (houseCount === 2) heavy = 'h20';
    }

    // 장기보유특별공제율
    var ltsdRate = 0;
    if (!short) {
      if (heavy) {
        ltsdRate = 0;
        notes.push('조정지역 다주택 중과 → 장기보유특별공제 배제');
      } else if (isHighValue1House && Math.floor(liveYears) >= 2 && Math.floor(holdYears) >= 3) {
        ltsdRate = ltsdOwnerOcc(holdYears, liveYears);
        notes.push('장기보유특별공제 표2(1세대1주택) ' + (ltsdRate * 100).toFixed(0) + '% (보유+거주)');
      } else if (Math.floor(holdYears) >= 3) {
        ltsdRate = ltsdGeneral(holdYears);
        notes.push('장기보유특별공제 표1(일반) ' + (ltsdRate * 100).toFixed(0) + '%');
      }
    } else {
      notes.push(short === 'under1' ? '보유 1년 미만 → 단기 세율 70% (장특공제 없음)' : '보유 1~2년 → 단기 세율 60% (장특공제 없음)');
    }

    var ltsd = won(taxableGain * ltsdRate);
    var incomeAmount = won(taxableGain) - ltsd;            // 양도소득금액
    var taxBase = clamp0(incomeAmount - R.basicDeduction); // 과세표준 (기본공제 250만)

    // 산출세액
    var calculatedTax, appliedRate;
    if (short === 'under1') {
      appliedRate = R.shortTerm.under1yr; calculatedTax = taxBase * appliedRate;
    } else if (short === 'under2') {
      appliedRate = R.shortTerm.under2yr; calculatedTax = taxBase * appliedRate;
    } else {
      var br = bracket(taxBase);
      var sur = heavy === 'h20' ? R.heavySurcharge.twoHouse : (heavy === 'h30' ? R.heavySurcharge.threePlus : 0);
      appliedRate = br.rate + sur;
      calculatedTax = taxBase * appliedRate - br.deduct;
      if (sur) notes.push('조정지역 ' + (heavy === 'h30' ? '3주택 이상 +30%p' : '2주택 +20%p') + ' 중과');
    }
    calculatedTax = clamp0(won(calculatedTax));

    var localTax = won(calculatedTax * R.localTaxRate); // 지방소득세 10%
    var total = calculatedTax + localTax;

    return {
      ok: true, exempt: false,
      gain: won(gain),
      taxableGain: won(taxableGain),
      ltsdRate: ltsdRate,
      ltsd: ltsd,
      incomeAmount: incomeAmount,
      taxBase: taxBase,
      appliedRate: appliedRate,
      calculatedTax: calculatedTax,
      localTax: localTax,
      total: total,
      notes: notes,
    };
  }

  var Yangdo = {
    bracket: bracket,
    ltsdGeneral: ltsdGeneral,
    ltsdOwnerOcc: ltsdOwnerOcc,
    calcYangdoTax: calcYangdoTax,
  };

  if (typeof window !== 'undefined') window.Yangdo = Yangdo;
  if (typeof module !== 'undefined') module.exports = Yangdo;
})(typeof window !== 'undefined' ? window : global);
