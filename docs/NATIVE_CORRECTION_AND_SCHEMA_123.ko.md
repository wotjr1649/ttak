# 보류 정정·재개와 입력 schema 123

후보 `0.2.0-rc.13+codex.20260912150606`은 양 호스트 보류·상태 재개를 통과했지만,
Haiku 정상 완료가 실패했다. **전체 목표 active / No-Go**이며 Codex 정상 대조는
UNRUN이다. 원래 출하 기준을 이 부분 통과로 대체하지 않는다.

## 통과한 동작과 한계

선택적 `corrections`는 요청된 짧은 정정을 unresolved와 분리해 보류 본문에 담는다.
각 필드480 UTF-8 bytes·평문·최대4개이며 전체 본문은 기존 해시와 Stop에 묶인다.
정정만으로 complete를 만들 수 없고 raw 텍스트는 상태 파일에 저장하지 않는다.

Haiku는 보이는 사전 평가에서 T1이 B를 읽는다고 정확히 정정하고 최종 보류를
전달했다. 선택적 corrections 필드는 쓰지 않아 **Haiku의 결합 정정 본문 경로는
미실행**이다. 기존 gate105의 보이는 정정·보류는 통과하지만 개발 계획의 더 구체적
결합 본문 경로가 증명됐다고 주장하지 않는다. Codex는 이 필드를 실제로 사용해
T1/B와 T2/A, S1 근거와 누락된 실측 요구를 같은 정확한 최종 본문에 전달했다.

양쪽 모두 같은 native 세션을 재개했을 때 이전 설명의 미검증·보류 상태와 필요한
실측 자료를 알렸다. 새 explanation/Agent는 없고 실제 Stop도 정상 종료였다.
이것은 **보류 상태 조회 재개**이지 검사 실패 주입·취소 후 재개의 통과가 아니다.

재개 감사기는 종료 후 빈 상태 파일이 남는다고 가정해 먼저 실패했다. 실제
SessionStart와 현재 UserPromptSubmit이 미검증 안내를 전달한 기록, 정상 Stop,
동결 코드의 로컬 lifecycle 검사로 바로잡았다. 일반 상태 조회의 빈 파일은 종료 시
삭제되지만 withheld/cancelled 설명 시도는 보존된다. SessionEnd 자체의 별도 native
receipt는 stream에 없어 파일 부재만으로 정리 성공을 주장하지 않았다. 모델을
다시 실행하지 않고 기존 기록을 감사했다.

## 정상 완료 실패와 다음 수정

Haiku 정상 Nori 대조는 80,503ms에 종료됐다. 첫 fact의 typed 제출과 반환은
성공했으나 둘째 fact가 입력에 `checked_questions: []`를 추가해 거부됐다.
실제 fact 도구는 네 입력 필드만 받는데 packet의 `result_schema`는 반환 JSON의
일곱 필드를 required로 보여줬다. 추가 필드 거부는 동결 코드로 재현됐다.

이후 검증자의 재시도와 부모의 Agent/보류/final 호출이 모두 차단됐다. 값 자체는
맞았지만 부모가 첫 fact만 근거로 완성 설명을 제공했으므로 정상 완료 FAIL이다.
실제 Stop은 `continue:false`와 `not verified`, 저장 상태는 unavailable였다.
Agent 요청4개 중 실제 시작은2개다. 나머지2개의 거부를 새 자식 사용량으로 세지 않았다.

124는 도구 입력 schema를 한 정의에서 생성해 실제 tools/list와 packet의
`submission.input_schema`에 함께 사용한다. 도구가 생성하는 반환 JSON schema를
입력처럼 보여주지 않는다. `checked_questions: []` 같은 추가 fact 입력 거부와
독립 최종 검증·실패 상태·사용량 경계는 그대로 유지한다.

## 검증과 정산

집중 **121 PASS**, 전체 Node **45파일 / 526 PASS / 0 skip**, Python **78**,
conformance PASS, 수집기5·세션 인수2·skill·marketplace PASS다. 일반 plugin
validator의 기존 호스트별 MCP 경로 비호환 UNRUN은 계속 남아 있으며 성공으로
바꾸지 않았다. 재개 lifecycle은 별도 동결 코드 로컬 검사 PASS다.

native 배정8 중 **7**, 관리 **7/7**(원복2/2), 각각 상한12·동시성1이다. 완료 모델
응답 **24**, 관측 **411,122 tokens**다. Haiku 보류76,215·Codex 보류42,927·
Haiku 재개24,484·Codex 재개18,303·Haiku 정상 실패249,193을 합산했다.
실제 내부 Agent2, 거부된 Agent2를 구분했다. 과금액이나 숨겨진 thinking을 복사하지 않았다.

모든 소유 Job은 정리·잔여 process0, 두 프로필 선택과 새 ON 파일2의 원래 부재를
복원했다. 캐시·native 실패 원본은 보존했으며 세션 중간 OFF 시험은 하지 않았다.
닫힌 누적 상위 native **889회(Claude530 / Codex359)**, 후속1행 UNRUN이다.
원래 **192 subjects / 516 requests는 별도 UNRUN**이며 새 배정과 섞지 않았다.

근거: `.superpowers/release-loop-123/rows/`의 각 감사·검토 JSON,
`resume-lifecycle.json`, `batch-closed.json`, 복원 기록이다.
