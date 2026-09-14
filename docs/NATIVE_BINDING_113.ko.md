# Native 현재 시도 연결 113

목표는 **active / No-Go**다. `0.2.0-rc.13+codex.20260912111718`의 정상 Codex
실행에서 `current/current` 입력을 실제 부모 시도 ID와 후보 해시로 연결하고 정확한
plan을 등록한 것을 확인했다. 그러나 정상 설명 완료는 FAIL이며 두 프로필은 복원했다.

첫 dispatch는 정확한 full packet을 반환했지만 모델은 이를 출력만 하고 spawn하지
않았다. 다음 dispatch에서 후보 해시를 잘못 입력하고 challenge를 누락해 거부됐다.
뒤의 decide 두 번도 실패 상태 때문에 거부됐다. **거부된 MCP 호출은 3회, 내부 Agent
시도와 실제 시작은 모두 0회**다. Agent 거부와 혼동하지 않는다. 마지막은 자유 형식의
보류 문구이며 정상 Stop은 unavailable로 중단했다. 정상 완료·정확한 보류 PASS가 아니다.

최종 고정 후보는 Node **496**, Python **78**, conformance PASS, 집중 검사 **91**,
별도 수집기 **4** PASS다. skill·marketplace 검사도 PASS다. 기존 host별 MCP 경로를
지원하지 않는 범용 plugin validator의 과거 실패는 보존하고 같은 검사는 UNRUN으로
명시했다. 이 로컬 검사는 실제 verifier 전달이나 의미 품질의 증거를 대신하지 않는다.

상위 native는 **배정 8 / 사용 3 / 상한 12**, 후속 5행은 UNRUN이다. 관리는 **7 / 12**,
복원 예약 2회를 모두 사용했다. Job 정리 및 활성 소유 프로세스 0을 확인했다. 후보 ON
파일 두 개만 원래 부재로 복구했고 기록·캐시를 보존했다. 세션 중간 OFF 주입 제거
시험은 하지 않았다. Codex 실행은 61,282 ms에 종료됐다.

원본 native 완결 응답 **8개**의 사용량은 입력 **120,240** + 출력 **2,542** =
**122,782 tokens**다. stream 합계와 일치하며 cache·thinking은 중복 합산하지 않았다.
누적 상위 native는 **849회(Claude 508, Codex 341)**다. 과거 예약·실패와 원래
**192 subjects / 516 requests UNRUN**은 새 배정과 구분한다.

다음 114는 반환 안내의 실제 ID 재입력 요구를 없애고, 현재 packet을 훅에서 연결한 뒤
dispatch 결과를 native spawn에 바로 넘기는 짧은 단일 호출 코드를 제공한다. 임의 해시
수정, 실패 상태 복구, native receipt 또는 최종 검사의 생략은 하지 않는다.

근거: `.superpowers/release-loop-113/manifest-final.json`, `full-qualified/`,
`rows/03-codex-simple/failure-audit.json`, `batch-closed.json`, `management/`,
`own-state-restored.json`. 원본 transcript와 숨겨진 reasoning은 별도로 복사하지 않았다.
