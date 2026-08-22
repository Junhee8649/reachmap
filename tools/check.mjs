// 문서에 적힌 주장을 데이터와 대조한다.
//
// 왜 있나: 이 프로젝트에서 실제로 다친 것은 거의 전부 숫자와 위치였다.
// AI 기능 6개(실제 7개) · S06 재탕 6건(실제 5건) · S12 3턴 2번(실제 3번).
// 전부 "확인했다"고 생각하고 확인하지 않은 것들이다.
// 산문 규칙으로는 막히지 않는다 — 틀리면 빨간 줄이 떠야 막힌다.
//
//   node tools/check.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { readCsv } from './lib/csv.mjs';

const 읽기 = p => fs.readFileSync(p, 'utf8');
const R1 = readCsv(읽기('data/observations-round1.csv')).filter(r => r.판정);
const R2rows = readCsv(읽기('data/observations-round2.csv'));
const R2 = R2rows.filter(r => r.판정);
const GOLD = readCsv(읽기('data/goldenset-round1.csv')).filter(r => r.판정);
const SEEDS = readCsv(읽기('data/seeds.csv'));
// 룰 함수만 센다. 집계용 export(전체)는 룰이 아니다
const 룰수 = (읽기('tools/lib/rules.mjs').match(/^export function /gm) || []).length;
const 판정수 = v => R1.filter(r => r.판정 === v).length;
// 🔴 이 표는 오래 1라운드만 봤다. 관측이 204턴으로 늘었는데 검사 기준이 97턴에 머물러 있었고,
//    README를 204턴 기준으로 고치자 그제서야 빨간 줄이 떴다. 전체 기준을 따로 둔다.
const 전량 = [...R1, ...R2, ...GOLD];
const 전량판정 = v => 전량.filter(r => r.판정 === v).length;
// 도달 수치는 채점 결과(**답변 원문에서 기계가 센 값**)에서 가져온다.
// 🔴 전체 채점본(data/scored-*.json)은 원문이 들어 있어 공개하지 않는다(.gitignore).
//    그래서 공개본을 먼저 보고, 없을 때만 전체본으로 떨어진다 — CI(clean clone)에서도 돌아야 하기 때문이다.
//    두 파일의 링크 수가 같은 것은 확인했다(58 / 26).
const 채점 = (...후보) => { for (const f of 후보) if (fs.existsSync(f)) return JSON.parse(읽기(f)); return null; };
const 링크센다 = d => d ? Object.values(d).filter(v => Array.isArray(v?.턴)).reduce((n, v) => n + v.턴.filter(t => t.링크?.length).length, 0) : null;
const S1 = 채점('data/scored-round1.public.json', 'data/scored-round1.json');
const S2 = 채점('data/scored-round2.public.json', 'data/scored-round2.json');
const 링크턴 = (링크센다(S1) ?? 0) + (링크센다(S2) ?? 0);
// 골든셋 공개본에는 링크 칸이 없다. CSV 의 딥링크_개수로 센다 — 채점기와 같은 45가 나오는 것을 확인했다.
const 링크문항 = GOLD.filter(r => Number(r.딥링크_개수 || 0) > 0).length;

const raw1 = fs.existsSync('data/raw/round1') ? fs.readdirSync('data/raw/round1').filter(f => f.endsWith('.txt')) : null;

const 옵션 = f => (fs.existsSync(f) ? JSON.parse(읽기(f)) : null);
const FB = 옵션('data/feedback-map.json');
const CV = 옵션('data/faq-coverage.json');

const 문서 = ['README.md', 'data/README.md', ...fs.readdirSync('docs').filter(f => f.endsWith('.md')).map(f => `docs/${f}`)]
  .filter(p => fs.existsSync(p));

// [이름, 정규식(캡처 1개), 참값]
// 정규식은 좁게 쓴다. 넓게 잡아 오탐을 내면 아무도 안 보게 된다.
const 주장 = [
  ['1라운드 총 턴수', /1라운드 관측 기록 (\d+)턴|관측 기록 97턴|총 (\d+)턴\)/g, R1.length],
  // 「시드 22개」는 1라운드를 가리키는 맥락에서 맞는 값이므로 문서 전체 대조 대상이 아니다.
  // 파일 표에 적힌 seeds.csv 행수만 본다
  ['seeds.csv 행수', /\| 시드 질문 (\d+)개 \|/g, SEEDS.length],
  ['룰 종류 수', /룰 (\d+)종/g, 룰수],
  ['1라운드 판정 정답', /1라운드[^\n]*정답 (\d+) ?· ?부분/g, 판정수('정답')],
  ['전량 총 턴수', /질문 (\d+)개를 넣어봤습니다|질문 \*\*(\d+)개\*\*를|채점 대상은 \*\*(\d+)턴\*\*|합계 (\d+)개/g, 전량.length],
  // 캡처는 하나만 둔다 — 실행기가 「처음 정의된 캡처」를 값으로 쓰므로 턴수까지 잡으면 엉뚱한 값이 온다
  ['전량 판정 정답', /(?:\d+턴 중|\()정답 (\d+) ?· ?부분/g, 전량판정('정답')],
  // 🔴 2026-08-22 — 이 자리에 원래 백분율(63%)과 1라운드 건수(61)를 비교하는 규칙이 있었다.
  //    형이 달라 애초에 성립하지 않는 대조였고, 그래서 「84 vs 89」를 못 잡았다.
  //    도달 수치의 출처는 **채점기가 답변 원문에서 센 값**이다(CSV의 앱기능_진입이 아니다).
  //    두 값이 5턴 다른 것은 원문에 링크 카드가 안 남은 턴 때문이고, 그건 「못 잡는 것」에 적혀 있다.
  ['도달한 턴 (원문 기준)', /링크가 붙은 턴 +(\d+) ?\/ ?144/g, 링크턴],
  ['도달 문항 (원문 기준)', /링크가 붙은 문항 +(\d+) ?\/ ?60/g, 링크문항],
  ['도달 합계', / \((\d+)턴\) \|/g, 링크턴 + 링크문항],
  ['링크 없이 끝난 턴', /204개 중 \*\*(\d+)개\*\*가 상품 바로가기 없이/g, 204 - 링크턴 - 링크문항],
  // 🔴 2026-08-22 — 리포트에 「피드백 3층」과 「추천이 닿지 않은 자리」 절을 새로 넣으면서,
  //    그 숫자들이 손으로 적혀 있었다. 도구가 다시 돌면 문서만 낡는다. 대조 대상에 넣는다.
  ['피드백 A층 건수', /\*\*A 신고 가능\*\* \| [^|]+\| (\d+) \|/g, FB ? FB.요약.A_신고가능 : null],
  ['피드백 B층 건수', /\*\*B 칸이 없다\*\* \| [^|]+\| (\d+) \|/g, FB ? FB.요약.B_칸없음 : null],
  ['피드백 C층 건수', /\*\*C 안 보인다\*\* \| [^|]+\| (\d+) \|/g, FB ? FB.요약.C_안보임 : null],
  ['FAQ 태그 수', /직접 붙인 태그\*\* (\d+)개/g, CV ? CV.태그수 : null],
  ['추천이 닿은 태그', /닿은 태그는 \*\*(\d+)개\*\*/g, CV ? CV.닿은태그 : null],
  ['2라운드 행수', /(\d+)행 \/ 19컬럼|기록지 (\d+)행/g, R2rows.length],
  ['2라운드 컬럼수', /(\d+)컬럼이다|총 (\d+)컬럼/g, Object.keys(R2rows[0]).length],
  ['1라운드 원문 파일 수', /\((\d+)파일/g, raw1 ? raw1.length : null],
];

let 실패 = 0, 검사 = 0;
console.log('\n■ 숫자 주장 대조');
for (const [이름, re, 참값] of 주장) {
  if (참값 === null) { console.log(`  –  ${이름} — 원본이 로컬에 없어 건너뜀`); continue; }
  const 발견 = [];
  for (const p of 문서) {
    for (const m of 읽기(p).matchAll(new RegExp(re.source, 'g'))) {
      const v = +[...m].slice(1).find(x => x !== undefined);
      발견.push({ p, v, 원문: m[0].trim() });
    }
  }
  if (!발견.length) { console.log(`  –  ${이름} — 문서에서 못 찾음 (참값 ${참값})`); continue; }
  검사++;
  const 틀림 = 발견.filter(f => f.v !== 참값);
  if (틀림.length) {
    실패++;
    console.log(`  🔴 ${이름} — 계산값 ${참값}`);
    for (const f of 틀림) console.log(`        ${f.p}  "${f.원문}"`);
  } else {
    console.log(`  ✅ ${이름} — ${참값} · 문서 ${발견.length}곳 일치`);
  }
}

// ── 코드에 들어간 기술이 결정기록에 있나 ──────────────────────────────
// 🔴 왜 있나: `gemini-embedding-001` 이 **코드에만 있고 결정기록에 없는 채로** 며칠 있었다.
//    CLAUDE.md 작업규칙 1(승인 후 채택)을 어긴 것인데, 산문 규칙으로는 안 잡혔다.
//    잡히는 것은 셋뿐이다 — 외부 URL · 모델 이름 · npm 의존성.
//    ⚠️ **이 검사는 「몰래 들어온 기술」만 잡는다.** 설계 판단이나 데이터 처리 방식은 못 잡는다.
//    그것까지 막아준다고 생각하면 오히려 위험하다.
console.log('\n■ 코드에 있는데 결정기록에 없나 — 외부 URL · 모델명 · 의존성');
{
  const 결정문 = 읽기('docs/02-결정기록.md');
  const 코드 = ['tools', 'src'].flatMap(d =>
    fs.readdirSync(d, { recursive: true })
      .filter(f => /\.(mjs|ts|tsx|py)$/.test(f))
      .map(f => `${d}/${f}`.replace(/\\/g, '/')))
    // 이 파일 자신은 뺀다 — 아래 정규식에 `gpt`·`claude` 가 문자열로 들어 있어 자기를 잡는다
    .filter(f => f !== 'tools/check.mjs');

  const 발견 = new Map();   // 항목 → 어디서 나왔나
  const 담기 = (k, 곳) => { if (!발견.has(k)) 발견.set(k, 곳); };

  for (const f of 코드) {
    const t = 읽기(f);
    // 외부 호스트 — 우리 저장소 밖으로 나가는 곳
    for (const m of t.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) 담기(m[1], f);
    // 모델 이름 — `gemini-embedding-001` `gpt-4o` `claude-...` 꼴
    for (const m of t.matchAll(/["'`]((?:gemini|gpt|claude|text-embedding|llama|mistral)[a-z0-9.-]*)["'`]/gi))
      담기(m[1].toLowerCase(), f);
  }
  const pkg = JSON.parse(읽기('package.json'));
  for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))
    // `@types/react` 는 `react` 의 타입 선언일 뿐 별도 선택이 아니다. 본체 이름으로 본다
    담기(d.replace(/^@types\//, ''), 'package.json');

  // 결정기록이 그 이름을 어디서든 언급하면 「선언됐다」로 본다.
  // 느슨하게 잡는다 — 목적은 고발이 아니라 **빠진 것을 눈에 띄게 하는 것**이다.
  const 미선언 = [...발견].filter(([k]) => !결정문.toLowerCase().includes(k.toLowerCase()));
  if (미선언.length) {
    실패++;
    console.log('  🔴 결정기록(docs/02)에 없다 — 승인 없이 들어왔거나, 들어왔는데 안 적었다');
    for (const [k, 곳] of 미선언) console.log(`        ${k.padEnd(38)} ${곳}`);
  } else {
    console.log(`  ✅ ${발견.size}개 전부 결정기록에 있음`);
  }
}

// ── 시드 정의와 실제로 보낸 질문이 같나 ────────────────────────────────
// 🔴 S24 가 어긋나 있었다 — seeds.csv 는 「모임통장에 친구 초대장 보내줘」인데
//    실제 1턴 입력은 「스미싱 문자인지 확인해줘」였다. 관측 중에 시드를 바꾸고
//    정의 파일을 안 고친 것으로 보이는데, 둘 다 공개되므로 읽는 사람이 어긋남을 보게 된다.
//    원문은 손대지 않는다(작업규칙 4). 어긋났다는 사실을 검사로 드러낸다.
console.log('\n■ 시드 정의 ↔ 실제 1턴 입력');
{
  // 이미 확인하고 사유를 적어 둔 어긋남. **새 어긋남만 실패로 잡는다** —
  // 아는 것까지 매번 빨갛게 두면 검사가 소음이 되고, 그러면 아무도 안 본다(docs/06).
  // 🔴 여기 넣는 것은 「고쳤다」가 아니라 「알고 있고 어딘가에 적었다」는 뜻이다.
  const 알려진어긋남 = {
    'S19/round2': '관측 때 「지금」을 빠뜨리고 보냈다. 원문은 그대로 두고 seeds.csv 비고에 적었다',
  };
  const 정의 = Object.fromEntries(SEEDS.map(s => [s.seed_id, s.question]));
  const 새것 = [], 아는것 = [];
  for (const [csv, rows] of [['round1', R1], ['round2', R2]])
    for (const r of rows.filter(r => r.turn === '1')) {
      if (!정의[r.seed_id] || 정의[r.seed_id] === r.입력질문) continue;
      const 키 = `${r.seed_id}/${csv}`;
      const 줄 = `${키}\n        seeds.csv  "${정의[r.seed_id]}"\n        실제 입력   "${r.입력질문}"`;
      (알려진어긋남[키] ? 아는것 : 새것).push(알려진어긋남[키] ? `${키} — ${알려진어긋남[키]}` : 줄);
    }
  아는것.forEach(m => console.log('  ·  ' + m));
  if (새것.length) { 실패++; 새것.forEach(m => console.log('  🔴 ' + m)); }
  else console.log(`  ✅ 시드 ${SEEDS.length}개 — 새로 어긋난 것 없음`);
}

console.log('\n■ 문서가 가리키는 경로가 실재하나');
const 경로들 = new Set();
for (const p of 문서)
  for (const m of 읽기(p).matchAll(/`((?:data|tools|src|docs)\/[A-Za-z0-9가-힣._\/-]+)`/g)) 경로들.add(m[1]);
// 확장자가 없는 것은 산문의 약칭(docs/03 참조)이지 경로가 아니다
let 없는경로 = [...경로들].filter(c => /\.[a-z]+$/.test(c) && !fs.existsSync(c) && !c.includes('<'));
// 🔴 일부러 로컬에만 두는 파일(원문이 든 채점 결과 등)은 clean clone 에 없는 게 정상이다.
//    .gitignore 를 손으로 흉내 내지 않고 git 에게 직접 묻는다. git 이 없으면 이 완화를 건너뛴다.
// 🔴 core.quotePath=false 가 없으면 git 이 한글 경로를 "docs/00-ê³µ…" 로 escape 해 돌려줘
//    문자열 비교가 어긋난다. 로컬에서는 파일이 있어 이 분기를 안 타고, CI 에서만 터졌다 (2026-08-22).
//    tone.mjs 에 같은 함정이 이미 주석으로 있었는데 여기서 또 밟았다.
if (없는경로.length) {
  try {
    const 무시됨 = new Set(
      execSync('git -c core.quotePath=false check-ignore --stdin', { input: 없는경로.join('\n'), encoding: 'utf8' })
        .split('\n').map(x => x.trim()).filter(Boolean));
    없는경로 = 없는경로.filter(c => !무시됨.has(c));
  } catch { /* 전부 추적 대상이면 git 이 exit 1 을 낸다 — 그대로 둔다 */ }
}
if (없는경로.length) { 실패++; 없는경로.forEach(c => console.log(`  🔴 ${c} — 문서가 가리키는데 없다`)); }
else console.log(`  ✅ ${경로들.size}개 경로 전부 실재 (의도적으로 비공개인 것 제외)`);

console.log('\n■ 과장 표현 — 판정이 아니라 검토 목록이다');
// 실제로 이 프로젝트에서 사고를 낸 표현만 남긴다.
// 「최초」「유일」처럼 정당한 서술에도 흔한 단어를 넣으면 목록이 길어져 아무도 안 본다.
const 과장어 = /전부 재현|100%|반드시 잡|완벽하게|사람이 손으로|사람 대 기계|무조건/;
let 과장 = 0;
for (const p of 문서)
  읽기(p).split('\n').forEach((l, i) => {
    if (과장어.test(l) && !l.startsWith('>')) { console.log(`  ·  ${p}:${i + 1}  ${l.trim().slice(0, 78)}`); 과장++; }
  });
if (!과장) console.log('  ✅ 걸린 표현 없음');

console.log('\n■ 하네스 문서 자체 검사 — 규칙마다 검증 수단이 있나');
const H = 'docs/06-작업-하네스.md';
if (!fs.existsSync(H)) console.log(`  –  ${H} 없음`);
else {
  // 「작업별」 절의 규칙 줄만 본다 — 번호 붙은 표 행과 불릿.
  // 표 머리글·구분선·설명 산문은 규칙이 아니다.
  const 줄들 = 읽기(H).split('\n');
  const 시작 = 줄들.findIndex(l => l.startsWith('## 작업별'));
  const 끝 = 줄들.findIndex((l, i) => i > 시작 && l.startsWith('## '));
  const 규칙줄 = 줄들.slice(시작, 끝 < 0 ? 줄들.length : 끝)
    .map((l, i) => ({ l, n: 시작 + i + 1 }))
    .filter(({ l }) => /^\| \d+ \|/.test(l) || /^- /.test(l));
  // 명령·파일을 가리키거나(백틱), 검증 수단이 없음을 ⚠️로 밝혀야 한다
  const 나쁜줄 = 규칙줄.filter(({ l }) => !/`[^`]+`/.test(l) && !l.includes('⚠️'));
  if (나쁜줄.length) {
    실패++;
    console.log('  🔴 검증 수단도 없고 없다는 표시(⚠️)도 없는 규칙 — 지키는지 확인할 방법이 없다');
    나쁜줄.forEach(({ l, n }) => console.log(`        ${n}: ${l.trim().slice(0, 70)}`));
  } else console.log(`  ✅ 규칙 ${규칙줄.length}줄 — 명령을 가리키거나 검증 없음(⚠️)으로 표시됨`);
}

// ── 공개 목록이 실제 추적 상태와 맞나 ──────────────────────────────
// 이 저장소는 공개된다. docs/05가 「공개한다」고 적은 파일이 실제로 안 올라가거나,
// 「공개 안 한다」고 적은 파일이 올라가 있으면 **약속과 실물이 어긋난 것**이다.
// .gitignore 는 **이미 추적 중인 파일에 효력이 없어서** 실제로 두 번 새어 나갔다
// (scored-round2.json · scored-golden.json). 그래서 산문이 아니라 검사로 둔다.
console.log('\n■ 공개 목록 대조 — docs/05 가 적은 것과 git 이 추적하는 것');
{
  const 추적 = new Set(
    execSync('git -c core.quotePath=false ls-files', { encoding: 'utf8' })
      .split('\n').filter(Boolean));
  const [, 공개절, 비공개절] = 읽기('docs/05-공개목록.md')
    .split(/^## (?:공개한다|공개하지 않는다)$/m);
  // 표 행(`|`로 시작)만 본다. 산문에서 파일을 언급하는 것은 목록이 아니다 —
  // 처음엔 절 전체를 훑어서 설명문 속 `.gitignore` 언급까지 목록으로 셌다.
  const 경로들 = t => [...new Set(t.split('\n').filter(l => l.startsWith('| `'))
    .flatMap(l => [...l.matchAll(/`([\w./*-]+)`/g)].map(m => m[1])))]
    .filter(f => /\.\w+$/.test(f) && !f.includes('*'));
  const 어긋남 = [
    ...경로들(공개절).filter(f => !추적.has(f)).map(f => `공개한다고 적었는데 안 올라감: ${f}`),
    ...경로들(비공개절).filter(f => 추적.has(f)).map(f => `공개 안 한다고 적었는데 올라감: ${f}`),
  ];
  if (어긋남.length) { 실패++; 어긋남.forEach(m => console.log('  🔴 ' + m)); }
  else console.log('  ✅ 문서와 실제 추적 목록이 일치');
}

console.log(`\n${실패 ? `🔴 ${실패}개 항목 실패` : `✅ 통과 (숫자 주장 ${검사}종 대조)`}\n`);
process.exit(실패 ? 1 : 0);
