# 정상 code-mode 양도 directive176

목표는 기존 H1–H3/Q1–Q2·192 subjects/516 requests와 모든 출하 조건을 만족한 Go다.
176은 **No-Go, CLOSED/RESTORED**이며 목표는 active다.

## 변경·검증

후보 `0.2.0-rc.13+codex.20260913174342` / `ttak-yield176`, runtime34파일이다.
normal Codex에서 native verifier를 기다리는 entry/spawn/최초 final/교정 recipe의
첫 줄에 `// @exec: {"yield_time_ms": 60000}`를 제공했다. 첫 줄을 제외한 실행 본문은
175와 동일하다. Claude·assessment/notice·legacy compiler 및 동일 binding의 packet도
동일하다. verifier wait60000ms·native120000ms·정리5000ms·관리20000ms는 바꾸지 않았다.
새 도구·모델·동적 eval·전역 설정·skill 문구 변경은 없다.

현재 호스트의 순수 timer 검사는31051ms를 한 완료 call에서 기다렸지만 pinned
Codex plugin 증거를 대체하지 않는다. 공식 App Server 문서는 이 directive를 명시하지
않았으므로 지원 근거를 외부 문서에 귀속하지 않는다.
첫 집중47PASS/1FAIL은 correction 분기의 wrapper 누락을 발견했다. 수정 뒤
**48PASS/0skip/8732ms**, 전체 **Node77files808PASS/0skip/74804ms,
Python79/3484ms, conformance199ms**, helper12검사/30구문·skill/marketplace·로컬
resume PASS다. generic validator의 기존 per-host MCP 경로 비호환은 UNRUN이다.
정상 설치·11hook 파일/명령/hash 검토·양쪽 ON 활성화가 통과했다.

## 실제 결과

parent `01a09be1-f86c-7642-ae67-8102302a86be`,
attempt `894673da-aec5-46e3-b8bb-ffc02ccc02df`,
candidate digest `0fe6f9873618ac303b2944c6dcf61f1b0fe8c4a27abed1c6a2d7992e84468943`.
실제 부모의 세 waiting recipe 모두 정확한 첫 줄 directive를 사용했다. entry는
compiler와 byte까지 같았고, 최초 final과 교정은 모두 등록+spawn을 연결했다.
다만 최초 final에서 부모가 final-delivery 비교를 생략했다. 실제 withheld에는
complete 전달 payload가 없었지만 전체 recipe 준수 PASS로 계산하지 않는다.
교정 code에는 delivery 비교와 빈 literal guard가 있었다.

fact는 두 read7·저장7을 올바르게 도출했고 실제 native 조회가 통과했다. 최초 오류안은
원문 그대로 등록됐으며, 최종 검증자가 정확한 오류 구절을 인용하여 withheld했다.
하지만 fact-review의 세 검사 모두 final-only 오류를 연결했다. 이는 OPEN이다.
최초 final child는 typed 제출 전에 metadata 조회1개를 추가했고 완료 응답은3개였다.
preview·중복 MCP 제출·추가 native agent 실행으로 세지 않는다.

교정 본문은 `Each of the two reads returns 7. Because reading does not change the
register, the final stored value is still 7.`이다(실제 본문은 줄바꿈 없는 두 문장).
fresh third child가 시작되어 approve 코드 텍스트를 내보냈지만 **120008ms timeout**
전에 실제 MCP 호출·Pre/Post submission·결과·native receipt·Stop·부모 wait/close는
관측되지 않았다. 코드 텍스트를 실행/승인 결과로 간주하지 않는다.
retained pending/FINAL1 launched, submitted:false, submission/reply hash·verdict null이며
관측된 native 경계만 재생한 상태와 정확히 같다. **부모 조회·전달·Stop은 UNRUN**이다.

완료된 entry19756ms·최초 final25875ms는 모두30초 이하다. 실제 code-mode yield/wait는
없었지만 **native에서30초 경계를 넘는 대기를 입증하지 못했다**. 지연 개선이나
timeout 해결을 주장하지 않는다. metadata→entry17098ms, fact→final14826ms,
final→교정15389ms 간격을 보존했다.

## 회계·원복

새 배정 native12/관리8(원복2)/내부 ceiling88, 동시성1 중 실제 native3/관리8(원복2)/
내부3/완료 응답10(parent5/child2+3+0)이다. **183874 tokens**:
input179803/output4071, thinking1192는 output의 부분집합이다. checkpoint parent90197에
빠진 마지막 완료 응답31352를 native 원장과 대조해 parent121549로 집계했다.
응답 ID는 `resp_05eb974f876462ff016aa6e2252f5887d08aaf2d505c9dcb02`다.
third의 완료 사용량0기록은 무활동/소모0을 뜻하지 않는다. in-flight 불확실성을 유지한다.
후속9행 UNRUN, 누적 **1066(Claude633/Codex433)**이다.
과거 예약·실패·UNRUN과 원래 비교516회를 새 배정으로 재사용하지 않았다.

모든 소유 Job process0, 양쪽 baseline 선택·후보 비활성화, own ON 파일2개 부재와
runtime34파일 root=frozen hash를 확인했다. 원본 native/cache/실패 자료는 보존했고
재개·재배정·중간 OFF 주입 제거 시험은 하지 않았다.

근거: `.superpowers/release-loop-176/rows/03-codex-calibration/failure-audit.json`,
SHA256 `3dd3e19ae72cb942b27eea64ad07b29e87cff476ca43a12056ec6dd098e0b561`;
`yield-inspection.json`, `prior-yield-shapes.json`, `shape-audit.json`, `batch-closed.json`.
다음 조사는 actual fact answer와 final-only issue의 대상 귀속이다. 같은 문구·크기·양도
조절만 반복하지 않는다. 원래192/516·네 기능/혼합·미견/변형/반복·실제 재개와
모든 필수 H/Q·Go는 여전히 미완료다.
