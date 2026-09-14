# 완성 설명 품질 실행 102 — 첫 부모 기록 거부, 캠페인 중단

2026-09-11 KST. 사용자가 [101의 고정 계획](VERIFICATION_EXPLANATION_101.ko.md)을 승인한 뒤
12행·상위 CLI 최대 84회·새 자식 최대 60개 범위의 실행을 시작했다.
**첫 Haiku 초안 호출의 native 기록이 수집기에서 거부되어 첫 실패 중단 조건을 적용했다.**
상위 CLI는 **1회 사용**, 자식 문맥은 **0개**다. 첫 행의 후속 7단계와 나머지 11행,
총 **83회분은 UNRUN**이다. 이 잔여량은 새 진단·재시도에 재배정하지 않았다.

제품은 **rc.13 / No-Go**다. 누적 상위 CLI는 **739회(Codex 297, Claude 442)**이며,
새 경로의 완성 답변 품질과 192 subjects / 516 requests는 여전히 미실행이다.

## 실행 전 확인과 실제 결과

Codex-home의 전체 S1–S8/W1–W11을 다시 읽고 현재 사용자 승인과 고정 범위를 대조했다.
계획 hash는 `ae9c8f0626b685332692cba9bd9ed3dd2184baed2f7d268e5a5dd8a8199825f7`이다.
기존 코드·시험 입력·진입점 등 249개 파일, 두 실행 파일 hash, 시험 프로필 상태가 일치했고
장부 12행이 모두 UNRUN임을 확인했다. API 키 환경은 없었으며 OAuth 환경의 존재만
확인했다. credential 값이나 인증 파일은 조회·출력·복사하지 않았다.

| 항목 | 관측 |
| --- | --- |
| 행 | known / Haiku / 반복 1 |
| 단계 | 초안 생성 부모 호출 |
| 모델 / CLI | `claude-haiku-4-5-20251001` / Claude Code `2.1.266` |
| native session | `b2641207-1f3a-4863-ac1f-405420625c77` |
| 프로세스 | `exited`, exit code 0, **72,891ms** |
| 수집기 결과 | `explanation_parent_report`로 거부 |
| 캠페인 | `stopped` |
| 질문별 자식·대조·재작성 | 모두 UNRUN |
| 정리 | Job 할당 후 실행, cleanup 확인, 활성 소유 process 0 |

CLI가 정상 종료된 것과 후보 실행 단위가 수용된 것은 다르다. 첫 기록 거부 뒤에는
`--run-next`를 다시 호출하지 않았다. 종료한 실행을 재개하거나 모델을 바꾸지 않았다.
프로세스 기록의 OS 프로세스 총수 42는 모델 자식 문맥 수가 아니며, 새 검증 자식은 0개다.

## 추가 호출 없이 확인한 두 문제

원래 요청 8,082자와 `StructuredOutput` 호출 한 번은 native 기록에서 확인됐다.
그러나 원래 요청 외에 다음 **113자 메타 입력**이 추가되어 가시 user 입력 수가 두 개였다.
해당 native 행의 `isMeta`는 true이며, 고정 Claude 실행 파일에도 같은 enforcement marker가 있다.

```text
[structured-output-enforce] You MUST call the StructuredOutput tool to complete this request. Call this tool now.
```

실제 순서는 원래 요청 → 첫 가시 답변 → 메타 입력 → `StructuredOutput` 호출 → 도구 결과였다.
수집기의 `auditParentReport`는 Claude 부모의 가시 입력을 정확히 하나로 가정하므로 이를
거부했다. 이 기록을 임의로 삭제하거나 검사 조건을 완화해 기존 실행을 통과 처리하지 않았다.
CLI 내부 메타 입력을 지원하려면 원래 요청·메타 이벤트·구조화 출력·결과의 순서와 연결을
명시적으로 검사해야 한다. 일반 추가 user 입력을 허용하는 수정으로 해결할 수 없다.

부모 prompt의 `Use no tools or agents`와 CLI의 `StructuredOutput` 요구도 서로 맞지 않는다.
실제 첫 가시 답변 뒤 enforcement가 발생한 것은 관측 사실이다. 이 문구 충돌이 그 순서의
유일한 원인이라고 입증한 것은 아니므로, 다음 수정에서 호스트별 출력 계약을 먼저 맞춰야 한다.

거부된 실행의 구조화 초안도 가시 기록에서 따로 회수해 기존 validator에 넣었다.
**`explanation_claim_coverage`가 재현됐다.** CL5는 Q2 하나에 O2와 O4를 연결했지만,
고정 질문 계획에서 Q2가 선언한 범위는 O4뿐이다. 따라서 메타 입력 처리를 고쳐도
현재 초안은 그대로 다음 질문 단계로 넘어갈 수 없다. 실제 출력의 ID를 대리 수정하거나
고정 coverage 표를 넓혀 성공으로 바꾸지 않았다.

초안 본문에는 직렬 실행과 재시도 설명에서 T2가 읽는 행을 A 대신 B로 적은 부분도 있다.
고정 finite scenario의 T2 guard는 A를 읽는다. 이는 초안의 관측이며, 이 후보가 의도한
독립 확인과 재작성을 거친 완성 답변의 품질 판정으로 사용하지 않는다.

## 사용량과 판정 범위

실행 중단 후 native 기록의 응답 ID별 마지막 snapshot에서 다음 사용량을 회수했다.

| 계수 | 관측값 |
| --- | ---: |
| input | 20 |
| cache 생성 input | 14,893 |
| cache 읽기 input | 10,811 |
| input 및 cache 합계 | **25,724** |
| output, thinking 포함 | **7,347** |
| 총 관측 tokens | **33,071** |
| output 상세 thinking | 835, 출력에 다시 더하지 않음 |
| 관측 assistant message ID | 2개 |

이 값은 회수한 native snapshot의 합계다. 완전한 API 응답 수, 현재 포함량 잔액이나 금전
청구액을 확정하지 않는다. 프로세스 정리 후 회수했으므로 새 모델 호출은 추가되지 않았다.
기존 캠페인 outcome의 usage 0은 **수용된 관측이 없다는 장부 합계**이며 실제 소비 0이 아니다.
원래 실패 장부는 보존하고, 회수한 33,071 tokens는 별도 102 기록에 연결했다.

초안 원문은 5,852자, 구조화 claim은 24개였다. `unmapped_claims`와
`uncovered_obligations`가 비어 있어도 올바른 연결을 보증하지 않는 반례를 확인했다.
최종 답변은 생성되지 않았으므로 모든 최종 H/Q 판정은 **UNRUN**이다.
`p0_receipt:null`, `semantic_quality_verified:false`, `full_input_observed:false`를 유지한다.
Root의 사후 진단은 독립 블라인드 평가가 아니다.

## 검증·보존·남은 작업

[102 증거](../.superpowers/verification-quality-102/)에는 실행 전 승인 범위와 고정 파일 대조,
가시 초안·메타 이벤트 형태, 사용량, 원래 실패를 재현한 로컬 감사와 종료 확인을 남겼다.
실제 실행 ticket·command·process·실패는
`.superpowers/verification-worker-95/quality101-row01/`에,
중단된 캠페인은 `.superpowers/verification-explanation-101/campaign/`에 있다.
기존 101·87·98·100의 결과나 사용량을 덮어쓰지 않았다.

다음 명령은 모델 호출 없이 실제 기록의 원래 거부, 구조화 결과 연결, CL5 coverage 거부,
사용량, 11개 UNRUN 행, 첫 행의 7개 UNRUN 단계와 실행 당시 코드 36개 보존을 재검증한다.

```powershell
node .superpowers/verification-quality-102/audit.cjs
```

이 사후 감사는 PASS했다. 제품·수집기 코드 및 테스트를 수정하지 않았으므로 101의
19파일 / 187 PASS 기록을 그대로 구분해 두었으며 전체 Node/Python/conformance를
반복하지 않았다. 프로필 설정·로그인·plugin 선택을 보존했고 잔류 소유 process는 0개다.
이번 변경은 실행 증거와 현황 문서뿐이며 commit·push·merge·게시·배포는 하지 않았다.

승인된 이번 캠페인은 첫 실패 중단 조건으로 종료했다. 후속 로컬 수정 대상은 부모의
호스트별 구조화 출력 계약, native 메타 이벤트의 엄격한 감사, 주장-질문-요구사항 연결의
생성 계약이다. 기존 실패를 보존한 정상/부정 로컬 검증 뒤 새 후보와 실행 단위를 고정해야 한다.
83회 UNRUN이나 전체 516회를 그 후보의 실행 권한으로 사용하지 않는다.
KST 9월 14일 중간 판정, 9월 19일 출하 목표와 원래 네 기능·품질 기준은 유지한다.
