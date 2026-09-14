# v2 실제 재검증 98 — 인용은 해결, Claude framing은 실패

2026-09-11 KST. 계속 진행하라는 사용자 요청에 따라 [anchor 구현 97](VERIFICATION_ANCHORS_97.ko.md)을
로컬 검증한 뒤, 기존과 같은 구독 조건·모델·호스트별 1회 상한으로 새 v2를 검사했다.
Codex 통과 후 Claude를 실행했다. 각 부모 1개·자식 1개, 120초, 자동 재시도 0회였다.

| 항목 | Codex | Claude |
|---|---|---|
| 새 v2 정산 | observed | stopped |
| 자식 가시 입력 | 정확히 일치 | 정확히 일치 |
| anchor 결과 본문 | 유효 | 유효 |
| bare JSON | 통과 | 코드펜스로 실패 |
| 실행 시간 | 33,132 ms | 17,078 ms |
| 부모+자식 관측 토큰 | 60,003 | 33,327 |
| 정리 후 소유 프로세스 | 0 | 0 |

새 상위 native 시작은 2회, 누적은 **735회(Codex 297 / Claude 438)**다.
토큰은 cache와 reasoning을 다시 더하지 않은 관측 합계이며 청구액이 아니다.
Claude의 부모+자식 사용량을 native modelUsage와 대조했다. 구독 인증 경로를
유지했고 API key를 추가하지 않았다. 계정 포함량 잔액이나 청구 화면은 조회하지 않았다.

## 무엇이 판별됐는가

Codex는 bare JSON으로 source anchor를 선택했고, P0 인용 변환·결과 감사까지 통과했다.
Claude의 응답도 packet/map hash와 anchor 선택이 유효했다. 로컬 코드가 만든 정확한
원문 인용은 `[0, 79)`였으며, 96에서 발생한 문자 위치 계산 오류는 이 표본에서 재발하지
않았다. 이는 선택된 인용 구간의 유효성 관측이며 설명 품질 전체의 보장이 아니다.

Claude는 `--append-subagent-system-prompt`로 bare JSON 규칙을 추가한 실행에서도
` ```json ` 코드펜스로 응답을 감쌌다. 정산 실패는 `adapter_result_not_json_object`다.
시스템 지시의 전체 native 입력을 관측한 것은 아니므로, flag를 전달했다는 사실과
모델이 실제로 받은 전체 system prompt를 구분한다.

펜스 안의 본문을 로컬에서 분석해 anchor 문제와 framing 문제를 분리했다. 이 본문을
새 성공 결과로 제출하거나 원래 stopped 정산을 수정하지 않았다. 반복된 framing 실패에
대해 같은 자유 텍스트 경로에서 지시만 늘리는 추가 native 실행은 중단했다.

## 식별자와 기록

- Codex 부모: `01a08ebf-d949-77a1-8a5f-f74ab0308670`
- Codex 자식: `01a08ec0-2c7b-7bc3-86cb-c97bfa105670`
- Claude 부모: `7efb4812-84e4-456a-bbff-97e7ce151136`
- Claude 자식: `ae0a876f3ba5c148b`

실행 원장은 `.superpowers/verification-worker-95/codex-anchor97/`와
`claude-anchor97/`의 process/settlement JSON이다. 통합 재대조는
`.superpowers/native-verification-98/outcome.json`, 검사 코드는 같은 위치의 `audit.cjs`다.
검사에서 ticket·요청·artifact hash, 실제 자식 입력·timestamp·정리·사용량을 대조했다.
raw reasoning·자격 값은 출력하거나 복사하지 않았다.

관련 로컬 회귀는 97의 **144 PASS / fail 0 / skip 0**다. 이후 별도 비활성 수신기
후보의 테스트 8개도 통과했다. [구조화 제출 후보 99](VERIFICATION_SUBMISSION_99.ko.md)에
준비된 범위와 사용자 결정이 필요한 도구 권한 변경을 구체화했다.

설명 품질 시험과 정상 rc.13 plugin 연결은 진행하지 않았다. 현재 profile은 Codex
rc.1 plugin / Claude plugin 없음이다. 제품은 **rc.13 / No-Go**, 전체 192 subjects /
516 requests는 미실행이다. full input 관측·native P0 receipt·의미 품질 인증은 없다.
