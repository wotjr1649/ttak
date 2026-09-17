# 정상 recipe 축약과 code-mode 양도175

목표는 기존 H1–H3/Q1–Q2·192 subjects/516 requests와 모든 출하 조건을 만족한 Go다.
175는 **No-Go, CLOSED/RESTORED**이며 목표는 active다.

## 변경·검증

후보 `0.2.0-rc.13+codex.20260913171818` / `ttak-short175`, runtime34파일이다.
normal Codex의 정적 recipe에서 긴 지역 변수·반복 바인딩과 검사를 표현하는 중복을
줄였다. 같은 오류를 던지는 check 함수를 썼고 호출 명칭·수·순서, native wait/finally/
close, receipt/result/packet/next_step/delivery 조건과 model_evidence 선행 검사는 유지했다.
새 도구·동적 eval·MCP 내부 모델 실행은 없다. Claude·assessment/notice·legacy compiler와
동일 binding의 verifier packet은174와 같다. shared skill은 이번에 변경하지 않았다.

174/175 정적 프로그램을 같은 실제 MCP·합성 native transport에서 실행한 동등성 및
경계 검사가 **47PASS/0skip/8814ms**다. 정상·unresolved/conflict·model_evidence,
준비/dispatch 변조, wait/close/read 오류, result challenge/kind 및 delivery 원문/범위/부재,
빈 교정·revision1에서 호출·오류·보관·출력이 동일했다. model 의미/latency 검사는 아니다.
전체 **Node77files807PASS/0skip/74007ms, Python79/3681ms, conformance187ms**,
helper12검사/28구문·skill/marketplace·로컬 resume PASS다. generic validator의 기존
per-host MCP 경로 비호환은 UNRUN이다. 공식 cachebuster와 정상 설치·11hook hash 대조 후
양쪽 ON 활성화를 확인했다.

정적 bytes는 spawn2188→1722, 전체 final2945→2323, entry3569→2839다.
이 크기 감소가 실제 전체 시간을 개선했다고 주장하지 않는다.

## 실제 결과와 새 원인

parent `01a09bc9-7bea-70e1-9e62-f86e190770de`,
attempt `d6d9205f-fd45-423c-9494-382f10c1fd13`,
candidate digest `6528297e88756b3d46e037f5995bfe010ed5d2ea292a83528d5d8f66d2a723ac`.
부모는 trailing newline 외에 동일한 entry를 사용했다. fact는 두 read7·저장7을
올바르게 도출했고 실제 조회가 통과했다. 최초 오류안은 그대로 final에 등록했으나,
전체 연결 recipe 대신 등록과 spawn을 별도 call로 나눴다. spawn에는 모든 검사가 남아
있었고 오류 label 하나만 짧았다. 실제 final은 원문을 정확히 인용해 withheld했다.
fact-review의 computed_outcomes/internal_consistency가 final-only 결함을 연결한 문제는 OPEN이다.

첫 final 실행의 **31026ms 응답은 완료가 아닌 `Script running with cell ID 5`**였다.
부모가3740ms 뒤 `wait`를 호출했고,4823ms 뒤 실제 correct_final 결과를 받았다.
그 완료 응답에서 교정 call까지14718ms였다. 별도 wait의 모델 응답1개가
**29923 tokens(input29883/output40, thinking7은 부분집합)**를 사용했다.
첫 양도 시간을 final 결과 도착 시각으로 해석하지 않는다.

다른 기록 간격은 두 번째 metadata→entry16094ms, fact→final 등록8279ms,
등록 응답→별도 dispatch9852ms다. 간격 전부를 특정 비용이나 인과적 개선으로 단정하지 않는다.
교정 본문은174와 같은 정확한 두 문장으로 revision1 등록·dispatch됐지만 **120004ms
timeout 전에 native spawn이 관측되지 않았다**. retained pending/FINAL1 planned,
agent/spawn/submission/reply hash·verdict가 모두 null이다. frozen native replay와 저장
상태가 일치한다. **교정 native 검사·부모 조회·전달·Stop은 UNRUN**이며 시도를 재개하지 않는다.
두 관측 child만 completed/waited/closed다. 소유 Job 정리를 native cancel 증거로 세지 않는다.

## 회계·원복

새 배정 native12/관리8(원복2)/내부 ceiling88, 동시성1 중 실제 native3/관리8(원복2)/
내부2/완료 응답11(parent7/child2+2)이다. **227831 tokens**:
input222909/output4922, thinking2087은 output의 부분집합이다. checkpoint parent145186에
빠진 마지막 완료 응답31946을 native 원장과 대조해 parent177132로 집계했다.
응답 ID는 `resp_05b3701cde943808016aa6dbeb5fbc87d0acfbccb2309adaa8`다.
모든 child usage도 대조했고 in-flight 불확실성은 유지했다. 후속9행 UNRUN,
누적 **1063(Claude632/Codex431)**이다. 과거 실패·예약·UNRUN을 재사용하지 않았다.

모든 소유 process0, 양쪽 baseline 선택·후보 비활성화와 own ON 파일2개 부재 복원을
확인했다. 원본 native/cache/실패 자료는 보존했다. 중간 OFF 주입 제거 시험은 없다.
첫 감사는 native wait의 두 input_text 배열을 문자열로 예상해 실패했다. 실패 script를
보존하고, 정확한2블록/완료 header 및 전체 printed JSON이 실제 검증된 MCP 결과·next_step과
동일한지 검사한 별도 감사로 확정했다. native 결과를 바꾸거나 재실행하지 않았다.

근거: `.superpowers/release-loop-175/rows/03-codex-calibration/failure-audit.json`,
SHA256 `f9174c70da3e741fa4c2df78a262ee96a2a64f8316fdc542f46bcc1eae07c613`;
`yield-inspection.json`, `audit-envelope-correction.json`, `shape-audit.json`, `batch-closed.json`.

다음 조사는 code-mode 최초 응답 양도 설정이다. 정상 첫 줄 directive로 최대60000ms까지
같은 call에서 기다릴 수 있는지 확인하되, verifier wait60000ms·native120000ms·정리5초는
늘리지 않는다. 부모가 수신한 양도와 실제 결과를 구분하며 모든 native 승인 경계를 보존한다.
추가 문구/크기 변경만 무근거 반복하지 않는다. 원래192/516·실제 재개·미견/변형/반복,
네 기능/혼합·모든 H/Q와 fact-review 대상 혼동은 여전히 미완료다.
