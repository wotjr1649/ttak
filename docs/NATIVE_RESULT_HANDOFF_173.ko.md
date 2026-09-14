# 실제 결과 지점의 다음 분기 전달173

목표는 기존 H1–H3/Q1–Q2와 원래192 subjects/516 requests를 포함한 전체 출하 Go다.
이 배치는 **No-Go, CLOSED/RESTORED**이며 개별 metadata·typed complete로 목표를 완료하지 않는다.

## 변경과 검증

`0.2.0-rc.13+codex.20260913161723` / `ttak-next173`, runtime34파일이다.
normal Codex가 exact receipt와 `include_next_step:true`로 실제 결과를 읽을 때만,
같은 parent cache/candidate/TTL·미소비 조회에서 다음 분기를 제공한다. hook은 actual
native result/coverage/delivery를 검사하고, native fact 상태와 revision으로 next_step의
stage/code/instructions 전체를 재계산한다. 없는/변조된 metadata와 missing Post는 실패다.
typed cache에만 있는 아직 읽지 않은 fact는 final-ready가 아니다. 새 승인·재개 권한은 없다.

준비 응답에는 현재 spawn recipe만, fact 결과에는 다음 fact 또는 전체 final 등록+검증
recipe를, 최초 withheld 결과에는 정확한 corrected literal을 채우는 revision1 recipe를
제공한다. revision1 withheld에는 실행 code가 없다. complete에는 actual delivery 원문
전달만 안내한다. shared skill은 한 번의 전체 code 실행과 인수 객체 host 흐름을 구분했다.
원래7필드 결과·receipt·literal·legacy compiler·Claude/assessment/notice 경로는 유지했다.

집중27files304PASS/0skip/30363ms, Node76files800PASS/0skip/83812ms,
Python79/3964ms, conformance241ms PASS다. 정상/변조 metadata·native-file hook/실제
MCP·빈 교정 recipe의 무효과·정정 후 정확 전달·정정 소진/중복을 검사했다. 한 시험은
기존 첫 Stop 차단을 즉시 종료로 기대해 실패했고, guard를 바꾸지 않고 첫 block 및
두 번째 continue:false를 모두 검증하도록 수정했다. helper12검사/26구문·로컬 resume·
skill/marketplace PASS, generic validator 기존 per-host MCP 경로 비호환은 UNRUN이다.

같은 입력/binding에서172와 verifier packet 및 legacy compiler 결과가 동일하며,
첫 preparation payload는7571→3654bytes다. 이는 정적 배치 차이로 시간 개선 증거가 아니다.
34파일과 정확한11hook 파일/명령/hash를 검토한 정상 설치·양쪽 활성화가 통과했다.

## 실제 native 결과

parent `01a09b92-e7ba-7690-8fe8-56f7e3b18d88`,
attempt `9c93a26a-faec-4155-94a2-f58c54176303`,
candidate digest `511c0b76294c0ac2b4ac6e2381677dc3d562a28457176d84f24d923f2ddbb56d`.

독립 fact는7,7·최종 저장7을 answered로 도출했다. 부모는 실제 결과와 final_proposal
분기를 조회한 뒤, 사용자 오류안을 변경하지 않고 연결 recipe로 final 등록·새 검토했다.
최초 final은 원문 구절을 정확히 인용해 withheld했다. 다음 actual read의 correct_final
분기를 사용해 다음 두 문장을 revision1로 등록하고 fresh verifier를 실행했다.

> Each of the two reads returns 7. The stored value remains 7 after both reads, so the final stored value is 7.

두 actual final 프로그램3032/3123bytes 모두 등록·dispatch/wait/close/read와 정확 delivery
대조를 포함했다. eval이나 반환 프로그램의 동적 실행은 없었다. 세 번째 verifier는 actual
normal Pre/Post에서 모든9검사 pass·issues0인 typed complete를 제출했다. 하지만
120013ms timeout 전에 native final receipt/SubagentStop이 없었다. retained state는
pending, FINAL1 launched+submitted, submission hash 있음, reply_sha256/verdict null이다.
**native 결과 반환·부모 조회·최종 전달·Stop은 UNRUN**이다. typed verdict를 전체 완료나
제출된 본문의 native 전달로 바꾸어 해석하지 않는다.

첫 두 child는 completed/waited/closed이고 세 번째는 owning Job 종료로 정리됐다.
모든 소유 process0을 확인했으며 실제 native interrupt/cancel/resume 증거로 계산하지 않는다.
이 시도는 재개하거나 재배정하지 않는다. 초기 final-only mutation issue0이 fact-review의
computed_outcomes/internal_consistency에도 연결된 오류는 여전히 OPEN이다.

native 기록의 응답→다음 호출 차이는 준비→첫 fact11483ms, fact→최초 final15617ms,
최초 final→교정15938ms다. 이 차이 전체를 특정 처리나 생성 비용으로 단정하지 않는다.
부모는 최초 도구 발견 뒤 사용 불가 shell/read 도구도 한 번 찾아봤으나 실행하지 않았다.
다음 조사는 normal metadata에서 준비+첫 fact verifier를 한 entry recipe로 제공할 수
있는지다. 모든 원문/등록/packet/receipt/새 verifier 검사를 보존해야 하며 한도는 늘리지 않는다.

## 사용량·복원·근거

새 배정 native12/관리8(복원2)/내부 ceiling88, 동시성1이며 실제 native3/관리8(복원2)/
내부3/완료 응답11(parent6/child2+2+1)이다. **189385 tokens**
(input184858/output4527/thinking1670은 output의 부분집합)다. checkpoint parent100217에
없는 완료 parent 응답26971을 native 원장에서 확인해 parent127188로 집계했다.
응답 ID는 `resp_04b486daf19fff3b016aa6cde490ec87d0937e16ea965d4d17`이며 실행 중인
마지막 code 호출의 완료 모델 응답이다. 모든 child usage 원장도 다시 대조했다.
미관측 in-flight 사용량 가능성은 남고, 후속9행 UNRUN, 누적1057(Claude630/Codex427)이다.

양쪽 baseline 선택과 후보 비활성화를 정상 복원했다. 이 배치가 만든 ON 파일2개만
원래 부재로 되돌렸고 native 원본/cache/실패 근거는 보존했다. 세션 중간 OFF 제거 시험은 없다.
native actual source와 frozen guard replay가 retained attempt와 일치한다.
첫 감사는 collector의 `_meta:null`과 native 저장 wrapper의 해당 필드 부재를 whole-envelope
비교에서 실패했다. 원래 실패 감사를 보존하고, 정확히 null/부재만 확인한 뒤 나머지 모든
field/content byte를 동일하게 대조한 별도 감사로 검증했다. 결과를 고치거나 무시하지 않았다.

근거: `.superpowers/release-loop-173/rows/03-codex-calibration/failure-audit.json`,
SHA256 `bfe762518cfaaa27c3048681f02d0319dfa6189861b1f094811fb1c4a59d6c05`;
`audit-envelope-correction.json`, `shape-audit.json`, `batch-closed.json`.
원래192/516, 미견/변형/반복·실제 재개, 네 기능/혼합과 전체 H/Q 출하 조건은 여전히 미완료다.
