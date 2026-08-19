"""관측 144턴을 카카오뱅크 AI 피드백 UI의 분류 체계로 재집계한다.

왜 있나 (D-13):
  담당업무 「AI 고객 피드백 모니터링」을 채우려고 앱 스토어 리뷰를 모으려 했으나
  두 스토어 모두 robots.txt로 리뷰 수집을 금지하고 있어 접었다.
  대신 앱 안의 피드백 UI가 쓰는 분류 3개를 기준으로 우리 관측을 재집계한다.

  싫어요 → 바텀 모달 3개
    ① 답변 내용이 정확하지 않음
    ② 설명이 부족함
    ③ 질문과 다른 내용을 답변함

  이 3개는 전부 「답변」에 대한 것이다. 추천 질문과 도달에 대한 칸은 없다.
  그 공백을 세는 것이 이 스크립트의 목적이다.

  ⚠️ 우리가 재는 것은 「사용자가 신고했다면 어느 칸이었을까」이지 실제 신고가 아니다.

  실행:  python tools/feedback.py
  출력:  data/feedback-map.json  (집계만. 원문은 로컬에 둔다)
"""
import json
import sqlite3
import sys
from pathlib import Path

# 윈도우 콘솔 기본이 cp949라 한글·기호 출력이 막힌다. 파일 입출력은 이미 utf-8 고정.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

# 룰 → 피드백 칸. 사전에 고정한다. 집계를 보고 고치면 결론을 맞춰 쓰는 것이 된다.
# '없음'은 세 칸 어디에도 신고할 수 없다는 뜻이고, 그것 자체가 이 집계의 결과다.
RULE_BUCKET = {
    "표검산":     "① 답변 내용이 정확하지 않음",
    "공시범위밖": "① 답변 내용이 정확하지 않음",
    "기준일없음": "② 설명이 부족함",
    "예시휘발":   "② 설명이 부족함",
    "내부용어":   "② 설명이 부족함",
    "헤더공백":   "없음 — 표시 문제",
}
RULES = list(RULE_BUCKET)


def load_turns(conn):
    """채점 결과 두 라운드를 턴 단위로 편다."""
    turns, hits = [], []
    for rnd in (1, 2):
        path = ROOT / f"data/scored-round{rnd}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for key, run in data.items():
            for i, t in enumerate(run["턴"]):
                if not t.get("판정"):        # 이관 등으로 기록이 없는 턴
                    continue
                turn_no = i + 1
                turns.append((
                    rnd, key, turn_no, run.get("분류"), t["판정"],
                    1 if t.get("진입") else 0,
                    run["딥링크"][i], len(t.get("추천", [])),
                ))
                for rule in RULES:
                    for h in run[rule]:
                        if h["turn"] == turn_no:
                            hits.append((rnd, key, turn_no, rule, RULE_BUCKET[rule]))
            # 재탕은 턴이 아니라 추천 문구 단위다
            for tier in ("T1", "T2"):
                for h in run["재탕"][tier]:
                    hits.append((rnd, key, h["turn"], f"재탕{tier}", "없음 — 추천 질문 문제"))

    conn.executescript("""
        CREATE TABLE turn(
          round INT, run TEXT, turn INT, category TEXT, verdict TEXT,
          entered INT, deeplinks INT, recs INT);
        CREATE TABLE hit(
          round INT, run TEXT, turn INT, rule TEXT, bucket TEXT);
    """)
    conn.executemany("INSERT INTO turn VALUES(?,?,?,?,?,?,?,?)", turns)
    conn.executemany("INSERT INTO hit  VALUES(?,?,?,?,?)", hits)
    return len(turns), len(hits)


QUERIES = {
    "피드백_칸별_결함": """
        SELECT bucket, COUNT(*) AS 건수, COUNT(DISTINCT round||run||turn) AS 턴수
        FROM hit GROUP BY bucket ORDER BY 건수 DESC
    """,
    "사용자가_못_잡는_결함": """
        SELECT t.verdict AS 판정,
               COUNT(DISTINCT t.round||t.run||t.turn) AS 턴수,
               SUM(CASE WHEN h.turn IS NOT NULL THEN 1 ELSE 0 END) AS 결함건수
        FROM turn t
        LEFT JOIN hit h ON h.round=t.round AND h.run=t.run AND h.turn=t.turn
        GROUP BY t.verdict ORDER BY 턴수 DESC
    """,
    "라운드별_턴당_결함": """
        SELECT t.round AS 라운드, COUNT(DISTINCT t.run||t.turn) AS 턴,
               (SELECT COUNT(*) FROM hit h WHERE h.round=t.round) AS 결함,
               ROUND(1.0*(SELECT COUNT(*) FROM hit h WHERE h.round=t.round)
                     / COUNT(DISTINCT t.run||t.turn), 2) AS 턴당
        FROM turn t GROUP BY t.round
    """,
    "도달_분포": """
        SELECT CASE WHEN deeplinks>0 THEN '딥링크 있음' ELSE '딥링크 0' END AS 도달,
               COUNT(*) AS 턴수,
               ROUND(100.0*COUNT(*)/(SELECT COUNT(*) FROM turn), 1) AS 비율
        FROM turn GROUP BY 도달
    """,
}


def main():
    conn = sqlite3.connect(":memory:")
    n_turn, n_hit = load_turns(conn)
    print(f"\n관측 {n_turn}턴 / 결함 {n_hit}건 — SQLite 인메모리로 적재\n")

    out = {"턴수": n_turn, "결함수": n_hit, "매핑": RULE_BUCKET, "집계": {}}
    for name, sql in QUERIES.items():
        rows = conn.execute(sql).fetchall()
        cols = [d[0] for d in conn.execute(sql).description]
        print(f"■ {name}")
        print("  " + " | ".join(c.ljust(22 if i == 0 else 8) for i, c in enumerate(cols)))
        for r in rows:
            print("  " + " | ".join(str(v).ljust(22 if i == 0 else 8) for i, v in enumerate(r)))
        print()
        out["집계"][name] = [dict(zip(cols, r)) for r in rows]

    # 신고할 칸이 없는 결함의 비중 — 이 스크립트의 핵심 숫자
    없음 = conn.execute(
        "SELECT COUNT(*) FROM hit WHERE bucket LIKE '없음%'").fetchone()[0]
    print(f"■ 세 칸 어디에도 신고할 수 없는 결함  {없음} / {n_hit}"
          f"  ({100*없음/n_hit:.0f}%)")
    # 헤더공백 하나가 전체의 절반이라 위 비율이 그것에 좌우된다.
    # 그 룰을 빼고도 결론이 서는지 같이 낸다 — 안 내면 숫자를 부풀린 셈이 된다.
    없음2, 전체2 = conn.execute("""
        SELECT SUM(CASE WHEN bucket LIKE '없음%' THEN 1 ELSE 0 END), COUNT(*)
        FROM hit WHERE rule <> '헤더공백'
    """).fetchone()
    print(f"  헤더공백을 빼면              {없음2} / {전체2}"
          f"  ({100*없음2/전체2:.0f}%)")
    out["신고불가_결함"] = {
        "건수": 없음, "전체": n_hit,
        "헤더공백_제외": {"건수": 없음2, "전체": 전체2},
    }

    path = ROOT / "data/feedback-map.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n→ {path.relative_to(ROOT)} 저장")


if __name__ == "__main__":
    main()
