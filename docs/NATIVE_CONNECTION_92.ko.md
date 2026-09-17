# 연결 진단 92 — Claude 추가 1회 통과

2026-09-11 KST. 사용자가 명시한 추가 1회 범위로 수정된 Claude 수집기를 실행했다.
**Claude의 작은 내장 연결 진단은 PASS다.** Codex는 재실행하지 않았으며 이전 연결
통과와 함께 양쪽의 부모·자식 연결을 관측했다. 제품 rc.13 / No-Go, 설명 품질 미검증은
유지한다. 이번 상위 시작 1회를 더한 누적은 **731회(Claude 436 / Codex 295)**다.
자식 1개는 별도 계수하며 누적 상위 시작 수에 중복 가산하지 않는다.

## 실행과 관측

기존 작업 루트 `D:\AI_DEV\ttak\.superpowers\worktrees\first-release`에서 다음 명령을
한 번 실행했다. 02 슬롯의 독점 예약을 보존했고 자동 재시도는 0회다.

```powershell
node scripts/connection-probe-claude.cjs --run-once --after-tool-alias-fix
```

MAX 20 포함량 전용·추가 유료 사용량 비활성이라는 사용자 확인 아래 기존 OAuth
환경을 사용했다. 자격 파일을 읽거나 토큰을 출력·복사하지 않았으며 API key와 별도
공급자 환경을 전달하지 않았다. 설치·hook·신뢰·프로필 설정은 수정하지 않았다.

| 항목 | 실제 관측 |
|---|---|
| 부모 session ID | `751b9f26-ba17-4d7b-9c01-156817482d9d` |
| 자식 agent ID | `a473b5f50da82250a` |
| 연결 tool-use ID | `toolu_01ByNDt2Az6Bms7gMy3LuaNF` |
| 부모·자식 응답 모델 | `claude-haiku-4-5-20251001` |
| 초기 도구 이름 / 실제 tool-use 이름 | `Task` / `Agent` |
| 자식 유형 | `general-purpose`, foreground |
| 실제 하위 입력 | 지정한 세 줄 본문과 일치, 부모 표식 없음 |
| 자식 도구 사용 | 0회 |
| 실행 결과 | success, permission denial 0개 |
| Windows Job | 14,946 ms, exitCode 0, activeProcesses 0, cleanupVerified true |

정상 tool result와 전달된 자식 메시지뿐 아니라 부모·자식 native transcript를 대조했다.
자식 transcript는 `isSidechain: true`, 해당 agent ID, 지정 모델을 보고하고 user 메시지가
정확히 지정 질문 하나다. 부모 원문 프롬프트도 한 번 기록된 것을 확인했다.
일반 자식의 기본 system/developer·환경 문맥 전체를 고정하거나 수집한 것은 아니므로
`full_input_isolation_verified`는 false다. 부모의 자기 보고를 독립 감사로 사용하지 않았다.

자식은 정답 A를 담은 JSON을 Markdown 코드펜스로 감싸 반환했다. 원문을 보존하고
코드펜스 안의 객체를 진단용으로 대조했다. **연결 PASS와 `strict_json_only_result: false`를
함께 기록한다.** P0 strict 결과 계약, 의미 정확성 또는 제품 설명 품질 합격으로 바꾸지 않는다.

## 사용량 대조

| 중복을 제거한 최종 usage | 부모 | 자식 |
|---|---:|---:|
| input_tokens | 19 | 10 |
| cache_creation_input_tokens | 12,444 | 4,709 |
| cache_read_input_tokens | 11,496 | 0 |
| output_tokens | 1,055 | 191 |
| thinking_tokens — output에 포함 | 744 | 162 |

비중첩 입력·cache 생성·cache 읽기·출력 합계는 **29,924토큰**이다. thinking을 다시
더하지 않는다. 부모 2개·자식 1개, 고유 assistant message ID 3개가 관측됐지만
모든 내부 API 응답의 완전한 계수로 주장하지 않는다.

stream-json에서는 같은 message ID가 여러 번 나타났고, 출력 usage가 아직 최종값이
아닌 알림도 있었다. native transcript의 마지막 usage 상태를 메시지 ID별로 선택한 뒤
부모 합계를 최종 result.usage와, 부모·자식 합계를 result.modelUsage와 정확히 대조했다.
자식 output은 초기 알림 1에서 최종 191로 바뀌었다. 단순 합산하거나 초기값을
최종값으로 사용하는 수집기는 과대·과소 계수할 수 있다. P0에 연결할 때는 최종 snapshot
선정 이후 응답별 감사 계약으로 넘겨야 한다. 이번에 P0 계약을 변경하지 않았다.

CLI가 표시한 `0.03818285 USD`는 `costBasis: list`인 클라이언트 추정값이다.
실제 추가 청구 또는 지불 금액으로 보고하지 않는다. 이번 실행은 기존 구독 OAuth
경로를 사용했으며 별도 결제 전환을 요청하지 않았다.

## 보존·검증·다음 단계

이번에는 수집기·테스트·프롬프트를 수정하지 않았다. 실행 전후 이전 결과에 기록된
코드 hash와 일치함을 확인했다. 이전 로컬 수집기 검사 10 PASS / fail 0 / skip 0은
유지하며 재실행하지 않았다. 이번 검증은 실제 모델 실행, 원문 입력·모델·결과·최종
usage 대조 및 프로세스 정리다. 제품 전체 검사와 설명 품질 시험은 미실행이다.

이번 증거는 `.superpowers/native-connection-90/claude-attempt-02/`의 reservation,
observations, process, audit 기록에 있다. 기존 실패 슬롯과 Codex 통과 기록은 보존했다.
최신 종합 결과는 같은 증거 루트의 `connection-complete-outcome.json`이다.

이로써 작은 내장 연결 진단 단계는 끝났다. 다음은 관측된 Codex V1 / Claude Task·Agent
이름과 최종 usage 처리, 엄격한 결과 형식을 실제 P0 adapter 계약에 반영하는 작업이다.
그다음 rc.13의 정상 plugin 진입을 연결하고 설명 품질 시험을 수행해야 한다. 현재
Codex는 보존된 rc.1 프로필, Claude는 plugin 0개 프로필에서 관측했으므로 정상 rc.13
plugin·TUI·설명 품질까지 통과한 것은 아니다. 이번 승인 범위를 넘어 추가 모델 호출은
하지 않았다. 192 subjects / 516 requests 전체 비교도 여전히 미실행이다.
