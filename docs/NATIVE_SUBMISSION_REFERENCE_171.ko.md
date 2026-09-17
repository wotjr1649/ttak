# 현재 검증자 challenge 참조171 — 실제 경로 통과, 정정 검토 중 timeout

후보 `0.2.0-rc.13+codex.20260913140836` / `ttak-submit171`은 CLOSED/RESTORED다.
전체 Go 목표는 active이며, 출하 판정은 여전히 No-Go다.

## 변경·검증

결과 제출의 명시적 `challenge:"current"`만 정상 Pre에서 현재 fresh verifier의 정확한
64자리 challenge에 연결한다. 다른 actor/시도/phase/만료/중복 제출은 거부하고, native는
관측된 child turn까지 요구한다. Claude의 blocking Agent는 SubagentStart와 정확한 packet
조회로 묶인다. literal 오타를 보정하지 않으며 MCP 컴파일러 자체는 current를 해석하지 않는다.

receipt에는 `submission_reference:true`만 더한다. 실제 결과 조회기는 이 Pre 표식과
기존 native identity/call/제출/반환 해시를 모두 확인한 뒤 원래 selector가 남은 기록을
해석한다. 결과7필드·한도·독립성·Stop은 유지한다. runtime 변경은 verification,
result-source, evidence hook 세 파일과 두 manifest뿐이다.

RED241PASS/5FAIL → 집중248PASS/0skip. Node74파일774PASS/0skip(72442ms),
Python79(3497ms), conformance(209ms) PASS. helper12검사/26syntax·skill·marketplace·
local resume PASS, runtime34파일 고정·정상 설치·11hook 검토·양쪽 활성화 PASS.
변경 evidence hook SHA256: `421140d272e2cb1243ef07f11ab78bace4d637be9c257ae1528e870a8e77e317`.

## 실제 Codex calibration

동일 Nori 원문과 최초 오류안을 사용했다. fact와 최초 final verifier가 실제로 current를
제출했고, 정상 hook 갱신→MCP 결과→native receipt→부모 실제 조회가 모두 맞았다.
fact는7,7,7을 확정했고 변경 없는 오류안은 구체적 모순으로 유효하게 withheld됐다.
issue의 인용은 실제 초안의 verbatim 부분 문자열이다. 단, final-only 결함을 모든 fact-review
검사에도 연결한 항목 정확성 문제는 계속 OPEN이다. 전체 판정 이유와 항목별 연결을 구분한다.

부모는 정정본을 등록하고 세 번째 fresh verifier까지 시작했다. 그러나120013ms에 timeout,
정정 verifier는 제출·완료 응답·SubagentStop이 없었다. retained는 pending/FINAL1 launched,
submitted:false/reply:null이다. **정정 판정·결과 조회·부모 전달·Stop은 UNRUN**이다.
첫 두 child는 완료·wait·close됐고 세 번째는 소유 Job 종료·cleanup(active0)을 확인했다.
native interrupt/cancel 또는 성공적인 정상 close 근거로 바꿔 적지 않는다. 재개/재배정 없음.

170의 연결 recipe도 두 final 등록에서 실제 사용됐다. 부모 code-mode 호출은5회였고,
두 final 등록을 포함한 프로그램은3041/3105 bytes였다. 이전 결과 응답 뒤 다음 final
호출까지19502/19706ms의 간격이 있었다. recipe 반복 작성 비용은 다음 조사 가설이며,
이 숫자가 모두 작성 비용이거나 전체 지연이 개선됐다고 단정하지 않는다.

## 장부·원복

실제 native3/배정12, 관리8/배정8(복원2 사용), 내부3/최대88, 완료 응답9.
**158352 tokens = input154322 + output4030**, thinking1216은 output의 부분집합이다.
부모 native 완료 기록109473 중 마지막27224가 timeout checkpoint의82249에는 아직
반영되지 않았다. 첫 감사의 동일값 가정 실패를 보존하고, 해당 완료 response ID·시간·
누적값을 대조해 실제 사용량에 포함했다. 세 번째 child의 미관측 in-flight 사용량 가능성은 남는다.

후속9 UNRUN, 누적 **1051 = Claude628 + Codex423**. 두 후보를 정상 비활성화하고
기존 선택을 복원했다. 작업 소유 ON 파일2개만 원래 부재로 돌렸고 cache와 native 증거는
보존했다. 진단 inspection의 불필요한 host header 복사본은 제거하고 식별 필드만 유지했다.
원래 native 기록은 변경하지 않았다.

근거: `.superpowers/release-loop-171/rows/03-codex-calibration/failure-audit.json`
(SHA256 `da63b0d91b50f9faf41eebcbb353d92cc89edc60fbd2fee827cda2c94edc5944`),
해당 `review.json`, `timeout-inspection.json`, `inspection-minimization.json`, `batch-closed.json`.
원래192 subjects/516 requests, 나머지 기존 H/Q와 모든 필수 출하 조건은 미완료다.
