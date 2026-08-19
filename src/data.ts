// 공개본을 읽는다 — 카카오뱅크 AI 답변 원문 전량은 싣지 않는다.
// 여기 담긴 것은 ① 원문을 읽고 쓴 요약 ② 룰이 잡은 자리 주변 발췌뿐이다 (원문의 16%).
// 전문판 data/scored-round1.json 은 로컬 채점용이며 커밋하지 않는다.
import raw from '../data/scored-round1.public.json'

export const RULES = ['헤더공백', '내부용어', '예시휘발', '기준일없음', '표검산', '공시범위밖'] as const
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
/** 추천·링크·발췌는 원문에서 기계로 뽑은 것, 요약·판정·진입은 CSV에 기록된 것이다 (누가 썼는지는 data/README.md 참조) */
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

export const seeds = raw as unknown as Record<string, Seed>
export const ids = Object.keys(seeds).sort()

const all = ids.map(id => seeds[id])

const 모든턴 = all.flatMap(s => s.턴)

export const 총턴 = all.reduce((a, s) => a + s.턴수, 0)
/** 기록 기준 — 딥링크 카드 + 딥링크 없는 기능 진입까지 포함 */
export const 도달턴 = 모든턴.filter(t => t.진입).length
/** 룰이 원문에서 직접 센 것. 도달턴보다 3 적고, 그 3건이 곧 이 도구의 한계다 */
export const 딥링크턴 = 모든턴.filter(t => t.링크.length > 0).length
export const 딥링크없는진입 = 모든턴.filter(t => t.진입 && !t.링크.length).map(t => t.진입기능)
export const 판정합 = Object.fromEntries(
  판정들.map(p => [p, 모든턴.filter(t => t.판정 === p).length]),
) as Record<판정, number>
export const 룰합 = Object.fromEntries(
  RULES.map(r => [r, all.reduce((a, s) => a + s[r].length, 0)]),
) as Record<RuleName, number>
export const 재탕합 = { T1: 0, T2: 0, T3: 0 }
for (const s of all) for (const k of ['T1', 'T2', 'T3'] as const) 재탕합[k] += s.재탕[k].length

export const 룰히트 = (s: Seed, turn: number) =>
  RULES.flatMap(r => s[r].filter(h => h.turn === turn).map(h => ({ 룰: r, ...h })))

export const 시드룰수 = (s: Seed) => RULES.reduce((a, r) => a + s[r].length, 0)
