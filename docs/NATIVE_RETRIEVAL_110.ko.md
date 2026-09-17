# 정상 plugin packet 수신 110

전체 목표는 **active / No-Go**다. 후보 `0.2.0-rc.13+codex.20260912095017`의 Haiku 단순
정상 사례는 통과했지만 Codex의 자식 초기 안내·상태 분리·수집기 결함으로 배치는 FAIL이다.
개별 성공을 원래 출하 기준이나 전체 비교의 완료로 보지 않는다.

Claude의 기본 plugin MCP 자동 로드 이름공간을 반영했다. 107–109의 명시적 bundled MCP
연결과 달리 이번 Claude는 `--mcp-config` 없이 설치된 plugin의 MCP를 자동 로드했다.
준비본 `20260912094317`은 native·관리 호출 0회로 대체했고 원본을 보존했다.

고정 후보는 Node **483 PASS**, Python **78 PASS**, conformance PASS다. 수집기 별도
2개 검사와 skill·marketplace 검사는 PASS다. 범용 plugin validator의 호스트별 MCP 경로
비호환은 이전 FAIL을 보존하며 같은 검사를 근거 없이 반복하지 않았다.

## 실제 결과

- Haiku: 독립 사실 Agent 3개와 최종 Agent 1개가 각각 고정 packet을 실제 수신했다.
  실제 Agent ID, 부모 tool-use 연결, getter·결과 제출, 저장된 receipt, 최종 본문 해시가
  일치했다. Stop은 정확한 검증 본문을 허용했다. 세 문장의 Nori register 설명은 정의,
  두 번의 읽기 결과 7·7, 남은 값 7을 정확히 설명하며 금지된 추가 보장을 넣지 않았다.
  검증 전 완성 설명은 없었다. **단순 사례 한 건의 PASS**이며 109,550 ms로 시간 상한에
  가까웠다. 반복성과 복잡한 과제의 품질·지연은 미검증이다.
- Codex: 실제 fresh Agent 1개를 시작했지만 조회 안내 없는 짧은 nonce만 받아 packet을
  수신하지 않았다. 자식 UserPromptSubmit이 이전 미검증 안내를 내보냈다. 부모 session ID를
  공유하는 훅에서 부모 시도를 자식 요청으로 교체한 것으로 진단했다. 수집기는 자식
  turn/completed를 부모 완료로 오인해 대기 중인 부모를 중단했다. 수집된 최종 문장은
  자식의 자료 요청이며 부모 최종 설명은 없다. **FAIL**이다. 자식의 shell 호출 시도는
  `tools.exec_command is not a function`으로 실행되지 않았다.

[Codex hooks](https://learn.chatgpt.com/docs/hooks)의 부모 session ID와 SubagentStart context
계약, 실제 자식 순서가 다음 수정의 근거다. 수집기는 각 이벤트의 thread ID를 보존하고
부모 종료만 완료로 처리해야 한다. 모델의 의미 오류나 host 성공 종료로 이 실패를 지우지 않는다.

## 사용량과 복원

상위 native는 배정 **4 / 상한 12 중 4회 사용**, 관리 **7 / 상한 12 중 7회 사용**이다.
관리 복원 예약 2회를 모두 사용했다. 동시성 1, native 120초·정리 5초·supervisor 20초,
관리 20초를 유지했다. 계획 행 UNRUN은 0, native 상한 미사용은 8, 관리 상한 미사용은 5다.

| 실제 사용량 | Haiku | Luna | 합계 |
|---|---:|---:|---:|
| 내부 native Agent | 4 | 1 | 5 |
| 부모 모델 요청 | 9 | 5 | 14 |
| 자식 모델 요청 | 12 | 5 | 17 |
| 부모 tokens | 204,269 | 80,652 | 284,921 |
| 자식 tokens | 66,422 | 84,520 | 150,942 |
| 전체 tokens | 270,691 | 165,172 | 435,863 |

Haiku는 원본 transcript의 완결 message ID별 사용량이 host modelUsage와 일치한다.
부분 stream snapshot과 Agent footer 합계는 전체 사용량이 아니므로 합산하지 않았다.
Luna는 일찍 닫힌 stream에 빠진 부모 요청을 원본 token_usage_record에서 회수했다.
캐시는 입력에, thinking은 출력에 포함되며 실제 청구액·구독 잔여율은 추정하지 않는다.

누적 상위 native는 **840회(Claude 505, Codex 335)**다. 109·108·107·106의 닫힌 미사용
예약과 원래 **192 subjects / 516 requests UNRUN**을 새 배정·소비로 계산하지 않는다.

두 시험 프로필의 이전 선택과 후보 ON 상태를 복원했다. 이번 후보가 만든 ON 파일 두
개만 삭제했고 증거와 설치 캐시는 남겼다. 모든 Job의 정리와 소유 프로세스 0을 확인했다.
세션 중간 OFF 시험·전역 설정 변경·인증 변경·게시·배포는 하지 않았다.

근거: `.superpowers/release-loop-110/native-plan-final.json`, `manifest-final.json`,
`full-final-autoload/`, `rows/03-claude-simple/completion-audit.json`,
`rows/04-codex-simple/failure-audit.json`, `batch-closed.json`, `management/`,
`own-state-restored.json`. 원본 transcript나 숨겨진 reasoning 본문을 별도로 복사하지 않았다.
