// 공개본을 읽는다 — 카카오뱅크 AI 답변 원문 전량은 싣지 않는다.
// 여기 담긴 것은 ① 원문을 읽고 쓴 요약 ② 룰이 잡은 자리 주변 발췌뿐이다.
// 전문판(data/scored-*.json)은 로컬 채점용이며 커밋하지 않는다.
//
// 관측은 두 종류다. 전제가 다르므로 데이터도 도구도 나눠 뒀다.
//   ① 추천 질문 경로 — 첫 번째 추천만 따라가며 5턴. 회차 1·2. 총 144턴
//   ② 골든셋       — 문항마다 대화를 초기화한 1턴짜리 독립 관측. 60문항
import r1 from '../data/scored-round1.public.json'
import r2 from '../data/scored-round2.public.json'
import gd from '../data/scored-golden.public.json'
// 파생 수치는 손으로 적지 않는다. tools/summary.mjs 가 원본에서 계산해 떨어뜨린 것만 쓴다.
import summary from '../data/summary.json'

export const RULES = ['헤더공백', '내부용어', '예시휘발', '기준일없음', '표검산', '공시범위밖'] as const
/**
 * 🔴 헤더공백은 여기 없다. 결함이 아니기 때문이다.
 *
 * 처음에는 6종을 한 덩어리로 세어 「결함 227건」이라고 썼다. 검증해보니 절반 이상이 헤더공백이었고,
 * 그것은 **앱에서 제목으로 정상 렌더된다**(관측자 직접 확인 · tools/feedback.py 머리말).
 * CommonMark 기준으로는 `##제목` 이 헤더가 아니지만 이 앱의 렌더러가 관대하다 —
 * 즉 모델이 낸 마크다운이 비표준인 것은 사실이나 **사용자에게는 보이지 않는다.**
 *
 * 탐지는 tools/lib/rules.mjs 에 그대로 남겨 둔다. 지우면 문서가 말하는 130건을 아무도 재현할 수 없다.
 * 화면에서만 뺀다 — 결함이 아닌 것을 결함 옆에 두면 눈금을 먹고, 실제 발견(내부용어 1·표검산 1)이 안 보인다.
 */
export const 결함룰 = ['기준일없음', '예시휘발', '공시범위밖', '내부용어', '표검산'] as const
export type RuleName = (typeof RULES)[number]

/** 룰이 잡은 한 건. 룰마다 붙는 필드가 달라 전부 옵셔널이다 */
export type Hit = {
  turn: number
  근거?: string
  금리?: string
  값?: string; 공시?: string; 출처?: string
  총액행?: string; 원금행?: string; 이자행?: string; 표기?: number; 실제합?: number; 차?: number
}
export type Rehash = { turn: number; 문구: string; 앞턴: number; 앞문구?: string; r?: number }
export type Link = { title: string; url: string }
export const 판정들 = ['정답', '부분', '오답', '거절'] as const
export type 판정 = (typeof 판정들)[number]
/** 추천·링크·발췌는 원문에서 기계로 뽑은 것, 요약·판정·진입은 CSV에 기록된 것이다 */
export type Turn = {
  요약: string
  발췌: string[]
  추천: string[]
  링크: Link[]
  판정: 판정
  진입: boolean
  진입기능: string
}

export type Seed = {
  분류: string
  질문: string
  턴수: number
  딥링크: number[]
  재탕: Record<'T1' | 'T2' | 'T3', Rehash[]>
  턴: Turn[]
} & Record<RuleName, Hit[]>

/** 회차를 붙여 하나로 합친다. 2라운드 키는 `S01-r2` 처럼 회차가 이미 들어 있다 */
export type Run = Seed & { id: string; 회차: 1 | 2 }
const 합 = (o: object, 회차: 1 | 2): Run[] =>
  Object.entries(o).map(([id, s]) => ({ ...(s as Seed), id, 회차 }))

export const runs: Run[] = [...합(r1, 1), ...합(r2, 2)]
export const seeds = Object.fromEntries(runs.map(r => [r.id, r])) as Record<string, Run>
export const ids = runs.map(r => r.id)

const 모든턴 = runs.flatMap(s => s.턴)

export const 총턴 = runs.reduce((a, s) => a + s.턴수, 0)
export const 회차턴 = (n: 1 | 2) => runs.filter(r => r.회차 === n).reduce((a, s) => a + s.턴수, 0)
/** 기록 기준 — 딥링크 카드 + 딥링크 없는 기능 진입까지 포함 */
export const 도달턴 = 모든턴.filter(t => t.진입).length
/** 룰이 원문에서 직접 센 것. 도달턴과의 차이가 곧 이 도구의 한계다 */
export const 딥링크턴 = 모든턴.filter(t => t.링크.length > 0).length
export const 딥링크없는진입 = 모든턴.filter(t => t.진입 && !t.링크.length).map(t => t.진입기능)
export const 판정합 = Object.fromEntries(
  판정들.map(p => [p, 모든턴.filter(t => t.판정 === p).length]),
) as Record<판정, number>
export const 룰합 = Object.fromEntries(
  RULES.map(r => [r, runs.reduce((a, s) => a + s[r].length, 0)]),
) as Record<RuleName, number>
/** 결함으로 세는 것만 합한다 */
export const 결함합 = 결함룰.reduce((a, r) => a + 룰합[r], 0)

export const 재탕합 = { T1: 0, T2: 0, T3: 0 }
for (const s of runs) for (const k of ['T1', 'T2', 'T3'] as const) 재탕합[k] += s.재탕[k].length

export const 룰히트 = (s: Seed, turn: number) =>
  RULES.flatMap(r => s[r].filter(h => h.turn === turn).map(h => ({ 룰: r, ...h })))

export const 시드룰수 = (s: Seed) => RULES.reduce((a, r) => a + s[r].length, 0)

// ── 골든셋 ──────────────────────────────────────────────────────────
export type Golden = {
  q_id: string
  분류: string
  기대유형: string
  질문: string
  판정: string
  근거표시: string; 한계고지: string; 되묻기: string; 인계여부: string
  메모: string
  정답기준: string
  추천: string[]
  링크: Link[]
  히트: ({ 룰: RuleName } & Hit)[]
  발췌: string[]
}
export const golden = gd as unknown as Golden[]

export const 골든판정 = golden.reduce<Record<string, number>>(
  (a, g) => ((a[g.판정 || '-'] = (a[g.판정 || '-'] ?? 0) + 1), a), {})
/** 분류별 링크 도달률 — 골든셋에서 가장 갈리는 축이다 */
export const 골든도달 = Object.entries(
  golden.reduce<Record<string, { n: number; l: number }>>((a, g) => {
    const v = (a[g.분류] ??= { n: 0, l: 0 })
    v.n++; if (g.링크.length) v.l++
    return a
  }, {}),
).sort((a, b) => a[1].l / a[1].n - b[1].l / b[1].n)

// ── tools/summary.mjs 산출물 ────────────────────────────────────────
type 세기 = { n: number; 원본: number; 재작성: number }
export type RagMuk = { 이름: string; 제목: 세기; 추천: 세기; 작성용: 세기 | null; 검증용: 세기 | null }
export const rag = summary.rag as RagMuk[]
export const 재현 = summary.재현 as {
  시드: string; 회차: string; 질문: string
  추천같음: boolean; 링크같음: boolean; 판정같음: boolean
}[]
export const 안내 = summary.안내 as { O: number; X: number; 해당없음: number }
export const 인계 = summary.인계 as string[]
