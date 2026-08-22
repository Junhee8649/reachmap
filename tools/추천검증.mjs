// 우리가 쓴 추천 문구에 「답할 문서」가 실제로 있는지 검증한다.
//
// 왜 있나: 추천 문구를 쓰는 것만으로는 아이디어에 불과하다. 담당업무는
//   「AI로 **연결되는** 선제안/추천 질문 콘텐츠 운영」이므로, 그 문구를 눌렀을 때
//   답할 문서가 있어야 연결이 성립한다. 그걸 기계로 확인한다.
//
// ⚠️ 확인할 수 있는 것은 본문을 가진 묶음뿐이다. 제목만 있는 주제는 검색이 불가능해
//    `본문없음`으로 표시하고 검증하지 않는다. 없는 것을 있는 척하지 않는다.
//
//   node tools/추천검증.mjs
import fs from 'fs';
import { readCsv } from './lib/csv.mjs';

const 후보 = readCsv(fs.readFileSync('data/rag/추천문구-후보.csv', 'utf8'));
const 결과 = JSON.parse(fs.readFileSync('data/rag/result-적금-v2.json', 'utf8'));

// 검색 점수는 rag.mjs 와 같은 방식으로 다시 계산한다 (문자 bigram TF-IDF)
const 정규화 = s => s.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
const bigram = s => { const t = 정규화(s), o = []; for (let i = 0; i < t.length - 1; i++) o.push(t.slice(i, i + 2)); return o; };
const 문서 = Array.from({ length: 16 }, (_, i) => {
  const t = fs.readFileSync(`data/rag/docs-v2-적금/E${i + 1}.md`, 'utf8').trim();
  return { id: `E${i + 1}`, 제목: t.split('\n')[0].replace(/^#\s*/, ''), 전문: t };
});
const df = new Map();
const tfs = 문서.map(d => {
  const tf = new Map();
  for (const g of bigram(d.전문)) tf.set(g, (tf.get(g) ?? 0) + 1);
  for (const g of tf.keys()) df.set(g, (df.get(g) ?? 0) + 1);
  return tf;
});
const idf = g => Math.log((문서.length + 1) / ((df.get(g) ?? 0) + 1)) + 1;
const vec = tf => {
  const v = new Map();
  for (const [g, n] of tf) v.set(g, (1 + Math.log(n)) * idf(g));
  const norm = Math.hypot(...v.values()) || 1;
  for (const [g, x] of v) v.set(g, x / norm);
  return v;
};
const 문서벡터 = tfs.map(vec);
const 질의벡터 = q => { const tf = new Map(); for (const g of bigram(q)) tf.set(g, (tf.get(g) ?? 0) + 1); return vec(tf); };
const 코사인 = (a, b) => { let s = 0; const [작, 큰] = a.size < b.size ? [a, b] : [b, a]; for (const [k, v] of 작) s += v * (큰.get(k) ?? 0); return s; };

console.log('\n■ 추천 문구가 답할 문서에 닿는가 — 적금 묶음 16건 기준\n');
let 통과 = 0, 검증대상 = 0, 미검증 = 0;
for (const r of 후보) {
  if (r.검증 !== '적금묶음') { 미검증++; continue; }
  검증대상++;
  const qv = 질의벡터(r.문구);
  const 순위 = 문서.map((d, i) => ({ id: d.id, s: 코사인(qv, 문서벡터[i]) })).sort((a, b) => b.s - a.s);
  const 기대 = r.기대도착;
  const 맞음 = 기대.startsWith('E') ? 순위[0].id === 기대 : null;
  if (맞음) 통과++;
  const 표 = 맞음 === null ? '–' : (맞음 ? '✅' : '🔴');
  console.log(`${표} ${r.문구}`);
  console.log(`     기대 ${기대.padEnd(4)} → 1위 ${순위[0].id} (${순위[0].s.toFixed(3)}) · 2위 ${순위[1].id} (${순위[1].s.toFixed(3)})`);
}
console.log(`\n검증한 문구 ${검증대상}개 중 기대 문서를 1위로 뽑은 것 ${통과}개`);
console.log(`본문이 없어 검증하지 못한 문구 ${미검증}개 — 제목만 수집한 주제다`);
