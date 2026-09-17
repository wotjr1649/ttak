# 정상 준비·첫 fact 연결174

기존 H1–H3/Q1–Q2와 원래192 subjects/516 requests를 포함한 전체 Go 목표를 유지한다.
174는 **No-Go, CLOSED/RESTORED**다. 일부 recipe 사용이나 MCP의 typed complete를
전체 완료로 취급하지 않는다.

## 변경과 로컬 검증

후보 `0.2.0-rc.13+codex.20260913165045` / `ttak-entry174`, runtime34파일이다.
normal Codex의 기존 `explanation_prepare` description에 정적 진입 recipe를 제공했다.
실제 도구 발견 metadata에서 처음 읽고 준비·첫 fact의 dispatch/spawn/wait/close/read를
한 code-mode call로 실행한다. 모델 근거가 있으면 준비 응답만 반환해 부모가 먼저 검사한다.
준비와 dispatch의 attempt/candidate/packet/hash, 고정 모델/high/fresh-context를
대조하고 기존 native receipt·결과·next_step·delivery 검사를 그대로 재사용한다.
MCP는 순수한 bounded compiler이며 내부 모델 호출이나 반환 프로그램 eval은 없다.

`writing-for-agents`/`skill-creator`에 따라 shared skill에는 짧은 진입 연결만 추가했다.
`plugin-creator`의 공식 cachebuster/scaffold를 사용했다. 고정된 동일 binding에서 모든
prepare packet·legacy compiler·host adapter와 Claude metadata가173과 동일하다.
Codex 준비 description만1286→5312bytes, 그 안의 entry code는3569bytes다.
정적 배치·크기는 native 성능이나 의미 품질을 입증하지 않는다.

새7검사의 recipe 부재를 먼저 재현했다:35PASS/7FAIL. 구현 뒤41PASS/1FAIL은
JSON 모델 fixture의 줄 시작 형식 오류였다. 기존 제한 parser는 바꾸지 않고 지원하는
입력 형태로 고쳐 **집중42PASS/0skip/8850ms**를 확인했다. 모든 실패 기록을 보존했다.
전체 **Node77files807PASS/0skip/74750ms, Python79/3638ms, conformance195ms**다.
helper12검사/27구문, skill/marketplace, 로컬 resume 검증도 통과했다.
generic plugin validator의 기존 per-host MCP 경로 비호환은 미해결 UNRUN이다.

## 정상 native 결과

34파일과11hook의 정확한 파일·명령·hash를 대조해 두 시험 프로필에 정상 설치·활성화했다.
parent `01a09bb0-8ceb-7683-87c3-0fb046d3d237`,
attempt `66358641-b546-48df-b07b-697486278273`,
candidate digest `b2dc7fec84124c33cf355077aa462eaeaae1ee814ae532aab53f71401c603835`다.

metadata 발견 뒤 실제3571-byte entry는 두 whitespace 차이 외에 고정 recipe와 일치했다.
준비와 첫 fact를 같은 call에서 실행했고, fact는 두 read7·최종 저장7을 정확히 도출했다.
부모는 actual result를 읽고 사용자 오류안을 변경 없이 최초 final에 제출했다.
이 검사는 원문 구절을 정확히 인용해 withheld했고, 실제 correct_final을 조회했다.
그러나 최초 final의2596-byte 프로그램에서 필수 receipt/next/delivery 존재 검사를
생략하고 별도 저장 key를 썼다. 실제 native hook이 결과를 검증한 사실과, 완전한 client
recipe를 사용하지 않은 사실을 구분한다. 이후2929-byte 교정 프로그램은 receipt/next/
delivery 검사를 포함했지만, 결과를 읽기 전에 종료됐다.

정정 등록 본문:

> Each of the two reads returns 7. Because reading does not change the stored value, it remains 7 after both reads.

세 번째 fresh verifier에서9개 pass/issue0인 MCP complete 결과는 관측됐다.
하지만 **120007ms timeout 전에 PostToolUse 승인·native final receipt·SubagentStop이
관측되지 않았다**. retained pending/FINAL1 launched, submission SHA는 있지만
submitted:false이고 reply SHA/verdict는 null이다. 실제 Pre까지만 replay한 상태가
저장 상태와 정확히 일치한다. Post를 만들어 보충하지 않았으며, **부모 조회·전달·Stop은
UNRUN**이다. 첫 두 child만 completed/waited/closed이며 세 번째는 owning Job으로 정리됐다.

현재도 실제 fact는 정확한데 최초 final의 source_support/computed_outcomes/
internal_consistency가 모두 final-only mutation issue를 연결했다. 이 대상 혼동은 OPEN이다.
native code 응답→다음 호출 간격은 metadata→entry19017ms, fact→final16615ms,
final→correction16591ms다. 개별 비용이나 인과적 성능 개선으로 단정하지 않는다.

## 회계·원복·다음 조사

신규 native12/관리8(원복2)/내부 ceiling88 배정 중 실제 native3/관리8(원복2)/내부3,
완료 모델 응답9(parent4/child2+2+1)이다. **144620 tokens**:
input140282/output4338, thinking1257은 output의 부분집합이다.
checkpoint parent57555에는 마지막 완료 응답25503이 빠져 있었다. native 원장과
대조해 parent83058로 집계했다. 응답
`resp_0aa1e25633a5fb8c016aa6d57a7bfc87d0814fe44c82c64e54`는 실행 중인 마지막 code call의
완료 모델 응답이다. 모든 child 사용량도 원장과 대조했다. in-flight 불확실성은 남는다.
후속9행 UNRUN, 누적 **1060(Claude631/Codex429)**. 과거 배정·실패는 재사용하지 않았다.

모든 소유 process0, baseline plugin 선택 복원·후보 비활성화와 원래 부재였던 이 배치의
ON 파일2개 제거를 확인했다. 원본 native/cache/실패 근거는 유지했다. native interrupt/
cancel/resume나 세션 중간 OFF 제거 기능을 시험한 것으로 계산하지 않는다.

근거는 `.superpowers/release-loop-174/rows/03-codex-calibration/failure-audit.json`,
SHA256 `950fdaef1ae4687cf8a62ee07aa7292f12d00d67e96146f15908cc3be77aae0a`,
`shape-audit.json`, `batch-closed.json`이다. 감사는 collector의 정확한 `_meta:null`과
native wrapper의 해당 필드 부재만 구분하고 나머지 전체 envelope/content를 대조했다.

다음 조사는 반복해 작성하는 정상 recipe를 작게 만들되 현재의 모든 검사를 보존할 수
있는지다. before/after 실행형 반례 대조로 동등성을 확인하고 새 후보에서만 native
동작을 판정한다. timeout·모델·기준을 바꾸거나 실패한174를 재개하지 않는다.
fact-review 대상 혼동, original192/516, 미견·변형·반복·실제 재개, 네 기능·혼합,
모든 H/Q와 전체 Go는 여전히 미완료이며 목표는 active다.
