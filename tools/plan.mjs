// 2라운드 관측 지시를 「데이터로 검증해서」 출력한다.
//
// 왜 있나: 관측 지시를 기억으로 말하다가 틀렸다. 1라운드 기록에는 S12의 목표 문구가
// 3턴 ③번에 있는데 메모를 옮겨 적으며 ②번이라고 지시했다. 계획을 사람이 읽고 옮기는
// 단계를 없애면 그 실수가 나올 자리가 없어진다.
//
//   node tools/plan.mjs        → 전체 진행 상황 + 계획 검증
//   node tools/plan.mjs S12    → 그 회차의 관측 지시 카드
import fs from 'fs';
import { readCsv } from './lib/csv.mjs';

// 분기탐색 계획. 지정 턴은 전부 1턴이다 —
// 뒤 턴을 지정하면 근거가 1라운드 목록일 수밖에 없는데 목록은 회차마다 달라진다.
const 분기 = {
  S12: { 키워드: ['저금통'], 이유: '비교 시드인데 1라운드는 세이프박스 쪽만 봤다. 저금통이 5턴 내내 미관측' },
  S15: { 키워드: ['저금통', '기록통장'], 이유: '1턴 딥링크 3개가 2턴에 0이 됐다. 상품에 머무는 경로면 유지되는지' },
  S16: { 키워드: ['정기예금'], 이유: '최고 7.00% 상품을 제시하고 딥링크는 더 낮은 상품으로 갔다' },
  S09: { 키워드: ['세금'], 이유: '파라미터 순열 루프에서 빠져나갈 길이 있는지' },
  S19: { 키워드: ['안정형', '성장형', '가치형'], 이유: '추천 블록이 둘인데 1라운드는 A블록을 보지 못했다' },
};

const R1 = readCsv(fs.readFileSync('data/observations-round1.csv', 'utf8')).filter(r => r.판정);
const R2 = readCsv(fs.readFileSync('data/observations-round2.csv', 'utf8'));
const 추천 = r => r.노출된_추천_전부.split(/ \/ | \| /).map(s => s.replace(/^\s*\d+\s*[.)]\s*/, '').trim()).filter(Boolean);

/** 1라운드에서 그 키워드가 어느 턴 몇 번째에 있었나 */
function 원위치(sid, 키워드) {
  const out = [];
  for (const r of R1.filter(x => x.seed_id === sid)) {
    추천(r).forEach((문구, i) => {
      if (키워드.some(k => 문구.includes(k))) out.push({ turn: +r.turn, 번째: i + 1, 문구 });
    });
  }
  return out;
}

const [, , 대상] = process.argv;

if (!대상) {
  console.log('\n2라운드 진행 상황');
  console.log('─'.repeat(72));
  const 회차 = [...new Set(R2.map(r => `${r.seed_id}|${r.round}|${r.목적}`))];
  for (const k of 회차) {
    const [sid, round, 목적] = k.split('|');
    const rows = R2.filter(r => r.seed_id === sid && r.round === round);
    const done = rows.filter(r => r.판정).length;
    console.log(`  ${sid} r${round}  ${목적.padEnd(6)}  ${done ? `기록 ${done}턴` : '미관측'}`);
  }

  console.log('\n분기 계획 검증 — 목표 키워드가 1라운드 기록에 실제로 있나');
  console.log('─'.repeat(72));
  for (const [sid, { 키워드 }] of Object.entries(분기)) {
    const 위치 = 원위치(sid, 키워드);
    if (!위치.length) { console.log(`  🔴 ${sid}  [${키워드}] 가 1라운드 기록에 없다 — 계획을 다시 볼 것`); continue; }
    console.log(`  ✅ ${sid}  [${키워드}] → ` + 위치.map(v => `${v.turn}턴 ${v.번째}번`).join(', '));
    for (const v of 위치) console.log(`        "${v.문구}"`);
  }
  console.log('\n지시 카드를 보려면: node tools/plan.mjs S12\n');
  process.exit(0);
}

const 계획 = 분기[대상];
if (!계획) { console.error(`${대상} 은 분기탐색 대상이 아니다. 대상: ${Object.keys(분기).join(' ')}`); process.exit(1); }

const 시드질문 = readCsv(fs.readFileSync('data/seeds.csv', 'utf8')).find(r => r.seed_id === 대상).question;
const 위치 = 원위치(대상, 계획.키워드);

console.log(`
━━ ${대상} 관측 지시 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  보려는 것: ${계획.이유}

  ① 뒤로 나갔다 하단바 AI 재진입 (대화 초기화)
  ② 입력:  ${시드질문}
  ③ 1턴 추천에서 ${계획.키워드.map(k => `「${k}」`).join(' 또는 ')} 가 들어간 문구를 찾아 그대로 타이핑
        없으면 → 2번째 것
  ④ 2턴부터 5턴까지 전부 첫 번째
  ⑤ 답변 전체를 한 번에 복사해서 전달

  참고 — 1라운드에서 그 키워드가 있던 자리 (이번 회차는 다를 수 있다)
${위치.map(v => `        ${v.turn}턴 ${v.번째}번  "${v.문구}"`).join('\n') || '        (없음)'}
`);
