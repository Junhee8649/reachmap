// 관측 원문 파일에서 「관측되지 않은 글자」를 걷어낸다.
// 세션 기록에서 복구할 때 관측자와 Claude가 주고받은 말이 함께 저장됐다.
//
// 지우기만 하면 정보가 사라지는 줄이 있다 — 이관된 창이라 복사가 안 됐다든가,
// 버튼을 누르면 자동으로 입력된다든가 하는 것은 화면에서만 알 수 있는 관측이다.
// 그런 줄은 _manifest.json 의 관측메모로 옮긴다.
//
//   node tools/clean-raw.mjs
import fs from 'fs';

const DIR = 'data/raw/round1';

// [파일, 지울 문자열, 옮길 곳(없으면 그냥 버린다)]
const 처리 = [
  ['S02.txt',
    '다음에 추천이 뜬 답변 하나만 텍스트+스샷 둘 다 보내주세요. 추천 목록이 텍스트에 들어오면 그다음부터는 텍스트만 보내시면 됩니다. 라니까 그럼 S02부분은 둘 다 보내라는거지? ',
    null],

  ['S17.txt', '여기까지가 3번째 답장이었어 그리고 새로운 창에서 AI상담 챗봇이 새로 열렸고 ',
    '3턴에서 AI 상담챗봇이 새 창으로 열렸다. 이 아래부터는 AI 검색이 아니라 그 창의 답변이다.'],
  ['S17.txt', ' (누를 수 있고 누르면 출금일 변경 적용 방법이라고 채팅이 자동으로 쳐지고 그에 대한 답이 나옴)',
    '이관된 창의 후속 UI는 누를 수 있는 버튼이고, 누르면 그 문구가 채팅에 자동으로 입력된다. AI 검색의 추천(클릭 불가 텍스트)과 형태가 다르다.'],
  ['S17.txt', '이렇게 떠서 일단은 종료함.',
    '이관 이후 관측자가 종료했다. 4·5턴은 미관측이다.'],

  ['S18.txt', '바로 종료됌',
    '거절 후 추천이 하나도 없어 1턴에서 종료됐다.'],

  ['S21.txt', '새 창이 열렸고 ',
    '1턴에서 AI 이체가 새 창으로 열렸다. 이 아래부터는 그 창의 화면이다.'],
  ['S21.txt', '(이게 우리 늘 마지막에 나오는 링크야)',
    '「입출금통장 만들기 >」는 AI 검색에서 늘 마지막에 붙던 딥링크 카드와 같은 형태다.'],
  ['S21.txt', '새 창에서는 아까와 챗봇과 마찬가지로 텍스트 복사가 안떠서 직접 친거야.',
    '🔴 이관된 창은 텍스트 복사가 되지 않아 관측자가 직접 타이핑해 옮겨 적었다. 원문 충실도가 다른 파일보다 낮고, 재탕 판정(문자열 완전 일치)에 쓸 수 없다.'],
  ['S21.txt', 'AI이체도 새 창으로 열리는 듯?',
    'AI 상담챗봇(S17)에 이어 AI 이체도 새 창으로 열린다.'],
];

const 메모 = {};
for (const [파일, 문자열, 관측] of 처리) {
  const p = `${DIR}/${파일}`;
  const before = fs.readFileSync(p, 'utf8');
  if (!before.includes(문자열)) { console.log(`  ⚠ ${파일}: 못 찾음 — ${문자열.slice(0, 30)}…`); continue; }
  fs.writeFileSync(p, before.replace(문자열, ''));
  console.log(`  ${파일}  −${문자열.length}자  ${관측 ? '→ manifest' : '버림'}   ${JSON.stringify(문자열.slice(0, 45))}`);
  if (관측) (메모[파일] ||= []).push(관측);
}

// 빈 줄이 세 줄 이상 연달아 생기면 두 줄로 줄인다 (턴 파서의 여백 처리와 맞춘다)
const NL = String.fromCharCode(10);
for (const 파일 of [...new Set(처리.map(x => x[0]))]) {
  const p = `${DIR}/${파일}`;
  const t = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, t.split(NL + NL + NL).join(NL + NL).replace(/^\s+/, ''));
}

const mp = `${DIR}/_manifest.json`;
const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
for (const [파일, 목록] of Object.entries(메모)) {
  const e = m.파일.find(f => f.파일 === 파일) ?? (m.파일.push({ 파일, 시드: 파일.replace('.txt', '') }), m.파일.at(-1));
  e.관측메모 = (e.관측메모 ?? []).concat(목록);
}
for (const f of m.파일) if (fs.existsSync(`${DIR}/${f.파일}`)) f.글자수 = fs.readFileSync(`${DIR}/${f.파일}`, 'utf8').length;
m.개정 = (m.개정 ?? []).concat({
  일자: '2026-08-19',
  내용: '원문 파일에서 관측되지 않은 글자를 걷어냈다. 세션 기록 복구 과정에서 관측자와 Claude가 주고받은 말이 함께 저장돼 있었다.',
  대상: 처리.map(x => x[0]).filter((v, i, a) => a.indexOf(v) === i).join(' · '),
  보존: '화면에서만 알 수 있는 관측(이관 여부, 복사 불가, 버튼 동작 등)은 버리지 않고 각 파일의 관측메모로 옮겼다.',
  검증: '채점기를 다시 돌려 기준선과 대조한다 — 턴수·딥링크·룰 6종·재탕 3층이 그대로여야 한다.',
});
fs.writeFileSync(mp, JSON.stringify(m, null, 1));
console.log('\n_manifest.json 갱신');
