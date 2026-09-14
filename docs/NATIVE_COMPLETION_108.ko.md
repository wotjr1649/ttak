# 정상 plugin 독립 완료 경로 108

전체 출하 목표는 계속 활성 상태이며 **No-Go**다. 이 문서는 닫힌 진단 배치의 결과이지
전체 개발의 종료 선언이 아니다. 후보는 `0.2.0-rc.13+codex.20260912085349`다.

107의 상태 확인 전용 재개 요청이 새 설명으로 분류되는 오류를 반례로 재현하고 수정했다.
독립 질문 및 최종 본문 검증을 정상 MCP와 native Agent에 연결했다. 저장소에는 초안·
사용자 요청·검증 답변 원문 대신 시도·후보·입력·본문·실제 실행의 해시와 상태만 저장한다.
부모의 `supported` 선언이나 `scenario_review`의 발견 0만으로 완료하지 않는다.
공통 skill은 provider-neutral로 유지하고 호스트 호출 설정은 실행 어댑터가 제공한다.

## 실행과 판정

사전 배정은 상위 native 8회 / 상한 12회, 관리 7회 / 상한 12회, 관리 복원 몫 2회다.
내부 verifier는 설명 요청당 질문 최대 8개와 최종 검증 최대 2개, 배치 최대 40개로 별도
산정했다. 동시성 1, native 120초·정리 5초·supervisor 여유 20초를 유지했다.
Haiku와 Luna, 기존 구독을 사용했고 유료 API·인증·전역 설정은 바꾸지 않았다.

- 양쪽 정상 설치·ON 제어는 PASS. Codex hook 11개는 설치 파일 30개와 실제 명령·해시를
  대조한 후 정상 config API로 신뢰를 적용했다.
- 첫 Haiku 정상 설명은 FAIL. 처음부터 완성형 설명을 출력했고, 독립 질문 네 개를 만든 뒤
  여러 Agent를 같은 단계에 요청했다. 한 요청은 후보 hook, 두 요청은 호스트 동시성 상한이
  거부했다. 실패 상태에서 이후 PreToolUse가 빈 결과로 끝나 후속 Agent가 실행된 결함도 있다.
- 실제 실행된 네 verifier는 모두 Haiku이며 도구 사용 0이다. 입력에서 제공한 가상 정의를
  부모가 출처로 전달하지 않았고, 지나치게 넓은 질문 유형이 요청하지 않은 구현 의무를
  만들었다. 답변에는 잘못된 `checked_questions`, `answered`와 미해결 issues의 모순이 있다.
  이 답변들을 유효한 독립 근거로 인정하지 않았다. 최종 검증은 실행되지 않았다.
- 부모 실행은 `error_max_turns`로 종료됐다. 요청한 제한은 8이고 호스트 보고 `num_turns`는
  9다. 성공한 완성 설명이나 정상 재개로 계산하지 않는다. 이후 다섯 계획 행은 UNRUN이다.

## 사용량과 복원

상위 native **3회**, 실제 내부 Agent **4개**다. Agent 도구 요청은 거부된 세 건을 포함해
7건이다. 상위 누적은 **833회(Claude 501, Codex 332)**다. 107의 계획 미실행 1회·상한
미사용 7회와 106의 종료 시 미사용 8회를 새 배정으로 전용하지 않았다. 108의 계획 미실행은
5회, 상한 미사용은 9회이며 원래 192 subjects / 516 requests 비교는 아직 UNRUN이다.

관측 사용량은 **227,165 tokens**다. 부모 212,002와 자식 네 개 합계 15,163이 모델 집계와
정확히 일치한다. 캐시 포함 입력 213,059, 출력 14,106이다. `costBasis: list`는 구독의 실제
추가 청구를 뜻하지 않는다. 숨겨진 thinking 본문을 출력하거나 별도 저장하지 않았다.

관리 7회를 완료하고 두 후보를 비활성화했다. 이전 plugin 선택을 복원하고 이번 후보가
만든 ON 상태 파일 두 개만 원래의 부재 상태로 복구했다. 증거·설치 캐시는 보존했다.
세션 중간 OFF로 주입 내용을 제거하는 기능이나 시험은 하지 않았다. 각 실행의 Windows
Job 정리와 소유 프로세스 0을 확인했다.

## 검증 범위와 다음 반복

동일 고정 후보의 Node **470 PASS**, Python **78 PASS**, conformance PASS다. 수집기의
숨겨진 reasoning 제외·부분 출력 보존 시험도 2 PASS다. 이는 통제 경계 시험이며 모델의
의미 정확성 통과가 아니다. skill 검사와 marketplace 이름 검사는 PASS다. 범용 plugin
보조 검사기는 기존의 호스트별 MCP 경로를 지원하지 않아 FAIL로 남겼다. 이 검사를
수정하거나 우회해 PASS로 만들지 않았고 정상 CLI 설치 관측과 구분했다.

다음 반복은 실패 상태의 재실행 차단, 한 번에 한 검증 packet만 공개하는 전달, 원래 요청의
가정 보존, 타입 검사된 verifier 제출을 다룬다. 정상 plugin의 완료·보류·재개, 기존 의미
반례·정상 대조, 네 기능·혼합 과제와 전체 비교는 계속 미완료다.

근거는 `.superpowers/release-loop-108/`의 `manifest.json`, `native-plan.json`,
`full-frozen/`, `rows/03-claude-simple/failure-audit.json`, `batch-closed.json`,
`management/`, `own-state-restored.json`에 있다. 공식 호스트 계약은
[Codex hooks](https://learn.chatgpt.com/docs/hooks),
[Codex agent 설정](https://learn.chatgpt.com/docs/config-file/config-reference),
[Claude subagents](https://code.claude.com/docs/en/sub-agents),
[빈 tool 목록의 동작](https://code.claude.com/docs/en/errors#agent-would-be-spawned-with-zero-tools)을
대조했다. 문서상 지원과 실제 native 관측을 혼동하지 않는다.
