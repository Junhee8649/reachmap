// 골든셋 채점 — 추천 경로 관측과 **다른 도구**다
//
// 왜 나눴나: 골든셋은 문항마다 대화를 초기화한 **독립 문서 집합**이다.
// 턴 체인을 전제하는 룰(예시휘발·재탕)이 여기서는 성립하지 않는다.
// score.mjs 에 플래그를 더하는 대신 파일을 나눴다 — 전제가 다르면 도구도 다르다.
//
//   node tools/score-golden.mjs
import fs from 'fs';
import { 전체 } from './lib/rules.mjs';
import { readCsv, writeCsv } from './lib/csv.mjs';

const 시트 = readCsv(fs.readFileSync('data/goldenset-round1.csv', 'utf8'));
const 관측 = 시트.filter(r => fs.existsSync(r.답변원문파일));
console.log(`시트 ${시트.length}문항 / 원문 있는 것 ${관측.length}문항\n`);

// 이관된 문항은 다른 창에서 직접 타이핑한 전사라 원문 충실도가 낮다.
// 문자열 룰에 넣으면 그 창의 표기가 AI 검색의 결함으로 잡힌다 → 매니페스트로 뺀다.
const 매니 = fs.existsSync('data/raw/golden/_manifest.json')
  ? JSON.parse(fs.readFileSync('data/raw/golden/_manifest.json', 'utf8')) : {};
const 제외 = new Set(Object.entries(매니).filter(([, v]) => v && v.룰제외).map(([k]) => k.replace('.txt', '')));
const turns = 관측.map(r => ({ body: fs.readFileSync(r.답변원문파일, 'utf8') }));
const 룰입력 = turns.map((t, i) => (제외.has(관측[i].q_id) ? { ...t, body: '' } : t));
if (제외.size) console.log('⚠️ 룰 제외 ' + [...제외].join(' ') + ' — 이관 창 전사라 문자열 판정에서 뺀다');
const 링크 = turns.map(t => [...t.body.matchAll(/https?:\/\/\S+/g)].map(m => m[0]));
// 추천 문구 — 머리말은 5종이다(👉/🔍 × 문구). 1·2라운드에서 확인된 것을 그대로 쓴다.
// 🔴 처음엔 「👉」만 찾았다가 G44(🔍 더 자세히 알려드릴게요)를 추천 0개로 셌다.
//    parse.mjs 의 MARKER 를 그대로 가져와 맞춘다 — 도구마다 다른 규칙을 쓰면 회차 비교가 깨진다.
const MARKER = /^[^\S\n]*[#*]*\s*[👉🔍][^\n]*(?:드릴게요|물어볼 수 있어요)[^\n]*$/m;
const 추천 = turns.map(t => {
  const m = t.body.match(MARKER);
  if (!m) return [];
  const 뒤 = t.body.slice(t.body.indexOf(m[0]) + m[0].length);
  return [...뒤.matchAll(/^\s*\d+\.\s*(.+)$/gm)].map(x => x[1].trim());
});

const 히트 = {};
for (const [이름, fn] of Object.entries(전체)) 히트[이름] = fn(룰입력, { 독립: true });

console.log('■ 룰 적중 (독립 문서 모드 — 예시휘발은 끈다)');
for (const [이름, h] of Object.entries(히트)) {
  const 문항 = [...new Set(h.map(x => 관측[x.turn - 1].q_id))];
  console.log(`  ${이름.padEnd(10)} ${String(h.length).padStart(3)}건  ${문항.join(' ') || '-'}`);
}

console.log('\n■ 도달');
const 링크턴 = 링크.filter(l => l.length).length;
console.log(`  링크가 붙은 문항 ${링크턴}/${관측.length}`);
관측.forEach((r, i) => {
  if (!링크[i].length) console.log(`    ✗ ${r.q_id}  ${r.질문}`);
});

console.log('\n■ 추천 문구');
관측.forEach((r, i) => console.log(`  ${r.q_id} ${추천[i].length}개  ${추천[i][0] ?? '(없음)'}`));

// 시트에 기계로 셀 수 있는 값만 채운다. 판정은 사람이 붙인다 (D-03).
관측.forEach((r, i) => {
  r.딥링크_개수 = String(링크[i].length);
  r.추천_개수 = String(추천[i].length);
});
fs.writeFileSync('data/goldenset-round1.csv', writeCsv(시트));
fs.writeFileSync('data/scored-golden.json', JSON.stringify(
  { 문항수: 관측.length, 히트, 링크, 추천,
    문항: 관측.map((r, i) => ({ ...r, 링크: 링크[i], 추천: 추천[i] })) }, null, 1));
console.log('\n→ data/goldenset-round1.csv 갱신 · data/scored-golden.json 저장');
