/*
 * 상속세 계산 엔진 (순수 함수 — UI와 분리)
 * ------------------------------------------------------------------
 * 적용 범위(커버리지, v1):
 *   - 일괄공제 5억 + 배우자상속공제(최소 5억~최대 30억, 실제 상속액 기준)
 *   - 금융재산상속공제(2천만 전액 / 20% / 한도 2억)
 *   - 채무·공과금, 장례비용(500만~1,500만 클램프) 차감
 *   - 5구간 누진세율, 신고세액공제(3%)
 * 미반영(화면에 명시):
 *   - 기초공제 2억+인적공제(자녀·미성년·연로자·장애인) 선택 적용(일괄 5억으로 고정),
 *     배우자공제의 법정상속지분 한도, 배우자 단독상속(일괄공제 불가),
 *     동거주택 상속공제(6억), 가업·영농상속공제, 10년 내 사전증여재산 가산,
 *     세대생략(손주) 할증, 재산 평가(시가 산정), 단기재상속 세액공제
 * 단수처리: 최종 납부세액 10원 미만 절사.
 */
(function (global) {
  'use strict';

  var R = global.SANGSOK_RULES_2026 || (typeof require !== 'undefined' ? require('./rules-sangsok-2026.js') : null);
  if (!R) throw new Error('SANGSOK_RULES_2026 데이터가 로드되지 않았습니다.');

  function floor10(n) { return Math.floor(n / 10) * 10; }

  /** 누진표에서 산출세액: 과세표준 × rate − 누진공제 (원단위 반올림) */
  function progressive(taxBase) {
    if (taxBase <= 0) return 0;
    for (var i = 0; i < R.brackets.length; i++) {
      if (taxBase <= R.brackets[i].upTo) {
        var b = R.brackets[i];
        return Math.round(taxBase * b.rate - b.ded);
      }
    }
    var last = R.brackets[R.brackets.length - 1];
    return Math.round(taxBase * last.rate - last.ded);
  }

  /** 금융재산상속공제: 2천만 이하 전액 / 초과 시 max(2천만, 20%) / 한도 2억 */
  function financialDeduction(netFinancial) {
    if (netFinancial <= 0) return 0;
    if (netFinancial <= R.financialFullLimit) return netFinancial;
    return Math.min(Math.max(R.financialFullLimit, Math.round(netFinancial * R.financialRate)), R.financialCap);
  }

  /**
   * 메인 계산 함수
   * @param {object} input {
   *   estate(총 상속재산가액), debt(채무·공과금), funeral(장례비용 지출액),
   *   hasSpouse(배우자 생존), spouseAmount(배우자 실제 상속액 — 비우면 최소 5억),
   *   financial(순금융재산), onTimeReport(기한 내 신고, 기본 true)
   * }
   */
  function calcSangsokTax(input) {
    var estate = Number(input.estate) || 0;
    var debt = Math.max(0, Number(input.debt) || 0);
    var funeralInput = Math.max(0, Number(input.funeral) || 0);
    var hasSpouse = !!input.hasSpouse;
    var spouseAmount = Math.max(0, Number(input.spouseAmount) || 0);
    var financial = Math.max(0, Number(input.financial) || 0);
    var onTime = input.onTimeReport !== false;

    if (estate <= 0) return { ok: false, error: '총 상속재산가액을 0보다 큰 값으로 입력하세요.' };

    var notes = [];

    // 1) 과세가액 = 총재산 − 채무 − 장례비 (장례비는 입력 시 500만~1,500만 클램프)
    var funeral = funeralInput > 0
      ? Math.min(Math.max(funeralInput, R.funeralMin), R.funeralMax) : 0;
    if (funeralInput > 0 && funeral !== funeralInput) {
      notes.push('장례비용은 ' + (funeral === R.funeralMin ? '증빙 없어도 최소 500만' : '봉안시설 포함 최대 1,500만') + ' 기준으로 조정됨');
    }
    if (funeralInput === 0) notes.push('장례비용 미입력 — 증빙 없어도 500만 원은 공제 가능하니 실제 신고 시 챙기세요');
    var grossValue = Math.max(0, estate - debt - funeral);

    // 2) 상속공제: 일괄공제 5억 + 배우자공제 + 금융재산공제
    var lump = R.lumpSumDeduction;
    notes.push('일괄공제 5억 적용 (기초 2억+인적공제가 더 크면 그쪽 선택 가능 — v1 미반영)');

    var spouseDeduction = 0;
    if (hasSpouse) {
      spouseDeduction = spouseAmount > 0
        ? Math.max(R.spouseMinDeduction, Math.min(spouseAmount, R.spouseMaxDeduction))
        : R.spouseMinDeduction;
      notes.push('배우자공제 ' + spouseDeduction.toLocaleString() + '원 ' +
        (spouseAmount > 0 ? '(실제 상속액 기준, 법정지분 한도는 미반영)' : '(실제 상속액 미입력 → 최소 5억)'));
    }

    var finDeduction = financialDeduction(financial);
    if (finDeduction > 0) {
      notes.push('금융재산공제 ' + finDeduction.toLocaleString() + '원 (순금융재산 ' +
        (financial <= R.financialFullLimit ? '2천만 이하 전액' : '20%, 최소 2천만·한도 2억') + ')');
    }

    var totalDeduction = Math.min(lump + spouseDeduction + finDeduction, grossValue);

    // 3) 과세표준 → 산출세액
    var taxBase = grossValue - totalDeduction;
    var calcTax = progressive(taxBase);
    if (taxBase <= 0) {
      notes.push('과세표준 0원 — 납부세액 없음 (공제 한도 내 상속: ' +
        (hasSpouse ? '배우자 있으면 10억' : '5억') + '까지 상속세 0원)');
    }

    // 4) 신고세액공제 3% (상속개시일이 속한 달의 말일부터 6개월 내 신고)
    var reportCredit = onTime ? Math.floor(calcTax * R.reportCreditRate) : 0;
    if (onTime && calcTax > 0) {
      notes.push('신고세액공제 3% 반영 — 신고기한: 상속개시일이 속한 달의 말일부터 6개월');
    } else if (!onTime && calcTax > 0) {
      notes.push('기한 후 신고 → 신고세액공제 없음 + 가산세 발생 가능 (가산세는 미반영)');
    }
    notes.push('10년 내 사전증여 가산·동거주택 공제·세대생략 할증 등은 미반영 (전문가 확인 권장)');

    var finalTax = floor10(calcTax - reportCredit);

    return {
      ok: true,
      grossValue: grossValue,
      funeral: funeral,
      lumpDeduction: lump,
      spouseDeduction: spouseDeduction,
      finDeduction: finDeduction,
      totalDeduction: totalDeduction,
      taxBase: Math.max(0, taxBase),
      calcTax: calcTax,
      reportCredit: reportCredit,
      finalTax: finalTax,
      notes: notes,
    };
  }

  var Sangsok = {
    progressive: progressive,
    financialDeduction: financialDeduction,
    calcSangsokTax: calcSangsokTax,
  };

  if (typeof window !== 'undefined') window.Sangsok = Sangsok;
  if (typeof module !== 'undefined') module.exports = Sangsok;
})(typeof window !== 'undefined' ? window : global);
