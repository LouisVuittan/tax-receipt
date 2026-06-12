/* 골든테스트 node 러너 — tests*.html 안의 `var cases = [...]`를 추출해 실행 (배포 제외 대상 아님, 정적 파일이라 무해) */
'use strict';
const fs = require('fs');
const path = require('path');

const suites = [
  { html: 'tests.html', engine: './js/acquisition-tax.js', fn: 'calcAcquisitionTax' },
  { html: 'tests-yangdo.html', engine: './js/yangdo-tax.js', fn: 'calcYangdoTax' },
  { html: 'tests-jaesan.html', engine: './js/jaesan-tax.js', fn: 'calcJaesanTax' },
  { html: 'tests-jeungyeo.html', engine: './js/jeungyeo-tax.js', fn: 'calcJeungyeoTax' },
];

let totalPass = 0, totalFail = 0;

for (const s of suites) {
  const src = fs.readFileSync(path.join(__dirname, s.html), 'utf8');
  const m = src.match(/var cases = (\[[\s\S]*?\n    \]);/);
  if (!m) { console.error(s.html + ': cases 블록을 찾지 못함'); totalFail++; continue; }
  const cases = eval(m[1]);
  const engine = require(s.engine);
  let pass = 0, fail = 0;
  for (const c of cases) {
    const r = engine[s.fn](c.input);
    for (const k of Object.keys(c.expect)) {
      const act = r && r.ok !== false ? r[k] : 'ERR';
      if (act === c.expect[k]) pass++;
      else { fail++; console.log('  FAIL [' + s.html + '] ' + c.name + ' :: ' + k + ' expect=' + c.expect[k] + ' actual=' + act); }
    }
  }
  console.log(s.html + ': ' + pass + ' PASS / ' + fail + ' FAIL');
  totalPass += pass; totalFail += fail;
}

console.log('TOTAL: ' + totalPass + ' PASS / ' + totalFail + ' FAIL');
process.exit(totalFail ? 1 : 0);
