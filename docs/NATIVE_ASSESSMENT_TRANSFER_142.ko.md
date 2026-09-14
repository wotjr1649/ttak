# Gap 분류와 부모 재작성에서 추가된 무조건 쓰기 주장 — 142

후보 `0.2.0-rc.13+codex.20260912215200`은 선행 평가의 넓은 feasibility finding을
`gap_review`로 바꾸고, 보류문 검토도 실제 gap 분류에 집중하게 했다. 전체 원문과
요청된 주장 평가, 정상 설명의 fact/final 검증은 유지했다. 집중185, 전체
Node46파일 / 590 PASS / 0 skip, Python78, conformance, 고정 후보 상태 수명주기,
정상 설치·11개 hook 검토는 PASS다.

실제 Haiku 평가에는 141의 잘못된 해결책 목록이 없었고, T1의 읽기는 모든 주어진
schedule에서 B라는 점을 정확히 찾았다. 필수 실측 자료의 부재도 식별했다. 하지만
부모는 보류문의 정정을 만들며 **모든 schedule에서 T1이 B를 보고 A에 쓴다**는
주장을 추가했다. S1의 T2→T1 직렬 순서에서 T1은 B=false를 보고 guard_false가
되며 A는 true로 남는다. 그 실행에서는 T1의 쓰기가 없다. 정적 write target과
실제로 수행된 write를 구분하지 않은 과도한 주장이고, 후속 검토자도 이를 승인했다.

기계 감사는 실제 선행 평가, 보류 검토, 한 번의 전달 교정, 정확한 본문·retained
withheld 상태를 모두 대조해 PASS했다. 의미 판정은 제공된 직렬 schedule 반례로
FAIL이다. `rows/03-claude-unresolved/withholding-audit.json`과 `review.json`에
분리해 기록했다. 이전의 위험 수용 완화책, 전체 초안 요구, 중단 비율 대체를 새
실행의 오류로 잘못 귀속하지 않는다.

## 정산과 다음 수정

Native3/8(상한12), 관리7/7(복원2), 실제Agent2, 완료응답12개 /
**284,154 tokens**, 113,972ms 정상 종료다. 후속5행 UNRUN, 두 프로필 선택과
task-created ON파일2개 원래 부재 상태 복원, 모든 Job 정리·process0을 확인했다.
증거와 캐시는 보존했다. 누적 **950회(Claude569 / Codex381)**, 전체 active /
No-Go다. 현재 코드의 오프라인 비교 계획은 원래192 subjects / 516 requests
(기본88·원본172·TTAK128·채점128)를 재확인했지만 실제 비교는 UNRUN이다.

140과142에서 실제 평가 뒤 부모의 재작성으로 각각 불충분한 지표와 조건 누락이
추가됐다. 143은 독립 평가자가 내놓는 gap·정정을 보류문에 맞는 구조화 데이터로
받고, 부모가 첫 보류안에서 다시 쓰지 않도록 기계적으로 전달한다. 기존 plugin의
formatter와 fresh 보류 검토를 재사용하고 native receipt·원문/hash·실패 보존·
한 번 수정·정확한 Stop 전달은 유지한다. 별도 UI나 runtime으로 우회하지 않는다.
