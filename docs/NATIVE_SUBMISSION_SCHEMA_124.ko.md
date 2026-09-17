# 제출 schema와 최종 길이 조건 124

후보 `0.2.0-rc.13+codex.20260912153320`은 **native 전달·결합 PASS / 의미 조건 FAIL**이다.
전체 출하 목표는 active / No-Go다. 후속5행은 UNRUN으로 닫고 프로필을 복원했다.

## 실제 검증

동일한 factory가 실제 typed 결과 도구와 packet의 `submission.input_schema`를
구성하도록 바꿨다. 반환 JSON schema를 입력처럼 보여주지 않는다. 실제 Haiku
fact2개·final1개의 제출이 모두 올바른 필드로 이루어졌고, typed 결과·실제 Agent ID·
본문 해시·독립 최종 결과·마지막 Stop을 통과했다. 이전의 추가 fact 필드 거부는
그대로 유지된다. 직전 실패를 허용하도록 validator를 바꾸지 않았다.

처음에는 검증 전 설명이 보였고 Stop이 한 번 교정했다. 정확한 시도 태그가 붙은
실제 `hook_blocking_error` 뒤에 준비가 시작됐으며, 저장된 교정 횟수는1이다.
마지막 Stop은 정상 `{}`였다. 감사기의 단일 Stop 가정을 실제 허용된 1회 교정과
정확한 순서·태그·최종 상태를 확인하는 형태로 고쳤다. 모델을 다시 실행하지 않았다.
처음부터 초안을 노출하지 않는 동작까지 통과한 것으로 주장하지 않는다.

그러나 최종 본문은 명백한 **네 문장**이다. 요청의 “two or three sentences”를
충족하지 않는데도 final verifier가 complete를 반환했다. 두 번의 읽기가7을
반환하고7이 저장돼 있다는 내용은 맞지만 형식 조건 누락을 성공으로 계산하지 않는다.
`Intl.Segmenter`와 실제 네 문장 대조를 실패의 기계적 근거로 사용했으며, 문장 수
검사가 사실성의 인증이라는 주장은 하지 않는다.

125는 독립 최종 판단에서 명시적인 독자·형식·길이를 사실 조건과 함께 검사하도록
수정한다. 데이터/receipt/추가 필드/원본 요청/최종 본문 검사는 그대로 유지한다.
이 지침 변경의 의미 판단 효과는 로컬 회귀로 증명할 수 없으므로 새 native 결과로
확인해야 한다. 원래 H/Q·네 기능·혼합 과제·192/516 비교는 모두 기존대로 남아 있다.

## 정산과 근거

집중 **122 PASS**, 전체 Node **45파일 / 527 PASS / 0 skip**, Python **78**,
conformance PASS, 수집기5·세션 인수2·skill·marketplace PASS, 동결 lifecycle
검사 PASS다. 일반 plugin validator의 기존 호스트별 MCP 비호환 UNRUN은 보존했다.

native 배정8 중 **3**, 관리 **7/7**(원복2/2), 양 상한12·동시성1이다. 정상 Haiku
프로세스95,739ms, 실제 내부 Agent3, 완료 모델 응답17, 입력·캐시233,393 +
출력8,190 = **241,583 tokens**다. thinking3,955는 출력의 부분집합이다.
native 진입 교정1회, 자식 JSON 반환 교정0회다.

모든 소유 Job 정리·잔여 process0, 프로필 선택과 새 ON 파일2의 원래 부재를
복원했다. 캐시·증거는 보존했고 세션 중간 OFF 시험은 하지 않았다. 닫힌 누적은
**892회(Claude532 / Codex360)**다. 원래 **192 subjects / 516 requests는 별도
UNRUN**이며 새 진단 배정으로 돌려쓰지 않았다.

근거는 `.superpowers/release-loop-124/rows/03-claude-simple/`의
`completion-audit.json`, `review.json`, `collected.json`, `process.json`과
`batch-closed.json`, 최종 회귀·복원 기록이다.
