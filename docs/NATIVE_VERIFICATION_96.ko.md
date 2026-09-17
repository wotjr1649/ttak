# 승인된 전송 진단 96 — Codex 통과, Claude 결과 감사 실패

2026-09-11 KST. 사용자의 실행 승인에 따라 [worker 95](VERIFICATION_WORKER_95.ko.md)의
최종 예약을 실행했다. Codex가 통과한 뒤 Claude를 시작했다. 호스트별 상위 CLI 1회와
자식 1개, 120초, 자동 재시도 0회였으며 **총 2회 사용**했다. 누적 상위 native 시작은
**733회(Codex 296 / Claude 437)**다. 두 실행 모두 실제 프로세스 정리가 확인됐다.

| 항목 | Codex | Claude |
|---|---|---|
| 모델 | gpt-5.6-luna / high | claude-haiku-4-5-20251001 |
| 실행 상태 | observed | stopped / evidence_rejected |
| 실제 자식 입력 대조 | 통과 | 통과 |
| 자식 도구 사용 | 0개 | 0개 |
| 결과 JSON·인용 감사 | 통과 | 실패 |
| worker 실행 시간 | 41,479 ms | 25,602 ms |
| 정리 후 소유 프로세스 | 0개 | 0개 |
| 부모+자식 관측 토큰 | 56,251 | 32,110 |

토큰에는 cache 및 reasoning이 이미 해당 입력·출력에 포함돼 있으며 재가산하지 않았다.
Codex는 thread 최종 누적 snapshot, Claude는 assistant message별 최종 snapshot 단위다.
Claude의 부모+자식 합계는 native modelUsage와 일치했다. 이 수치는 청구액이 아니며,
API 응답 수·토큰 hard cap이나 전체 사용량 관측을 입증하지 않는다. API key 경로를
추가하지 않았고 기존 구독 로그인/OAuth 환경으로 실행했다. 계정 포함량·추가 유료
비활성 조건은 앞선 사용자 확인을 사용했으며 billing 계정을 조회하지 않았다.

## 실제 결과

Codex는 `A leaves before B.`를 bare JSON으로 반환했다. 실제 packet hash, 조건과
두 인용의 UTF-16 구간이 모두 맞았다. 실제 spawn/wait/close 및 정확한 호출문 대조,
부모·자식 모델, 가시 입력과 timestamp, Windows Job 정리를 포함한 정산을 통과했다.

Claude도 A가 B보다 먼저 나온다고 답했지만 JSON을 코드펜스로 감쌌다. 최초 정산
실패 코드는 `adapter_result_not_json_object`다. 원 결과와 실패 기록을 그대로 보존했다.

추가 로컬 분석에서 세 인용 중 두 개의 위치 오류도 확인했다.

| 인용 | Claude 제시 구간 | 실제 quote 구간 | 판정 |
|---|---|---|---|
| FIFO 정의 | [0, 60) | [0, 59) | 불일치 |
| A의 선행 도착 | [60, 79) | [60, 79) | 일치 |
| 다른 작업 없음 | [79, 107) | [80, 106) | 불일치, 원문 길이 초과 |

원문 길이는 UTF-16 106이다. 펜스 안의 내용을 읽은 것은 실패 원인 분류를 위한
로컬 분석이며, 펜스 제거·인용 수정을 통해 결과를 다시 수용하지 않았다.
Claude의 단순 결론이 맞는 것과 결과 계약이 통과하는 것을 구분한다.

## 세션과 기록

- Codex 부모: `01a08ea8-f81e-7a02-bc88-3022921af58d`
- Codex 자식: `01a08ea9-3f54-7a23-b80f-34598ab9f859`
- Claude 부모: `4f97c1ce-f645-42ed-bde3-c320dc36e73b`
- Claude 자식 agent ID: `a037ea2650e32109b`

실행·정산 원장은 `.superpowers/verification-worker-95/` 아래
`codex-q1-ready`와 `claude-q1-ready`의 `process.json`, `settlement.json`이다.
필터된 worker 관측은 각각의 `*-work/worker-observations.json`에 있다.
통합 결과와 독립 로컬 재대조는 `.superpowers/native-verification-96/outcome.json` 및
`audit.cjs`다. raw native transcript는 기존 시험 profile에 그대로 두었다.
자격 값·숨겨진 thinking을 출력하거나 새 파일에 복사하지 않았다.

예약된 두 실행을 모두 소모했고 재시도하지 않았다. 이전 95의 코드·테스트·문서 artifact
hash는 모두 유지됐다. 이번에는 제품 코드를 수정하지 않았고 94개 로컬 테스트도
재실행하지 않았다. 실제 native 기록·정산·사용량·정리 결과를 새로 대조했다.

## 판정과 후속 방향

새 worker의 부모→자식 호출과 정확한 가시 입력 전달은 양쪽에서 관측됐다. 다만
Claude의 출력 형식과 인용 위치가 실패했으므로 **설명 품질 시험으로 진행하지 않았다**.
`observed`를 전체 system/developer 입력 관측이나 P0 receipt로 승격하지 않는다.
Codex 시험 plugin rc.1 / Claude 시험 plugin 없음이라는 기존 한계도 그대로다.
정상 rc.13 plugin 연결, 전체 설명 품질 및 192 subjects / 516 requests는 미검증이다.
제품은 **rc.13 / No-Go**를 유지한다.

다음 로컬 개선은 Claude 자식의 구조화 출력 지원과, 모델에게 문자 위치 계산을 맡기지
않는 인용 선택 방식을 검토하는 것이다. 기존 source anchor 구현을 우선 확인하되,
유효하지 않은 인용을 임의 보정하거나 기존 실패를 통과로 바꾸지 않는다. 결과 계약의
변경은 로컬 테스트로 먼저 검증하고, 추가 native 실행은 별도 승인된 예산에서 수행한다.
