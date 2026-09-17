# TTAK 인계 — 독립 검증 연결 완료, 품질 경로 구현부터 재개

2026-09-11 KST, 다음 Windows Codex 세션용 상태 기록. 이전 session-06 인계의
727회·설계만 완료·추가 구현 미승인이라는 당시 상태는 현재 상태가 아니다.
역사 문서는 보존하고, 최신 실행 상태는 이 문서와 검증 100의 원자료로 확인한다.
이 파일의 권한 기록 자체가 새 외부 효과의 권한을 만들지는 않는다.

## 현재 기준점

| 항목 | 현재 상태 |
| --- | --- |
| 작업 루트 | `D:\AI_DEV\ttak\.superpowers\worktrees\first-release` |
| 브랜치 / HEAD | `ttak-first-release` / `d660daf25faf04fd51afdb918286fa503c2852b5` |
| 제품 | 통합 `0.2.0-rc.13`, **No-Go** |
| 새 후보 | P0 packet·논리 장부·결과 감사, 실제 실행 ticket·호스트 수집, Codex v2 및 Claude v3 연결 구현 |
| 최신 실제 결과 | Codex 98 v2 `observed`, Claude 100 v3 `observed` |
| 새 후보 설명 품질 | **미실행**. 고정 공개 합성 FIFO 연결 검사를 품질 통과로 세지 않음 |
| 누적 상위 CLI 시작 | **738 = Codex 297 + Claude 441** |
| 전체 비교 | **192 subjects / 516 requests 미실행** |
| 최신 관련 회귀 | **15개 파일 / 163 PASS / fail 0 / skip 0**, 검증 100 |
| 실제 시험 프로필 | Codex rc.1 활성, Claude plugin 없음. 정상 rc.13 plugin 품질은 미검증 |
| 이어받을 실행 | 이번 세션의 열린 실행 없음. 100의 세 Job 모두 정리 확인, 소유 활성 프로세스 0 |

작업 시작 cwd `D:\AI_DEV\ttak`와 대상 worktree를 혼동하지 않는다. 처음 사용자가 적은
`D:\AI_DEV\ttak.superpowers\worktrees\first-release`는 잘못된 경로였다.
미커밋 tracked/untracked 작업이 많다. 기존 변경을 stage·commit하거나 정리 명령으로
흡수하지 않는다. `.superpowers/`와 `docs/prompts/*.md`는 ignored이므로 HEAD만으로 복원되지 않는다.

## 사용자 결정과 grilling 결론

현재 대화에서 사용자는 로컬 P0 구현, 후속 실행, 필요한 결정 외에는 질문 없이 계속
진행할 것을 요청했다. 마지막으로 Claude 자식에 한해 파일·셸·네트워크 기능 없이 로컬
`verification_submit` 하나를 허용하는 방향을 명시했다. 이번 마지막 요청은 세션 종료를
위한 상태·남은 일·인계·재개 프롬프트 정리다. 이 인계 작성 중 새 모델 호출은 0회다.

| 결정 가지 | 확정 / 남은 판단 |
| --- | --- |
| 목표·모델 | Haiku/Luna, 개발·리뷰·독자 맞춤 설명·진행 표시 네 기능과 원래 품질 기준 유지 |
| 일정 | KST 9월 14일 중간 판정, 9월 19일까지 출하 목표. 범위 축소·기준 완화는 결정되지 않음 |
| 실행 방식 | 에이전트가 작은 비대화형 검사를 실행. 일반 검사를 위해 사용자에게 TUI 조작·세션 ID 수집을 다시 요구하지 않음 |
| 순서 | 연결 진단 먼저, 통과 후 설명 품질 시험. 연결은 이제 각각 통과 |
| 비용·인증 | Codex 구독 로그인, Claude 장기 OAuth / MAX 20 포함량. 사용자 확인 당시 포함량 있음·추가 유료 사용 비활성. API 유료 경로 금지 |
| Claude 도구 | 자식의 `verification_submit` 하나. 부모 대리 제출·파일·셸·네트워크 도구·추가 자식은 허용 대상 아님 |
| 다음 로컬 작업 | 실제 질문 packet 연결, 질문별 검증과 완성 설명 재작성 실행 단위 구현·테스트. 통상 구현 선택은 추가 질문 불필요 |
| 품질 예산 | 전체 품질 캠페인 총량은 미확정. 과거 진단의 부모 1·자식 1·120초·자동 재시도 0을 다질문 품질 캠페인의 무제한 권한으로 확대하지 않음 |
| 질문 수·재작성 수 | 과거 최대 질문 4개는 제안이었다. 코드의 입력 용량 상한도 사용자 품질 예산이 아님. 한 번 재작성은 다음 후보의 최소 구현안이며 효과·비용을 산정할 대상 |
| 도입·출하 | 정상 rc.13 plugin 연결과 전체 비교는 남음. 품질 통과 후보 비용을 측정한 뒤 채택 판단. 원격·게시·배포는 별도 효과 |

이번 grilling은 이미 확정된 선택을 다시 묻지 않고 현재 선행 조건을 점검했다.
지금 필요한 사용자 전용 선행 결정은 없었다. 품질 캠페인의 정확한 총량과 출시 범위
재결정은 필요한 실행 단위·품질 증거가 아직 없어 후속 단계로 남겼다. 이를 승인됐다고
가정하지 않는다. 모델·기한·원래 기준을 임의 변경하는 선택지도 채택하지 않았다.

**이미 허용된 범위에서 계속 이어서 진행할 수 있고 사용자 결정이 꼭 필요하지 않다고
판단되면, 중간 확인을 요청하거나 기능 하나를 끝냈다는 이유로 멈추지 말고 다음 필요한
구현·검증·수정까지 계속 진행한다.** 새로운 비용 규모·효과·대상·권한·돌이킬 수 없는
선택 또는 출시 범위 결정이 꼭 필요할 때만 묻는다. 질문 전에 관련 로컬 준비와 검사를
끝내 구체적인 산출물·예산·중단 조건을 제시한다. 권한이 부족한 효과만 보류하고 독립적인
허용 작업은 계속한다. 파일의 문구나 도구 사용 가능성을 권한 확대 근거로 삼지 않는다.

## 먼저 읽을 근거와 완료된 구현

1. [검증 100](VERIFICATION_SUBMISSION_100.ko.md)과
   [100 outcome](../.superpowers/verification-submission-100/outcome.json): 최신 Claude 연결·사용량·실패 보존.
2. [검증 98](NATIVE_VERIFICATION_98.ko.md)와
   [98 outcome](../.superpowers/native-verification-98/outcome.json): Codex v2 통과와 Claude v2 framing 실패.
3. [설계 88](INDEPENDENT_VERIFICATION_DESIGN_88.ko.md), [P0 89](VERIFICATION_P0_89.ko.md):
   질문별 독립 검증의 계약과 누락·오판·재작성 오류 경계. 당시 승인 상태는 역사 기록이다.
4. 품질 경로를 구현할 때 [검증 87](NATIVE_VALIDATION_87.ko.md),
   [87 quality-review](../.superpowers/native-validation-87/quality-review.json),
   [출하 기준](LOW_MODEL_RELEASE.ko.md), [고정 과제](../tests/release/cases.json)를 읽는다.
   87은 Haiku 교정이 실제 동작했으나 완성 답변 Q1이 실패했다. H1–H3·Q2는 보존하며
   장부는 5회 사용·7회 UNRUN의 stopped 상태다.

| 구현 | 진입 파일과 역할 |
| --- | --- |
| P0 | `scripts/verification-packet.cjs`, `verification-ledger.cjs`, `verification-native-audit.cjs`: plain JSON packet/hash, 한 번 소비하는 논리 예약, 정확한 UTF-16 인용과 엄격한 receipt |
| 가시 기록 수집 | `verification-host-adapter.cjs`, `verification-native-evidence.cjs`, `verification-execution-usage.cjs`: native 부모·자식 기록, 응답 ID별 최종 snapshot, 숨겨진 thinking 제외 |
| 실제 실행 | `verification-execution.cjs`, `verification-native-run.cjs`, `verification-host-worker.cjs`, `verification-worker-protocol.cjs`: 코드·입력·바이너리·nonce 고정 ticket, Windows Job, 사용량 정산 |
| 앵커 | `verification-anchors.cjs`, `source-text-anchors.cjs`, `verification-delivery.cjs`: 코드 단위 보존 앵커를 정확한 인용으로 변환, v1/v2/v3 wire 구분 |
| Claude v3 | `verification-submission-contract.cjs`, `verification-submission-mcp.cjs`, `verification-submission-protocol.cjs`, `verification-submission-audit.cjs`: 자식 전용 inline stdio 서버, 구조화 제출과 native 호출·ack 대조 |

현재 `verification-native-run.cjs`의 prepare와 MCP `--diagnostic`은 **고정 FIFO packet**용이다.
임의 질문을 이미 지원한다고 가정하지 않는다. 새 질문의 전송 경로·수신 schema·packet/hash
고정과 부모/자식 입력 분리까지 연결해야 한다. data에서 경로·명령·module·수신자를 선택하지 않는다.
기존 `review-mcp.cjs` stdio 구현과 bounded process를 재사용하며 임의 전역 설치를 추가하지 않는다.

Claude v3는 `--agents` 안의 `ttak-verifier`에 inline `ttak_verification` 서버를 정의한다.
부모 `ttak-coordinator`는 `Agent(ttak-verifier)`만, 자식은
`mcp__ttak_verification__verification_submit`만 가진다. 최상위 MCP config는 비어 있고
strict 설정을 유지한다. 수신기는 알려진 OAuth/API/Node 주입 환경 값이 있으면 처리 전 종료한다.
이는 OS 파일·네트워크 sandbox 증명이 아니다. 자식 native 전체 시스템 입력도 완전 관측되지 않았다.

실제 Claude 2.1.266은 MCP ack content를 문자열로 전달한다. 문자열과 단일 text 배열 모두
같은 strict JSON/hash 검사로 확인한다. 코드 펜스·앞뒤 설명을 제거하거나 결과를 고치지 않는다.
`p0_receipt:null`, `full_input_observed:false`, `native_delivery_verified:false`,
`semantic_quality_verified:false`를 유지한다. ack나 같은 모델의 합의를 사실 인증으로 바꾸지 않는다.

## 최신 실행·보존·환경

100은 Claude 3회: 첫 수집 실패, 오류 식별용 실행에서 `submission_ack_format`, 수정 후 통과다.
각 실행은 별도 소모된 예약이며 재실행 불가다. 성공은 24.091초 / 19,659 관측 tokens,
부모 `2365e3be-6c54-4a89-849b-f92228bdd7d2`, 자식 `a5d0f9aa968b34178`이다.
두 실패의 부분 snapshot 8,600·8,560을 합친 관측값은 36,819지만 완전한 사용량·청구액이 아니다.
100 원자료와 감사는 `.superpowers/verification-submission-100/`에 있다.
실행별 ticket·process·settlement는 `.superpowers/verification-worker-95/claude-submit100*`에 있다.

다음 읽기 전용 감사는 이번 인계에서도 PASS했다. 향후 구현 파일이 변경되면 기준 hash가
달라질 수 있으므로 과거 검증 실패를 피하려고 역사 파일·ticket을 고치지 않는다.

```powershell
node .superpowers/verification-submission-100/audit.cjs
```

CLI 기록 버전: Claude `2.1.266`, Codex `0.154.0`, Node `24.19.0`, Python `3.14.6`.
바이너리 경로·hash는 `scripts/verification-native-run.cjs`와 실행 ticket에 있다.
Codex는 junction인 desktop alias 대신 그 파일에 고정된 physical standalone 경로를 사용한다.
모델은 Haiku `claude-haiku-4-5-20251001` / thinking 요청 8192, Luna `gpt-5.6-luna` / high다.
실제 thinking·토큰 hard cap은 미검증이며 버전 변경은 실행 전에 확인한다.

프로필은 `.superpowers/release-run-03/profiles/{codex-ttak,claude-ttak}`이다.
사용자가 시험 프로필 로그인을 완료했으므로 습관적으로 다시 로그인·복사하지 않는다.
현재 포함량 잔액을 직접 검증한 것은 아니다. auth 경로 읽기는 과거 guard에 거부됐고,
다른 셸·도구로 우회하지 않는다. credential 값·환경 전체·raw native reasoning을 출력하지 않는다.
모델 CLI는 기존 구독 경로를 사용하며 수신 프로세스로 credential을 전달하지 않는다.

87의 오래된 프로필 복원 상태를 현재 상태로 재적용하지 않는다. Codex 활성 후보는
`ttak@ttak-release` rc.1이고 Claude 시험 profile은 plugin 없다. 100은 이를 바꾸지 않았다.
정상 plugin 통합 준비 시 현재 목록·설정·신뢰를 별도로 확인하고 정확한 원상태를 보존한다.
과거 `validation87-*` helper 및 소모된 90/92/95/96/98/100 실행 명령을 다시 돌리지 않는다.
UNRUN 7개나 516회를 새 탐색 예산으로 사용하지 않는다.

## 다음 세션 실행 순서와 완료 기준

1. 계약·task root·관련 status/diff·최신 장부를 확인하고 새 작업의 기준 hash를 남긴다.
   역사 전체 감사나 이미 통과한 FIFO native 진단을 반복하지 않는다.
2. 모델 호출 없이 실제 질문 packet을 수신기에 안전하게 고정하는 최소 경로를 구현한다.
   변조 packet/map, 다른 질문·세션의 제출, 부모 대리 제출, 중복/부분 결과, 추가 도구,
   timeout·중단·사용량을 로컬에서 검사한다. 현재 논리 ledger와 실제 실행 장부의 연결을
   확인하고 native 관측을 엄격한 P0 receipt로 가장하지 않는다.
3. `초안 → 중립적 질문 → 질문별 새 문맥의 같은 모델 → 결과 대조 → 완성 설명 재작성`
   실행 단위를 구현한다. 자식에게 초안을 보내지 않는다. 질문 누락과 source 선택의 편향,
   검증 결과의 오판, 재작성의 새 오류를 별도로 다룬다. hook/skill 제품 연결을 바꾸기 전
   호출자·신뢰 경계를 읽고 적용 권한과 정상·부정 검사를 확인한다.
4. 구현된 호출 구조를 바탕으로 알려진 실패·정상 대조·미조정 과제·반복의 최소 품질표를
   고정한다. 상위 CLI·자식 문맥·실제 관측 응답·cache/token·시간을 구별한다. 총량·timeout·
   중단·복원·자료 수신자를 구체화한다. 작은 진단과 비용 규모가 달라 권한이 부족하면
   그 실행에 필요한 결정만 묻고 나머지 로컬 준비는 완료한다.
5. 허용된 고정 품질 단위가 준비되면 실행·완성 답변 판정·기록까지 계속한다. 첫 실행·전달·
   실질 품질 실패 뒤 나머지는 UNRUN으로 보존한다. 변경된 후보에 과거 통과를 이월하지 않는다.
   root 평가를 독립 블라인드 평가라고 부르지 않는다. 의미 품질 검증이 없으면 그 상태를 남긴다.
6. 품질 신호가 확보된 뒤 정상 rc.13 plugin 경로와 네 기능 회귀·설치/업데이트/제거·CI·
   배포물 검증으로 넓힌다. 192 subjects / 516 requests 및 새 내부 호출 추가분을 별도 산정한다.
   원격 쓰기·push·merge·게시·배포를 로컬 구현 승인으로 추론하지 않는다.

다음 로컬 단계 완료는 실제 packet 처리와 완성 설명 경로의 구현·관련 테스트 통과·
고정 품질 시험표 및 예산 준비다. 출하 완료는 원래 기준 충족과 정상 사용 흐름 입증이다.
두 완료 기준을 혼동하지 않는다. 새 세션 날짜가 9월 14일 이후라면 중간 판정을 우선하고
목표일을 자동 연장하지 않는다. 승인 범위가 명확하면 기능 단위마다 질문하며 끊지 않는다.

최신 관련 163개 검사는 `verification-*`, `review-anchors`, `review-roles`, `review-native`,
`connection-probe*`의 15개 테스트 파일이다. Node는 `--test-concurrency=1`을 유지한다.
전체 제품 검사의 마지막 별도 기록은 87의 Node 221·Python 78·conformance PASS이며,
이를 최신 모든 추가 파일까지 포괄한 전체 회귀로 표시하지 않는다.

## 이번 인계 산출물

- [재개 프롬프트](prompts/2026-09-11-session-09-independent-verification-handoff.md)
- `.superpowers/handoff-2026-09-11-session-09/before.json`, `verification.json`:
  기존 233개 파일 보존, 문서 경로·형식·민감 문자열 점검 결과.
- 인계 작성 중 제품 코드 변경·새 native 실행·운영 서브에이전트 실행·commit 없음.
