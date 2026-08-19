// 채점 룰. 전부 문자열·산술이라 결정적이다 (D-02).
// 규칙 하나 = 함수 하나. 등록기·클래스 없음 (D-08).
const num = s => Number(String(s).replace(/[^\d.-]/g, ''));

// 1. 마크다운 헤더 뒤 공백 누락 — 렌더러에 따라 헤더로 안 잡힌다
export function 헤더공백(turns) {
  const out = [];
  turns.forEach((t, i) => {
    for (const m of t.body.matchAll(/^#{1,6}[^\s#\n]\S*/gm))
      out.push({ turn: i + 1, 근거: m[0].slice(0, 20) });
  });
  return out;
}

// 2. 내부 용어 노출 — 사용자에게 "문서"는 아무 의미가 없다
export function 내부용어(turns) {
  const out = [];
  turns.forEach((t, i) => {
    for (const m of t.body.matchAll(/문서에는|문서에|문서상/g))
      out.push({ turn: i + 1, 근거: t.body.slice(Math.max(0, m.index - 15), m.index + 20).replace(/\n/g, ' ') });
  });
  return out;
}

// 3. (예시) 꼬리표 휘발 — 앞 턴에서 금리에 (예시)를 붙였는데 뒤 턴에서 뗀다
const RATE = /(?:연\s*)?\d+(?:\.\d+)?\s*%/;
export function 예시휘발(turns) {
  const out = []; let 붙인적 = 0;
  turns.forEach((t, i) => {
    if (!RATE.test(t.body)) return;
    if (/\(예시\)/.test(t.body)) { 붙인적 = i + 1; return; }
    if (붙인적) out.push({ turn: i + 1, 근거: `${붙인적}턴은 (예시) 명시, 이 턴은 없음`,
      금리: (t.body.match(RATE) || [''])[0] });
  });
  return out;
}

// 4. 기준일 없이 금리를 말한다 — 변하는 값에서는 기준일이 곧 근거다
export function 기준일없음(turns) {
  const DATE = /기준\s*[:：]|\d{4}[.\-]\s?\d{1,2}[.\-]\s?\d{1,2}|기준일/;
  const out = [];
  turns.forEach((t, i) => {
    if (RATE.test(t.body) && !DATE.test(t.body))
      out.push({ turn: i + 1, 금리: (t.body.match(RATE) || [''])[0] });
  });
  return out;
}

// 5. 표 안 덧셈 검산 — 「원금 + 이자 = 총액」이 맞는가
export function 표검산(turns) {
  const out = [];
  turns.forEach((t, i) => {
    const rows = [...t.body.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]*[\d,]+[^|]*)\s*\|\s*$/gm)]
      .map(m => ({ 항목: m[1].trim(), 값: num(m[2]) }))
      .filter(r => Number.isFinite(r.값));
    if (rows.length < 3) return;
    const find = re => rows.find(r => re.test(r.항목));
    const 총액 = find(/납부액|총\s*받는|총\s*갚을|합계/);
    if (!총액) return;
    // 이자 행이 여러 개일 수 있다(첫 달 / 마지막 달). 총액 행의 한정어를 맞춰야 한다.
    // S10 5턴: "마지막 달 납부액(원금+이자)" ↔ "마지막 달 내는 이자". 안 맞추면 첫 달을 집는다.
    const 한정 = (총액.항목.match(/^(.*?)(?:납부액|총액|합계|총\s*받는|총\s*갚을)/) || [])[1] || '';
    const 후보 = rows.filter(r => r !== 총액);
    const pick = re => (한정 && 후보.find(r => re.test(r.항목) && r.항목.includes(한정.trim()))) || 후보.find(r => re.test(r.항목));
    const 원금 = pick(/원금/);
    const 이자 = pick(/세후\s*이자/) || pick(/이자/);
    if (!원금 || !이자) return;
    // 한정어가 없으면(총액이 어느 행과 짝인지 모르면) 검산하지 않는다. 추측해서 틀리느니 넘긴다.
    if (!한정.trim() && rows.filter(r => /이자/.test(r.항목)).length > 1) return;
    const 합 = 원금.값 + 이자.값;
    if (합 !== 총액.값)
      out.push({ turn: i + 1, 총액행: 총액.항목, 원금행: 원금.항목, 이자행: 이자.항목,
                 표기: 총액.값, 실제합: 합, 차: 총액.값 - 합 });
  });
  return out;
}

// 6. 공시 범위 밖 수치 — [A]등급으로 확인한 공시만 넣는다. 추측 금지.
const 공시 = [{ 상품: /신용대출|대출/, 하한: 4.53, 상한: 12.82, 출처: '앱 전체탭 공시 2026-08-17' }];
export function 공시범위밖(turns) {
  const out = [];
  turns.forEach((t, i) => {
    for (const g of 공시) {
      if (!g.상품.test(t.body)) continue;
      for (const m of t.body.matchAll(/연\s*(\d+(?:\.\d+)?)\s*%/g)) {
        const v = Number(m[1]);
        if (v < g.하한 || v > g.상한)
          out.push({ turn: i + 1, 값: `연 ${v}%`, 공시: `연 ${g.하한}~${g.상한}%`, 출처: g.출처 });
      }
    }
  });
  return out;
}

export const 전체 = { 헤더공백, 내부용어, 예시휘발, 기준일없음, 표검산, 공시범위밖 };
