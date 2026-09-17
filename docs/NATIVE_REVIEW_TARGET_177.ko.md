# 실제 오류 인용의 검토 대상177

기존 H1–H3/Q1–Q2·192 subjects/516 requests와 전체 출하 Go가 목표다.
177은 **No-Go, CLOSED/RESTORED**이며 전체 목표는 active다.

## 변경과 로컬 검증

후보 `0.2.0-rc.13+codex.20260913181943` / `ttak-target177`, runtime34파일이다.
fact 세 public 필드를 `fact_source_support`, `fact_computed_outcomes`,
`fact_internal_consistency`로 표시했다. 기존 아홉 검사와 canonical 세 그룹·결과,
strict legacy flat/grouped 입력을 그대로 보존한다.

최종 보류의 정상 native 조회는 이미 읽는 child snapshot에서 정확한 packet을 선택한다.
Codex의 native user packet, Claude의 실제 packet tool-use/result를 각각 기존
identity·version·model·turn·hash와 호출 순서에 결합한다. requirement/reader issue는
request 또는 final_text, claim issue는 final_text, fact issue는 실제 fact answer에서
verbatim 인용을 확인한다. 여러 그룹이면 각 대상에서 확인하며, 원문을 합치거나
공백/Unicode를 고치지 않는다. 잘못된 연결을 자동 pass나 수정 결과로 바꾸지 않는다.
이는 인용의 대상 경계이며 의미의 진실성을 인증하지 않는다.

176의 실제 원본은 기존 reader에서 잘못 수용됐고 새 reader에서 거부됐다.
집중33PASS/7FAIL →41PASS →확장45PASS다. 전체 첫821PASS/1FAIL은 별도 테스트에
남은 구 schema 기대값이었다. 필수 아홉 필드의 정확한 기대 이름을 갱신해 해당4검사
PASS, 새 경로에서 **Node78files822PASS/0skip/117080ms, Python79/5017ms,
conformance244ms**다. 첫 실패 로그를 보존했다. helper12검사/30구문·skill/marketplace·
로컬 resume PASS, generic validator의 기존 per-host MCP 경로 비호환은 UNRUN이다.
기존 native recipe·fact packet·entry·assessment/notice 및 Claude adapter·시간 한도는
176과 동일하며 runtime 변경은 양쪽 manifest와 세 관련 script뿐이다.

## 실제 정상 plugin 결과

parent `01a09c05-c16f-7d01-b463-ca2ad7b7a982`,
attempt `c380baad-bc79-465a-9260-47e529d8b5d9`,
candidate digest `1fcde4e2e35d85f09850820cb42ea1d48c5644ea1e7c4044a3a06ed095afd293`.
정상 설치·11hook 파일/명령/hash 검토와 양쪽 ON 활성화가 통과했다.
Luna fact는 두 read7·저장7을 올바르게 도출하고 실제 조회됐다.

최초 오류안은 원문 그대로 검토됐고 mutation 오류를 정확히 인용한 withheld가 나왔다.
하지만 `fact_computed_outcomes:[0]`이 final-only 구절을 연결했다.
나머지 두 fact 검사는 pass였으나 필드명이 그 차이를 유발했다고 단정하지 않는다.
**정상 부모 조회의 PreToolUse guard가 이 결과를 거부했고, MCP 조회 결과는 없었다.**
부모는 검증 실패를 알렸으며 승인된 설명을 전달하지 않았다.
실제 Stop은 stopped/unavailable, 저장 상태와 attempt 모두 unavailable,
FINAL0 referenced/submitted:true·verdict:null·final_sha256:null이다.
관측된 native chain과 거부 후 Stop 상태가 일치한다. **교정 등록·검증·전달은 UNRUN**이다.
거부한 시도를 재조회·재개하거나 다른 경로로 우회하지 않았다.

프로세스는99360ms에 정상 종료(exit0)했고 완료 판정을 뜻하지 않는다.
두 child 모두 completed/waited/closed다. 첫 final child는 제출 전 name-only metadata
조회1개를 했으며 추가 verifier나 MCP 제출은 아니었다.
부모의 entry 실행 본문은 동일했고 output cap6000을 추가했다. 최초 final은 연결
recipe였지만 delivery 비교를 생략하고 cap7000을 사용했다. 전체 recipe 준수 PASS는 아니다.
entry18623ms, final→거부28570ms, metadata→entry16324ms, fact→final14329ms다.
running cell/wait는 없었고 두 실행은30초 미만이라 native 양도 경계·지연 개선은 미입증이다.

## 회계·복원과 다음 조사

새 배정 native12/관리8(원복2)/내부 ceiling88·동시성1 중 실제 native3/관리8(원복2)/
내부2/완료 응답10(parent5/child2+3)이다. **180055 tokens**:
input176365/output3690, thinking1470는 output의 부분집합이다.
parent117977과 두 child22933/39145의 완료 원장을 최종 checkpoint와 대조했다.
관측된 모든 turn이 완료됐고 미완료 응답은 남지 않았다. 구독 잔여량/별도 청구 측정은 아니다.
후속9행 UNRUN, 누적 **1069(Claude634/Codex435)**. 과거 배정·실패·UNRUN과 원래
516회의 비교 배정을 재사용하지 않았다.

모든 소유 process0, 양쪽 baseline 선택·후보 비활성화·own ON2부재와
runtime34파일 root=frozen hash를 확인했다. 원본 증거·캐시는 보존했다.
중간 OFF 주입 제거나 native cancel 시험은 하지 않았다.

근거: `.superpowers/release-loop-177/rows/03-codex-calibration/failure-audit.json`,
SHA256 `d473c12ee500b750e323cbc34125e625e74fa170f2d5840fe962af9ef1783a0f`;
`baseline-reproduction.json`, `reproduction-fixed.json`, `shape-audit.json`, `batch-closed.json`.
다음은 같은 전역 issue 인덱스가 final과 fact 양쪽에 쓰이는 표현 구조를 조사한다.
검증된 인용/대상 guard를 유지하고 원문별 issue 영역과 lossless canonical 변환을
실행형 반례로 검증한다. 이름·문구만 다시 바꾸지 않는다. 원래192/516·네 기능/혼합·
미견/변형/반복·실제 실패/취소/재개와 모든 Go 조건은 여전히 미완료다.
