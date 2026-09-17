# Codex 최종 등록·검증 연결170 — 실제 실행 결과

후보 `0.2.0-rc.13+codex.20260913132542` / `ttak-joined170`은 CLOSED/RESTORED다.
전체 출하 Go는 미완료이며, 개별 실패로 개발 목표를 종료하지 않는다.

## 변경과 로컬 근거

Codex final_draft_code는 등록 성공의 kind·binding·revision·미승인 상태를 확인한 뒤,
기존 dispatch/spawn/wait/close/result-read 코드를 그대로 실행하도록 연결했다.
등록 구간을 block scope로 분리하고 중간 metadata 출력은 제거했다. 기존 spawn 코드
bytes와 Claude adapter는 frozen169와 동일하다. 최종 본문과 revision은 부모가 정하며,
검증 생략·재시도·결과 재소비·한도 증가는 없다.

실행형 recipe와 실패 경계 집중233PASS/0skip, Node73파일767PASS/0skip,
Python79/conformance PASS. runtime34파일 고정, helper9검사/24syntax·skill·marketplace·
local resume PASS. 정상 설치·11hook 파일/명령/해시 검토·양쪽 활성화 PASS.
로컬 synthetic native 응답은 실제 모델 판단이나 성능 근거가 아니다.

## 03 Codex calibration FAIL

동일 Nori 요청과 최초 오류안을 사용했다. fresh fact verifier는 답7,7,7을 도출했지만
result 입력의64자리 challenge에서 마지막 한 글자 `2`를 빠뜨려63자리로 제출했다.
normal Pre guard가 `verification_invalid_digest`로 거부했고 MCP 제출·receipt·실제
결과 조회·최종 등록은 없었다. 잘못된 코드는 감사에서 실행하지 않았다.

실제 packet/child/turn과 retained 상태를 대조했다. fact는 launched/retrieved 상태이며
submitted:false, reply:null, 최종 packet:null이다. 부모 Stop은 unavailable로 중단했다.
CLI exit0과 child 종료는 완료 근거가 아니다. 실행68183ms, cleanup 확인·active process0.
**연결된 final recipe의 native 효능은 UNRUN**이며 upstream 실패를 recipe 실패로 단정하지 않는다.

근거: `.superpowers/release-loop-170/rows/03-codex-calibration/failure-audit.json`
(SHA256 `7106c8fd18494757f81b8e595ebe37f83055722f3b85c3e26dc0ce9da0e32c72`),
해당 `review.json`, `.superpowers/release-loop-170/batch-closed.json`.

## 장부·원복·다음 경계

새 배정 native12/관리8(복원2)/내부 최대88에서 실제 native3/관리8(복원2)/내부1을 사용했다.
완료 응답7, **136566 tokens**(input134022+output2544; thinking1473은 부분집합)를
native 기록과 terminal에 대조했다. 미관측 in-flight 가능성은 없다. 후속9건은 UNRUN,
누적 native **1048 = Claude627 + Codex421**이다. 두 후보를 정상 비활성화하고 기존
선택을 복원했다. 작업 소유 ON 파일2개만 원래 부재로 복원했고 증거와 cache는 보존했다.

다음은 result 제출의 명시적 `challenge:"current"` 참조를 현재 관측된 fresh verifier에만
연결할 수 있는지 조사한다. 잘못된 literal을 보정하거나170 시도를 재개하지 않는다.
169 인용 정밀도·per-check 항목 연결,170 recipe 효능, 원래192 subjects/516 requests와
모든 기존 H/Q 출하 조건은 여전히 미완료다.
