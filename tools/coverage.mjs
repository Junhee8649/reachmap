// 커버리지 대조 — FAQ 문서 밀도 vs 추천 질문이 실제로 간 곳
//
// 왜 있나:
//   공고 담당업무는 「AI로 연결되는 선제안/추천 질문 콘텐츠 운영」이다.
//   추천 질문은 대화의 입구이고, 문서가 있는 영역으로 유도해야 한다.
//   그러면 물어볼 것이 하나 나온다 — 문서가 많은 영역에 추천이 가고 있는가?
//
// ⚠️ FAQ 문항 수는 「고객이 많이 묻는 것」이 아니다. 카카오뱅크가 문서를 많이 만든 것이다.
//    상관은 있겠지만 같지 않다. 이 도구는 그것을 **문서 밀도의 대리 지표**로만 쓴다.
//    (docs/01 「FAQ 문항 수는 기능 목록이 아니라 문의 밀도로만 쓴다」)
//
// ⚠️ 분류는 키워드 표 하나로 한다. 표를 여기 그대로 두는 이유는
//    결과를 보고 표를 고치면 결론에 맞춰 기준을 쓰는 것이 되기 때문이다.
//    분류하지 못한 문구는 억지로 넣지 않고 「미분류」로 그대로 센다.
//
//   node tools/coverage.mjs           → 대조표
//   node tools/coverage.mjs --미분류  → 분류 못 한 문구 전량
import fs from 'fs';

// docs/04-골든셋-설계.md 의 표. 총 2,893개
const FAQ = {
  '대출': 809, '통장/저축': 506, '카드': 337, '사업자': 188, '투자': 164,
  '제휴서비스': 150, '외환': 146, 'mini': 142, '인증/보안': 115, '기타': 113,
  'AI': 72, '앱 이용': 83, 'ATM': 31, '개인금고': 19, '알림': 18,
};

// 좁은 것부터 본다. 「이자」·「금리」는 대출에도 저축에도 나오므로 뒤에 둔다.
//
// 2026-08-19 보완: 첫 실행에서 미분류 57건이 나왔다. 실물을 보니 두 종류였다.
//   ① 키워드 누락 — PIN·재발급·원리금균등·가져오기 등. 아래에 넣었다
//   ② 상품명이 아예 없는 계산 질문 — 「3,000만 원을 3년으로 빌리면 매달 얼마야?」
// ①만 고쳤다. ②는 억지로 넣지 않는다 — 주제가 없다는 것 자체가 관측 결과다.
// 경계를 옮겨 숫자를 바꾼 것이 아니라 빠진 단어를 채운 것이다.
const 분류표 = [
  ['개인금고', /개인금고/],
  ['mini', /\bmini\b|미니/i],
  ['사업자', /사업자|개인사업자/],
  ['ATM', /ATM|현금인출|입출금기/i],
  ['알림', /알림|푸시/],
  ['외환', /환전|달러|외화|해외송금|해외 ?이용|해외에서/],
  ['투자', /주식|배당|ETF|PER|PBR|ROE|펀드|시가총액|시총|종목|수익률|투자/i],
  ['카드', /카드|후불교통|분실신고|캐시백|브랜드쿠폰|재발급|자동결제|교통 ?이용/],
  ['인증/보안', /인증|비밀번호|생체|OTP|패턴|보안|스미싱|안심차단|본인확인|영상통화|\bPIN\b/i],
  ['대출', /대출|상환|마이너스|비상금|전월세|주택담보|주담대|이주비|LTV|신용점수|연체|DSR|갈아타기|인지세|원리금균등|원금균등|빌리면|갚[아으]/i],
  ['통장/저축', /통장|저축|적금|예금|세이프박스|저금통|모임|자동이체|이자|금리|만기|납입|중도해지|우대|모으기|가져오기|이체 ?한도/],
  ['AI', /\bAI\b/i],
  ['앱 이용', /앱|화면|메뉴|설정|전체탭/],
];

const 분류 = 문구 => (분류표.find(([, re]) => re.test(문구)) ?? ['미분류'])[0];

// 우리 관측의 추천 문구 전량 + 그 회차의 시드 주제
const 추천 = [];
for (const r of [1, 2]) {
  const data = JSON.parse(fs.readFileSync(`data/scored-round${r}.json`, 'utf8'));
  for (const [key, run] of Object.entries(data)) {
    const 시드cat = 분류(run.질문 ?? '');
    run.턴.forEach((t, i) => {
      if (!t.판정) return;
      for (const s of t.추천 ?? [])
        추천.push({ 회차: key, 턴: i + 1, 문구: s, cat: 분류(s), 시드cat });
    });
  }
}

const 셈 = {};
for (const x of 추천) 셈[x.cat] = (셈[x.cat] ?? 0) + 1;
const 총FAQ = Object.values(FAQ).reduce((a, b) => a + b, 0);
const 총추천 = 추천.length;

if (process.argv.includes('--미분류')) {
  const m = 추천.filter(x => x.cat === '미분류');
  console.log(`\n미분류 ${m.length}건\n`);
  m.forEach(x => console.log(`  ${x.회차} ${x.턴}턴  ${x.문구}`));
  process.exit(0);
}

// ── 교란 없이 잴 수 있는 것 — 추천이 시드 주제에서 벗어나는가 ──────────
// FAQ 대조는 우리 시드 분포에 좌우된다(아래 ⚠️). 이 지표는 시드가 무엇이든 성립한다.
const 같음 = 추천.filter(x => x.cat === x.시드cat).length;
const 주제없음 = 추천.filter(x => x.cat === '미분류').length;
const 다름 = 총추천 - 같음 - 주제없음;

console.log(`\n■ 추천이 시드 주제에서 벗어나는가 — 추천 ${총추천}개`);
console.log('─'.repeat(58));
console.log(`  시드와 같은 주제   ${String(같음).padStart(4)}  ${(100*같음/총추천).toFixed(1).padStart(5)}%`);
console.log(`  다른 주제로 이동   ${String(다름).padStart(4)}  ${(100*다름/총추천).toFixed(1).padStart(5)}%`);
console.log(`  주제 없음(계산)    ${String(주제없음).padStart(4)}  ${(100*주제없음/총추천).toFixed(1).padStart(5)}%`
  + '   ← 상품명이 없는 문구');

console.log('\n■ 회차별 — 추천이 시드 주제에 머문 비율');
const 회차별 = {};
for (const x of 추천) {
  const v = (회차별[x.회차] ??= { n: 0, same: 0, none: 0, seed: x.시드cat });
  v.n++; if (x.cat === x.시드cat) v.same++; if (x.cat === '미분류') v.none++;
}
for (const [k, v] of Object.entries(회차별).sort((a, b) => a[1].same/a[1].n - b[1].same/b[1].n))
  console.log(`  ${k.padEnd(9)} [${v.seed.padEnd(6)}] 같은 주제 ${String(v.same).padStart(2)}/${v.n}`
    + `  ${(100*v.same/v.n).toFixed(0).padStart(3)}%   주제없음 ${v.none}`);

console.log(`\n\n■ 참고 — FAQ 문서 밀도 대조 (⚠️ 교란됨)`);
console.log(`  우리 시드 24개는 FAQ 분포대로 뽑히지 않았다. 절반 이상이 통장/저축 주제다.`);
console.log(`  따라서 아래 차이는 「커버리지 공백」이 아니라 대부분 우리 표본의 그림자다.`);
console.log(`  판단 근거로 쓰지 않는다. 시드를 FAQ 분포대로 다시 뽑아야 성립한다.\n`);
console.log(`커버리지 대조 — FAQ ${총FAQ.toLocaleString()}개 vs 추천 문구 ${총추천}개\n`);
console.log('카테고리        FAQ    비중    추천   비중    차이');
console.log('─'.repeat(58));
const 행 = Object.entries(FAQ)
  .map(([k, n]) => {
    const f = 100 * n / 총FAQ, c = 100 * (셈[k] ?? 0) / 총추천;
    return { k, n, f, r: 셈[k] ?? 0, c, d: c - f };
  })
  .sort((a, b) => b.n - a.n);
for (const x of 행)
  console.log(
    `${x.k.padEnd(12)} ${String(x.n).padStart(5)}  ${x.f.toFixed(1).padStart(5)}%  ` +
    `${String(x.r).padStart(5)}  ${x.c.toFixed(1).padStart(5)}%  ${(x.d >= 0 ? '+' : '') + x.d.toFixed(1)}`);
console.log('─'.repeat(58));
console.log(`${'미분류'.padEnd(12)} ${'—'.padStart(5)}  ${'—'.padStart(6)}  ` +
  `${String(셈['미분류'] ?? 0).padStart(5)}  ${(100 * (셈['미분류'] ?? 0) / 총추천).toFixed(1).padStart(5)}%`);

console.log('\n■ 문서는 많은데 추천이 덜 가는 영역 (차이가 음수인 순)');
for (const x of 행.filter(v => v.d < -1).sort((a, b) => a.d - b.d))
  console.log(`  ${x.k.padEnd(12)} FAQ ${x.f.toFixed(1)}% → 추천 ${x.c.toFixed(1)}%   (${x.d.toFixed(1)}%p)`);

console.log('\n■ 추천이 문서 밀도보다 많이 가는 영역');
for (const x of 행.filter(v => v.d > 1).sort((a, b) => b.d - a.d))
  console.log(`  ${x.k.padEnd(12)} FAQ ${x.f.toFixed(1)}% → 추천 ${x.c.toFixed(1)}%   (+${x.d.toFixed(1)}%p)`);

fs.writeFileSync('data/coverage.json', JSON.stringify({
  주의: [
    'FAQ 문항 수는 문서 밀도의 대리 지표다. 고객 질문 빈도가 아니다.',
    'FAQ_대조는 시드 표본에 교란돼 있다. 판단 근거로 쓰지 않는다.',
    '시드 주제가 「미분류」인 회차(S11·S15·S15-r2)는 이동률 비교가 성립하지 않는다.',
  ],
  총FAQ, 총추천,
  주제이동: { 같음, 다름, 주제없음 },
  회차별,
  FAQ_대조: 행, 미분류: 셈['미분류'] ?? 0,
}, null, 1));
console.log('\n→ data/coverage.json 저장');
