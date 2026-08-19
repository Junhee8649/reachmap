// 관측 원문에 채점 룰을 돌린다.
//   node tools/score.mjs            → 1라운드
//   node tools/score.mjs 2          → 2라운드
//   node tools/score.mjs 2 --detail → 건별 근거
//
// 회차 단위로 채점한다. 1라운드는 시드당 회차가 하나라 키가 곧 시드이고(S01),
// 2라운드는 같은 시드를 여러 번 돌렸으므로 키에 회차가 들어간다(S01-r2 / S01-r3).
// 합치면 재탕이 회차를 넘나들어 같은 시드를 두 번 물었다는 사실이 재탕으로 잡힌다.
import fs from 'fs';
import { splitTurns, normRec, maskNum, lev, NL } from './lib/parse.mjs';
import { 전체 as 룰 } from './lib/rules.mjs';
import { readCsv } from './lib/csv.mjs';

const ROUND = process.argv.find(a => /^[0-9]+$/.test(a)) ?? '1';
const RAW = `data/raw/round${ROUND}`;
const detail = process.argv.includes('--detail');
if (!fs.existsSync(RAW)) { console.error(`${RAW} 가 없다`); process.exit(1); }

// 전사가 깨진 블록은 문자열 룰에서 뺀다.
// 근거는 매니페스트에 있고 도구가 그것을 읽는다 — 코드에 따로 적으면 두 곳이 어긋난다.
const MANIFEST = `${RAW}/_manifest.json`;
const 제외 = {};
if (fs.existsSync(MANIFEST)) {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  for (const [f, v] of Object.entries(m['파일'] ?? {}))
    if (v['문자열판정제외턴']?.length) 제외[f.replace('.txt', '')] = new Set(v['문자열판정제외턴']);
}

// 링크는 종류가 다르다. 상품 화면으로 보내는 딥링크와 읽을거리는 도달의 의미가 다르다.
const 링크종류 = url =>
  url.includes('onelink.me') ? '딥링크'
  : url.includes('kakaobankcontent.com') ? '웹콘텐츠'
  : '기타';

// 회차별 원문 읽기
const 회차 = {};
for (const f of fs.readdirSync(RAW).filter(x => x.endsWith('.txt')).sort()) {
  const stem = f.replace('.txt', '');
  const key = ROUND === '1' ? stem.split(/[-.]/)[0] : stem;
  const turns = splitTurns(fs.readFileSync(`${RAW}/${f}`, 'utf8'));
  for (const t of turns) t.링크 = t.links.map(l => ({ ...l, 종류: 링크종류(l.url) }));
  (회차[key] ||= []).push(...turns);
}

// 재탕 3층 — T1 완전일치 / T2 숫자만 다름 / T3 근접(판정 아님, 검토 후보)
const T3_MAX = 0.25;
function 재탕(turns) {
  const seen = [], out = { T1: [], T2: [], T3: [] };
  turns.forEach((t, i) => {
    for (const raw of t.recs) {
      const n = normRec(raw), mk = maskNum(raw);
      const ex = seen.find(p => p.n === n);
      const mkEq = seen.find(p => p.mk === mk);
      let best = null, bd = Infinity;
      for (const p of seen) { const d = lev(p.n, n); if (d < bd) { bd = d; best = p; } }
      if (ex) out.T1.push({ turn: i + 1, 문구: raw, 앞턴: ex.turn });
      else if (mkEq) out.T2.push({ turn: i + 1, 문구: raw, 앞턴: mkEq.turn, 앞문구: mkEq.raw });
      else if (best && bd / Math.max(best.n.length, n.length) <= T3_MAX)
        out.T3.push({ turn: i + 1, 문구: raw, 앞턴: best.turn, 앞문구: best.raw,
                      r: +(bd / Math.max(best.n.length, n.length)).toFixed(3) });
      seen.push({ turn: i + 1, raw, n, mk });
    }
  });
  return out;
}

// 시드 메타
// 1라운드는 seeds.csv 를 쓴다. 2라운드에는 seeds.csv 에 없는 시드(S23·S24)가 있으므로
// 분류는 관측 목적, 질문은 1턴 입력을 쓴다 — 없는 것을 추측하지 않는다.
// ponytail: seeds.csv 전 22행이 정확히 5필드라 단순 split로 충분하다. 인용 필드가 생기면 파서를 넣는다
const seedMeta = {};
for (const line of fs.readFileSync('data/seeds.csv', 'utf8').trim().split(NL)) {
  const [id, 분류, 질문] = line.split(',');
  if (id !== 'seed_id') seedMeta[id] = { 분류, 질문 };
}

// CSV에 기록된 관측 — 룰이 못 세는 것이 여기에만 있다.
// 판정(정답/부분/오답/거절)과 딥링크 없는 기능 진입, 그리고 2라운드의 인계·되묻기.
// 판정을 누가 붙였는지는 data/README.md 「누가 무엇을 썼나」 참조.
const 기록 = {}, 메타 = {};
for (const r of readCsv(fs.readFileSync(`data/observations-round${ROUND}.csv`, 'utf8'))) {
  if (!r.앱기능_진입) continue;   // 미기록 행(사전 생성된 빈 행)은 건너뛴다
  const key = ROUND === '1' ? r.seed_id : `${r.seed_id}-r${r.round}`;
  (기록[key] ||= [])[+r.turn - 1] = {
    요약: r.답변요약, 판정: r.판정, 진입: r.앱기능_진입 === 'O', 진입기능: r.진입한_기능명,
    ...(ROUND === '1' ? {} : {
      인계: r.인계여부 === 'O', 기능안내: r.기능안내 === 'O', 되묻기: r.되묻기 === 'O',
      기록딥링크: +r.딥링크_개수,
    }),
  };
  메타[key] ??= ROUND === '1'
    ? seedMeta[r.seed_id]
    : { 분류: r.목적, 질문: r.입력질문 };
}

const 결과 = {};
for (const [key, turns] of Object.entries(회차)) {
  const 뺄턴 = 제외[key] ?? new Set();
  const 룰입력 = turns.map((t, i) => (뺄턴.has(i + 1) ? { ...t, body: '' } : t));
  const r = {
    턴수: turns.length,
    딥링크: turns.map(t => t.링크.filter(l => l.종류 === '딥링크').length),
    링크수: turns.map(t => t.링크.length),
    재탕: 재탕(룰입력),
    턴: turns.map((t, i) => ({
      본문: t.body, 추천: t.recs, 링크: t.링크,
      ...(뺄턴.has(i + 1) ? { 판정제외: true } : {}),
      ...(기록[key]?.[i] ?? {}),
    })),
  };
  for (const [name, fn] of Object.entries(룰)) r[name] = fn(룰입력);
  결과[key] = { ...메타[key], ...r };
}

const 합 = k => Object.values(결과).reduce((a, r) => a + (Array.isArray(r[k]) ? r[k].length : 0), 0);
const 걸린회차 = k => Object.entries(결과).filter(([, r]) => r[k]?.length).map(([s]) => s);

const 총턴 = Object.values(결과).reduce((a, r) => a + r.턴수, 0);
console.log(`\n${ROUND}라운드 — ${Object.keys(결과).length}개 회차 / ${총턴}턴\n`);
const 뺀개수 = Object.values(제외).reduce((a, s) => a + s.size, 0);
if (뺀개수) console.log(`문자열 룰에서 뺀 턴 ${뺀개수}개 — 전사가 깨진 이관 블록 (${MANIFEST})\n`);
console.log('룰            검출  걸린 회차');
console.log('─'.repeat(74));
for (const k of Object.keys(룰))
  console.log(`${k.padEnd(12)} ${String(합(k)).padStart(4)}   ${걸린회차(k).join(' ') || '-'}`);
const t = ['T1', 'T2', 'T3'].map(x => Object.values(결과).reduce((a, r) => a + r.재탕[x].length, 0));
console.log(`${'재탕 T1'.padEnd(12)} ${String(t[0]).padStart(4)}   완전일치`);
console.log(`${'재탕 T2'.padEnd(12)} ${String(t[1]).padStart(4)}   숫자만 다름(파라미터 순열)`);
console.log(`${'재탕 T3'.padEnd(12)} ${String(t[2]).padStart(4)}   근접 — 판정 아님, 사람이 볼 후보`);

const 딥 = Object.values(결과).reduce((a, r) => a + r.딥링크.filter(n => n).length, 0);
const 링 = Object.values(결과).reduce((a, r) => a + r.링크수.filter(n => n).length, 0);
console.log(`\n딥링크가 붙은 턴 ${딥} / 링크가 하나라도 붙은 턴 ${링} / 전체 ${총턴}`);

if (detail) for (const [key, r] of Object.entries(결과)) {
  const hits = Object.keys(룰).filter(k => r[k].length);
  if (!hits.length && !r.재탕.T1.length) continue;
  console.log(`\n━━ ${key} ━━`);
  for (const k of hits) r[k].forEach(x => console.log(`  ${k}  ${JSON.stringify(x, null, 0)}`));
  r.재탕.T1.forEach(x => console.log(`  재탕T1  ${x.turn}턴 ← ${x.앞턴}턴  "${x.문구}"`));
}

fs.writeFileSync(`data/scored-round${ROUND}.json`, JSON.stringify(결과, null, 1));
console.log(`\n→ data/scored-round${ROUND}.json 저장`);

// ── 공개본 ────────────────────────────────────────────────────────────
// 카카오뱅크 AI 답변 원문 전량은 공개하지 않는다 (재배포가 된다).
// 대신 ① 우리가 쓴 요약 ② 룰이 잡은 자리 앞뒤 120자 발췌만 담는다.
// 추천 문구는 재탕 분석의 대상 자체이고 짧으므로 그대로 싣는다.
// 필요한 문맥의 폭은 룰마다 다르다.
// 헤더공백은 「##✅」라는 표기 자체가 증거라 주변 문장이 필요 없고,
// 내부용어의 근거는 이미 앞뒤가 잘린 상태로 저장돼 있다.
// 숫자를 다루는 룰만 문장 단위 문맥이 있어야 읽힌다.
const PAD = { 헤더공백: 15, 내부용어: 0, 예시휘발: 60, 기준일없음: 60, 표검산: 60, 공시범위밖: 60 };

// 히트마다 창을 따로 뜨면 창끼리 겹쳐 같은 문장이 여러 번 실린다.
// 범위를 먼저 합친 뒤 한 번만 잘라낸다.
function 발췌들(body, hits) {
  const 범위 = [];
  for (const h of hits) {
    const key = [h.근거, h.금리, h.값, h.총액행].find(k => k && body.includes(k));
    if (!key) continue;
    const at = body.indexOf(key), pad = PAD[h.룰] ?? 60;
    범위.push([Math.max(0, at - pad), Math.min(body.length, at + key.length + pad)]);
  }
  범위.sort((a, b) => a[0] - b[0]);
  const 합친 = [];
  for (const [s, e] of 범위) {
    const last = 합친[합친.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else 합친.push([s, e]);
  }
  return 합친.map(([s, e]) =>
    (s > 0 ? '…' : '') + body.slice(s, e).trim() + (e < body.length ? '…' : ''));
}

const 공개 = {};
for (const [key, r] of Object.entries(결과)) {
  공개[key] = {
    분류: r.분류, 질문: r.질문, 턴수: r.턴수, 딥링크: r.딥링크, 링크수: r.링크수, 재탕: r.재탕,
    ...Object.fromEntries(Object.keys(룰).map(k => [k, r[k]])),
    턴: r.턴.map((t, i) => {
      const { 본문, ...나머지 } = t;
      return {
        ...나머지,
        발췌: 발췌들(본문, Object.keys(룰).flatMap(k => r[k].filter(h => h.turn === i + 1).map(h => ({ ...h, 룰: k })))),
      };
    }),
  };
}
fs.writeFileSync(`data/scored-round${ROUND}.public.json`, JSON.stringify(공개, null, 1));

const 원문길이 = Object.values(결과).reduce((a, r) => a + r.턴.reduce((b, t) => b + t.본문.length, 0), 0);
const 발췌길이 = Object.values(공개).reduce((a, r) => a + r.턴.reduce((b, t) => b + t.발췌.join('').length, 0), 0);
console.log(`→ data/scored-round${ROUND}.public.json 저장 (원문 ${원문길이.toLocaleString()}자 → 발췌 ${발췌길이.toLocaleString()}자)`);
