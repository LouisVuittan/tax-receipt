/*
 * 증여세 계산 엔진 (순수 함수 — UI와 분리)
 * ------------------------------------------------------------------
 * 적용 범위(커버리지, v1):
 *   - 관계별 증여재산공제(10년 한도) + 혼인·출산 공제(1억, 직계존속→성년)
 *   - 5구간 누진세율, 세대생략 할증(30%/40%), 신고세액공제(3%)
 *   - 10년 내 동일인 사전증여 합산 + 기납부세액공제(사전증여 단독 산출세액으로 추정)
 * 미반영(화면에 명시):
 *   - 부동산·주식 등 재산 평가(시가·감정가 산정), 부담부증여(채무 인수분 양도세 분리),
 *     창업자금·가업승계 특례, 비거주자, 재차증여 정확한 기납부세액(당시 실제 납부액 필요),
 *     증여취득세(부동산 무상취득 3.5~12%, 취득세 계산기와 별개)
 * 단수처리: 최종 납부세액 10원 미만 절사.
 */
(function (global) {
  'use strict';

  var R = global.JEUNGYEO_RULES_2026 || (typeof require !== 'undefined' ? require('./rules-jeungyeo-2026.js') : null);
  if (!R) throw new Error('JEUNGYEO_RULES_2026 데이터가 로드되지 않았습니다.');

  function floor10(n) { return Math.floor(n / 10) * 10; }

  var REL_LABEL = {
    spouse: '배우자', adult: '직계존속→성년 자녀·손주', minor: '직계존속→미성년 자녀·손주',
    ascendant: '직계비속→부모 등 직계존속', relative: '기타친족(형제자매·사위·며느리 등)', other: '그 외 타인',
  };

  /** 누진표에서 산출세액: 과세표준 × rate − 누진공제 (부동소수점 오차 방지 위해 원단위 반올림) */
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

  /** 세대생략 할증률 (미성년 + 증여재산가액 20억 초과 = 40%) */
  function skipRate(relation, amount) {
    return (relation === 'minor' && amount > R.skipBigThreshold)
      ? R.skipSurchargeRateMinorBig : R.skipSurchargeRate;
  }

  /**
   * 메인 계산 함수
   * @param {object} input {
   *   amount(증여재산가액), relation(spouse|adult|minor|ascendant|relative|other),
   *   prior(10년 내 동일인 사전증여액, 기본 0), useMarriageBirth(혼인·출산 공제),
   *   isSkip(세대생략 증여), onTimeReport(기한 내 신고, 기본 true)
   * }
   */
  function calcJeungyeoTax(input) {
    var amount = Number(input.amount) || 0;
    var prior = Math.max(0, Number(input.prior) || 0);
    var relation = input.relation;
    var marriage = !!input.useMarriageBirth;
    var skip = !!input.isSkip;
    var onTime = input.onTimeReport !== false;

    if (amount <= 0) return { ok: false, error: '증여재산가액을 0보다 큰 값으로 입력하세요.' };
    if (!(relation in R.deductions)) return { ok: false, error: '증여자와의 관계를 선택하세요.' };

    var notes = [];

    // 1) 10년 내 동일인 사전증여 합산 (직계존속은 그 배우자 포함: 아버지+어머니 = 동일인)
    var totalValue = amount + prior;
    if (prior > 0) {
      notes.push('10년 내 동일인 사전증여 ' + prior.toLocaleString() + '원 합산 (직계존속은 부+모 합산)');
    }

    // 2) 증여재산공제 (10년 한도) + 혼인·출산 공제 (직계존속→성년만)
    var baseDeduction = R.deductions[relation];
    var marriageDeduction = 0;
    if (marriage) {
      if (relation === 'adult') {
        marriageDeduction = R.marriageBirthDeduction;
        notes.push('혼인·출산 공제 1억 적용 (혼인신고·출생일 전후 2년 내, 통합 한도 1억)');
      } else {
        notes.push('혼인·출산 공제는 직계존속→성년 증여만 가능 → 미적용');
      }
    }
    var deduction = Math.min(baseDeduction + marriageDeduction, totalValue);
    notes.push(REL_LABEL[relation] + ' 공제 한도 ' + baseDeduction.toLocaleString() + '원 (10년 합산 기준)');

    // 3) 과세표준 → 산출세액
    var taxBase = totalValue - deduction;
    var calcTax = progressive(taxBase);
    if (taxBase <= 0) notes.push('과세표준 0원 — 납부세액 없음 (공제 한도 내 증여)');

    // 4) 세대생략 할증
    var surcharge = 0;
    if (skip) {
      if ((relation === 'adult' || relation === 'minor') && calcTax > 0) {
        var sr = skipRate(relation, amount);
        surcharge = Math.round(calcTax * sr);
        notes.push('세대생략 할증 ' + (sr * 100) + '% (조부모→손주 등 한 세대 건너뛴 증여' +
          (sr === R.skipSurchargeRateMinorBig ? ', 미성년+20억 초과' : '') + ')');
      } else if (relation !== 'adult' && relation !== 'minor') {
        notes.push('세대생략 할증은 직계존속→직계비속 증여만 해당 → 미적용');
      }
    }

    // 5) 기납부세액공제 (사전증여분 단독 산출세액으로 추정 — 당시 실제 납부액과 다를 수 있음)
    var priorCredit = 0;
    if (prior > 0) {
      var priorTaxBase = prior - Math.min(deduction, prior);
      var priorTax = progressive(priorTaxBase);
      if (skip && (relation === 'adult' || relation === 'minor') && priorTax > 0) {
        priorTax += Math.round(priorTax * skipRate(relation, prior));
      }
      priorCredit = priorTax;
      if (priorCredit > 0) notes.push('기납부세액공제는 사전증여 단독 산출세액으로 추정 (실제 신고·납부액과 다를 수 있음)');
    }

    var afterPrior = Math.max(0, calcTax + surcharge - priorCredit);

    // 6) 신고세액공제 3% (증여일이 속한 달의 말일부터 3개월 내 신고)
    var reportCredit = onTime ? Math.floor(afterPrior * R.reportCreditRate) : 0;
    if (onTime && afterPrior > 0) {
      notes.push('신고세액공제 3% 반영 — 신고기한: 증여일이 속한 달의 말일부터 3개월');
    } else if (!onTime && afterPrior > 0) {
      notes.push('기한 후 신고 → 신고세액공제 없음 + 가산세 발생 가능 (가산세는 미반영)');
    }

    var finalTax = floor10(afterPrior - reportCredit);
    notes.push('부동산 증여는 시가(매매사례가액·감정가) 평가 + 증여취득세(3.5~12%)가 별도입니다');

    return {
      ok: true,
      totalValue: totalValue,
      deduction: deduction,
      taxBase: Math.max(0, taxBase),
      calcTax: calcTax,
      surcharge: surcharge,
      priorCredit: priorCredit,
      reportCredit: reportCredit,
      finalTax: finalTax,
      notes: notes,
    };
  }

  var Jeungyeo = {
    progressive: progressive,
    calcJeungyeoTax: calcJeungyeoTax,
  };

  if (typeof window !== 'undefined') window.Jeungyeo = Jeungyeo;
  if (typeof module !== 'undefined') module.exports = Jeungyeo;
})(typeof window !== 'undefined' ? window : global);
