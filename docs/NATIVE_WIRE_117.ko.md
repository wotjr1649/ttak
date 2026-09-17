# Native 결과 API 안내 117

목표는 **active / No-Go**다. `0.2.0-rc.13+codex.20260912123755`에서 Luna 정상
완료는 통과했지만 Haiku가 한 예제를 다섯 fact 질문으로 쪼개 최종 검사 전에
timeout됐다. 후속 보류·재개 4행은 UNRUN이며 두 프로필을 복원했다.

SubagentStart는 fact/final 종류에 맞는 정규 도구 이름과 입력 필드, Codex의
`reply.structuredContent.final_text` 반환 경로를 제공한다. Luna는 두 fresh verifier가
각각 결과 도구를 **한 번** 사용했고, 보관된 사실 결과를 정확히 최종 검사에 전달했다.
세 문장의 최종 본문을 정상 Stop이 수락했다. 최종 검사 전 진행 문구에는 이미 확인된
읽기 결과가 포함됐고, 최종 검사가 아직 진행 중임을 명시했다. 이는 독립 검증된 부분
결과의 보고이며 미검증 초안을 붙인 것이 아니다. 원문은 감사 파일에 남겼다.
**11응답 / 154,350 tokens / 96,594 ms**다.

Haiku의 수집 보고서에는 메시지·초기화 기록이 없었다. 그러나 이것은 시작 실패의
증거가 아니었다. `windows-job.cs`는 timeout 때 stdout/stderr를 의도적으로 반환하지
않으며, 기존 반례 검사도 이 보류 동작을 요구한다. 이 경계는 변경하지 않았다.
정리 확인 뒤 정확한 원본 세션 `67563fed-82c1-41f8-8e20-b64abfa284d1`과 그 자식
파일을 읽어 복구했다. 초기의 “원본 시작 여부 불명”을 실제 기록으로 해소했다.

실제로는 `nori_definition`, `nori_read_behavior`, `example_first_read`,
`example_second_read`, `example_remaining_value` **5개 질문**을 순차 실행했다.
각 fresh 자식의 packet 수신과 `answered` 반환을 확인했다. 검증 전 초안은 표시하지
않았지만 final 검사 시작·완성 설명·완료 receipt는 없다. Job은 **120,010 ms**에
timeout됐다. 부모 **10응답**과 자식 **15응답**, 합계 **25응답 / 313,169 tokens**를
관측했고, 진행 중 미회수 사용량 가능성을 남긴다. 빈 수집 보고서를 0 tokens 또는
0 verifier로 계산하지 않는다.

상위 native **배정 8 / 사용 4 / 상한 12**, 관리 **7 / 상한 12**, 복원 예약 2회
모두 사용이다. 내부 Agent 시도·실제 시작 **7회**, 모델 완결 응답 **36회**, 관측
**467,519 tokens**다. 누적 상위 native는 **864회(Claude 515, Codex 349)**다.
과거 실패·예약과 원래 **192 subjects / 516 requests UNRUN**을 새 배정과 구분한다.

최종 후보는 Node **509**, Python **78**, conformance PASS, 집중 **104**, 수집기
**5** PASS다. skill·marketplace PASS이며 범용 plugin validator의 기존 MCP 경로
비호환은 과거 FAIL을 남기고 UNRUN이다. 후보 ON 파일 2개만 원래 부재로 복구하고
모든 Job/소유 process 정리를 확인했다. 증거·캐시, timeout 보류 guard를 보존했다.
OFF 주입 제거, 새 모델, 유료 API, 전역 변경, 게시·배포는 하지 않았다.

118은 준비 스키마의 질문 단위를 “한 조건 아래 전체 메커니즘과 예제”로 명확히 한다.
정의·각 단계·결과를 별개 질문으로 세지 않되, 모든 주장·원래 요구를 보존하며 서로
다른 질문은 계속 각각 새 문맥에서 확인한다. 질문 상한 8과 최종 검사도 유지한다.
Claude 정상 호출에 사전 session ID를 지정해 실패 후 원본 회수 대상을 명확히 한다.
timeout 출력을 성공 경로로 반환하거나 검사를 완화하지 않는다.

근거: `.superpowers/release-loop-117/manifest-final.json`, `full-qualified/`,
`rows/03-codex-simple/completion-audit.json`, `rows/03-codex-simple/review.json`,
`rows/04-claude-simple/failure-audit.json`, `batch-closed.json`, `management/`,
`own-state-restored.json`. 원본 transcript와 숨겨진 reasoning은 별도로 복사하지 않았다.
