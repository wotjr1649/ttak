# Native 결과 보관 115

목표는 **active / No-Go**다. `0.2.0-rc.13+codex.20260912115718`의 정상 Luna
초보자 대조는 실제 fact/final 두 verifier, 원본 결과 보관, 정확한 최종 본문과 Stop까지
PASS다. 그러나 같은 후보의 Haiku 대조가 실패해 배치 전체는 FAIL로 닫았다.

Codex code-mode의 기존 `store`/`load`와 실제 확인한 wait/close API를 사용했다.
고정 recipe가 packet 조회·spawn·wait·close 후 실제 반환 객체를 보관했고, 부모는
원본 요청과 fact 객체를 다시 입력하지 않고 최종 검사로 전달했다. 서로 다른 새
자식 2개가 각각 정확한 full packet을 실제 사용자 입력으로 받았다. 최종 답변은
두 문장으로, 두 읽기 결과와 남는 값이 모두 7이라고 설명했다. 검증 전에는 진행
상황만 표시했다. 정상 Stop은 빈 결과로 수락했다. 13응답 / **178,916 tokens**다.

Haiku에는 최초 답변 **전에** 첫 동작을 검증 도구로 지정한 훅 안내가 있었다.
그런데 바로 완성 초안을 출력했고 Stop이 차단한 뒤에야 prepare를 호출했다.
이후 Claude에서 Codex용 dispatch를 선택하고 긴 packet을 재구성해 Agent에 넣었다.
해당 Agent, 부모의 직접 packet 조회, 실패 후 올바른 nonce 재시도, decide가 거부됐다.
내부 Agent 시도 2회 / 실제 시작 0회다. 마지막 보류 문구에 초안 전체를 다시
붙였으므로 보류도 PASS가 아니다. Stop은 unavailable로 중단했다. 프로세스는
54,481 ms에 exit 0이지만 의미·실행 판정은 FAIL이다. 8응답 / **191,247 tokens**다.

상위 native **배정 8 / 사용 4 / 상한 12**, 후속 보류·재개 4행은 UNRUN이다.
관리 **7 / 상한 12**, 복원 예약 2회 모두 사용이다. 내부 native Agent는 시도
**4회 / 실제 2회**, 모델 완결 응답 합계 **21회**, 관측 **370,163 tokens**다.
누적 상위 native는 **856회(Claude 511, Codex 345)**다. 과거 예약·실패 및 원래
**192 subjects / 516 requests UNRUN**을 새 배정과 분리했다.

최종 고정 로컬 검사는 Node **503**, Python **78**, conformance PASS, 집중 **98**,
수집기 **5** PASS다. timeout 후에는 정리 확인을 전제로 checkpoint를 불완전한
수집으로 표시하는 검사를 추가했다. 정상 완료나 원본 사용량 전체 회수로 오인하지 않는다.
skill·marketplace는 PASS이며 범용 plugin validator의 기존 host별 MCP 경로 비호환은
과거 실패를 보존하고 UNRUN으로 기록했다.

두 프로필 선택을 복원하고 후보 ON 파일 2개만 원래 부재로 돌렸다. 모든 Job 정리와
소유 process 0을 확인했다. 증거·캐시는 남겼다. 전역 런타임 변경, OFF 주입 제거,
새 모델, 유료 API, 게시·배포는 하지 않았다.

다음 116은 MCP 실행 설정에 host를 명시하고 실제 도구 목록과 반환 adapter를
호스트별로 분리한다. 공유 skill의 검증 분기를 답변 작성 지침보다 앞에 배치한다.
Haiku가 처음부터 검증하고 짧은 Agent 경로를 따르는지는 새 정상 실행으로 확인해야
한다. 첫 안내의 누락이나 모델의 일반적 준수를 증명했다고 주장하지 않는다.

근거: `.superpowers/release-loop-115/manifest-final.json`, `full-qualified/`,
`rows/03-codex-simple/completion-audit.json`, `rows/03-codex-simple/review.json`,
`rows/04-claude-simple/failure-audit.json`, `batch-closed.json`, `management/`,
`own-state-restored.json`. 원본 transcript와 숨겨진 reasoning은 별도로 복사하지 않았다.
