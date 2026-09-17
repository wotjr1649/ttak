# Native 호스트 분리 116

목표는 **active / No-Go**다. `0.2.0-rc.13+codex.20260912121851`에서 정상 Haiku
대조는 통과했지만 Luna 회귀가 timeout돼 배치 전체는 FAIL이다. 후속 보류·재개
4행은 UNRUN이며 두 프로필을 복원했다.

MCP 설정의 명시적 host로 실제 도구 목록과 반환 adapter를 분리했다. Claude는
짧은 Agent/packet 조회, Codex는 native dispatch/code-mode 보관 경로만 받는다.
지원되지 않는 host나 해당 host에 없는 도구는 거부한다. 정상 Claude 초기화 기록에서
8개 MCP 도구와 dispatch 부재도 확인했다. 공유 skill의 검증 분기를 답변 작성
안내보다 앞에 뒀다. 기존 packet·native receipt·해시·최종 본문 검사는 유지했다.

Haiku는 검증 전에 진행 상황만 말했고, fresh fact verifier **3개**와 final verifier
**1개**를 실행했다. 최종 세 문장은 두 읽기 결과 및 남는 값 7을 정확히 설명했고,
정확한 본문을 정상 Stop이 수락했다. 21응답 / **274,451 tokens**, **111,116 ms**다.
120초 한도에 가까우며 반복성이나 일반 품질·성능을 증명한 것은 아니다.

Luna는 실제 fact/final 자식 2개에게 정확한 packet을 전달했다. 그러나 두 자식 모두
`tools.explanation_*_result`라는 미등록 이름을 추측했고, 실제 MCP 호출 뒤에도
`result.final_text`를 최상위에서 찾았다. 각 결과를 동일한 내용으로 **두 번** 제출했다.
두 호출의 인수와 응답이 같다는 것을 확인했으며 오류·불리한 결과를 삭제한 것으로
해석하지 않는다. 이 불필요한 호출·조회가 관측된 시간 소모이며 유일한 원인이라고
단정하지 않는다.

final 자식의 메시지는 있었지만 **SubagentStop receipt와 정상 close는 관측되지
않았다**. 부모 최종 본문도 없다. Job은 **120,008 ms**에 timeout됐고 모든 소유
프로세스를 정리했다. 남은 상태는 pending/final-launched이며 complete가 아니다.
자식 메시지의 `complete` 문자열로 정상 완료를 대체하지 않는다.

Codex 원본 사용량은 부모 **7응답 / 106,239 tokens**, fact 자식 **4응답 / 51,058**,
final 자식 **5응답 / 57,223**, 합계 **16응답 / 214,520 tokens**다. checkpoint의
부모 합계 86,408은 원본 usage의 정확한 prefix이며 이후 기록 **19,831 tokens**를
추가 회수했다. 최초 감사의 checkpoint=원본 합계 가정은 맞지 않았다. 불완전 수집
표시를 유지하며 진행 중 미회수 사용량 가능성도 남긴다.

상위 native **배정 8 / 사용 4 / 상한 12**, 관리 **7 / 상한 12**, 복원 몫 2회
모두 사용이다. 내부 Agent 시도·실제 시작 **6회**, 완결 모델 응답 **37회**, 관측
**488,971 tokens**다. 누적 상위 native는 **860회(Claude 513, Codex 347)**다.
과거 실패·예약과 원래 **192 subjects / 516 requests UNRUN**을 새 배정과 구분한다.

최종 고정 후보는 Node **508**, Python **78**, conformance PASS, 집중 **103**,
수집기 **5** PASS다. skill·marketplace는 PASS, 범용 plugin validator의 기존
host별 MCP 경로 비호환은 과거 FAIL을 남기고 UNRUN이다. 후보 ON 파일 두 개만
원래 부재로 복구했다. 증거·캐시는 보존했으며 OFF 주입 제거, 새 모델, 유료 API,
전역 변경, 게시·배포는 하지 않았다.

117에서는 SubagentStart가 fact/final 종류에 맞는 정확한 도구 이름, 입력 필드와
`reply.structuredContent.final_text` 접근을 제공한다. 같은 반환 객체를 쓰도록
안내하며 기존 시간·해시·native receipt 조건은 완화하지 않는다. 새 정상 실행은 필요하다.

근거: `.superpowers/release-loop-116/manifest-final.json`, `full-qualified/`,
`rows/03-claude-simple/completion-audit.json`, `rows/03-claude-simple/review.json`,
`rows/04-codex-simple/failure-audit.json`, `batch-closed.json`, `management/`,
`own-state-restored.json`. 원본 transcript와 숨겨진 reasoning 본문은 복사하지 않았다.
