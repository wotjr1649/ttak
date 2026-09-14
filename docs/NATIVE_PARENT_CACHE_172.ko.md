# 정상 Codex parent cache·recipe172

목표는 기존 H1–H3/Q1–Q2와 원래192 subjects/516 requests를 포함한 전체 출하 Go다.
이 배치는 **No-Go, CLOSED/RESTORED**다. 개별 참조/조회 통과로 목표를 완료하지 않는다.

## 후보와 로컬 경계

`0.2.0-rc.13+codex.20260913154054` / `ttak-cache172`, runtime34파일이다.
선택적인 actual wait receipt 대조, 같은 candidate/packet/TTL의 단일 parent cache 전달,
Codex의 기존 current final 참조, compact binding·latest previous 보관을 구현했다.
선행 assessment는 실제 결과 조회 뒤 normal fact 경로를 지나도 재사용할 수 있다.
legacy explicit 전달·기존 compiler recipe와 실제 native Pre/Post·hash·본문 한도·Stop은
유지했다. cache와 assertion은 native 승인 근거가 아니다.

집중26files292PASS/0skip, Node75files788PASS/0skip(73292ms), Python79(3990ms),
conformance179ms PASS다. helper12검사·27구문·skill/marketplace·로컬 resume PASS다.
generic validator의 기존 per-host MCP 경로 비호환은 UNRUN이며 과거 FAIL을 보존한다.
freeze helper의 누적 치환이 파일 크기 상수에 닿은 실수를 설치 전에 복구했고, source/frozen
34파일을 원래1048576 한도·해시로 재검사했다. 새 candidate의 제한 완화는 없다.

공식 default cachebuster와 정상 등록/설치를 사용했다. installed34파일·11hook의 정확한
경로/명령/hash 검토 후 후보에만 신뢰를 적용했고 양쪽 정상 활성화가 통과했다.

## 실제 Codex calibration

parent `01a09b71-dcf5-74f3-a3e3-588e28c05317`,
attempt `3c4a0558-dd84-4154-b8ba-ac73734a59fc`,
candidate digest `7a1c4b5d574b2e301b259f1264c1985d65ea81d8c580da702c08ced98e8ef37a`.

실제 fact verifier는 읽기7,7·최종 저장7을 answered로 확정했다. 부모는 최초 오류안을
수정하지 않고 `request:"current",facts:"current"`로 final 등록했다. normal Pre/Post와
frozen compiler replay는 원문·actual fact·순서가 일치함을 검증했다. 최초 final은 읽기가
저장값을0으로 바꾼다는 원문 구절을 정확히 인용해 withheld했고, 실제 native 결과 조회가
완료됐다. 두 제출 모두 current→정확한64자리 challenge의 실제 normal Pre 대조를 통과했다.

그러나 부모는 제공된 연결 final recipe를 사용하지 않았다. 전체6개 code 호출 중 final
등록465bytes와 dispatch/wait/read1663bytes가 별도였다. fact 단계에서 final delivery
대조를 뺀1663-byte 프로그램을 final에도 재사용했다. 아직 complete final은 없으므로
그 누락이 정상 완료를 허용했다고 주장하지 않는다. guard·Stop 우회 증거도 없다.
제공 recipe의 정적 spawn2559→2013/final3324→2770bytes 감소는 실제 시간 개선이 아니다.

native 기록의 call/output timestamp 차이는 fact19109ms, fact 응답→등록8845ms,
등록 응답→dispatch9425ms, 최초 final31023ms다. 이는 해당 기록의 시간 차이이며
전체 차이를 코드 생성이나 특정 처리 비용으로 단정하지 않는다. owning Job는120010ms에
timeout됐고 retained state는 pending/FINAL0 returned-withheld/revision0이다.
정정본 등록·세 번째 verifier·정정 판정/조회·완료 전달·parent Stop은 모두 UNRUN이다.
두 child는 실제 completed/waited/closed이고 소유 Job 정리/active process0을 확인했다.
이 Job 종료는 native interrupt/cancel/resume 검증을 대신하지 않는다.

항목 연결 문제도 남았다. `computed_outcomes`와 `internal_consistency`는 fact-review
검사인데, 올바른7,7,7 fact 답변이 아니라 최종문에만 있는 mutation 결함의 issue0을 가리켰다.
전체 withheld 이유는 타당하지만 모든 보고 항목의 정확도는 통과가 아니다.

## 회계·복원과 다음 조사

새 배정 native12/관리8(복원2)/내부 ceiling88, 동시성1을 유지했다. 실제 native3,
관리8(복원2), 내부 verifier2, 완료 모델 응답11(parent7/child2+2), **226854 tokens**
(input222193/output4661/thinking2804는 output의 부분집합)다. checkpoint parent175022와
완료 native parent175022가 일치한다. timeout 이후 미보고 in-flight 사용량 가능성은 남긴다.
후속9행 UNRUN, 누적1054(Claude629/Codex425)다. 171의 실패·미배정량을 재사용하지 않았다.

두 프로필의 baseline 선택을 정상 복원하고 후보를 비활성화했다. 이 배치가 만든 ON 상태
파일2개만 부재로 복원했으며 원래 없던 시험 상태라 재생성 가능하다. native 원본·cache·
검증 근거는 보존했다. 세션 중간 OFF로 주입 내용을 제거하는 기능/시험은 하지 않았다.

근거는 `.superpowers/release-loop-172/rows/03-codex-calibration/failure-audit.json`
(SHA256 `a791af316f1c252784d0bb3c16ebe8db68df13e54764d4775278a954aa5154b7`) 및
`batch-closed.json`이다. frozen 코드로 실제 native 단계/결과를 replay해 retained attempt와
일치시켰고, 독립 verifier2회·actual reads2회와 complete/Stop 부재를 검사했다.

다음은 현재 필요한 분기의 recipe를 실제 결과 조회 지점에서 전달하는 구조 조사다.
모든 recipe를 준비 단계에 모아두고 다음 결과에는 제공하지 않는 현 구조에서, 부모가
등록과 실행을 다시 나눴다는 새 근거를 사용한다. 단순 문구 추가나 timeout 확대가 아니라
결과와 다음 실행 경로의 결합을 검토한다. 범위·한도·native 근거를 보존한 로컬 정상/반례와
새 고정 후보가 있어야 다음 배정을 한다. 원래192/516과 모든 출하 조건은 여전히 미완료다.
