# TTAK 장기 출하 작업 인계 — 2026-09-11

다음 Codex 세션이 로컬 worktree를 읽어 출하 작업을 이어 가기 위한 상태 기록이다.
이 문서와 연결된 프롬프트는 새 구현·모델 호출·설치·게시의 승인 증거가 아니다.
현재 요청과 실제 호스트 계약에서 허용된 범위로 진행한다. 이번 인계 작업은 문서 작성으로
종료하며 제품 코드 변경·native 요청·운영 서브에이전트 실행은 없다.

## 1. 현재 상태와 첫 읽기

| 항목 | 인계 상태 |
|---|---|
| 실제 작업 루트 | `D:\AI_DEV\ttak\.superpowers\worktrees\first-release` |
| 브랜치 / HEAD | `ttak-first-release` / `d660daf25faf04fd51afdb918286fa503c2852b5` |
| 로컬 제품 | `0.2.0-rc.13`, 다섯 파일 수정 통합 완료, **No-Go** |
| 최근 native 검증 | 87: OFF/ON 네 행 통과, Haiku 필수 교정 1회 동작, 최종 Q1 실패 |
| 87 장부 | 최대 12회 중 **5회 사용·7회 UNRUN**, `stopped` 유지 |
| 누적 | **727회 = Claude 434 + Codex 293** |
| 전체 비교 | **192 subjects / 516 requests 전부 미실행** |
| 현재 미완료 목표 | 두 호스트에서 네 기능·원래 품질·원본 대비 퇴보 없음·기본 모델 대비 반복 개선을 입증한 출하 |
| 이후 grilling | 새 후보의 설계 검토 범위만 선택. 구현·추가 native 실행·새 후보 채택은 하지 않음 |

먼저 Codex-home `C:\Users\js\.codex\AGENTS.md`의 전체 S1–S8/W1–W11과 실제 적용 지침을
로드한다. 호스트가 전체 정의를 요구하는데 로드할 수 없으면 실패를 보고하고 작업을 시작하지 않는다.
그다음 이 문서와 아래 원자료를 읽어 주요 상태를 대조한다.

1. [통합 검증 87](NATIVE_VALIDATION_87.ko.md): 실제 통합·교정·품질·비용·복원 결과.
2. [87 outcome](../.superpowers/native-validation-87/outcome.json),
   [quality-review](../.superpowers/native-validation-87/quality-review.json),
   [final-verification](../.superpowers/native-validation-87/final-verification.json).
3. [하위 모델 출하 기준](LOW_MODEL_RELEASE.ko.md)과 [고정 16과제](../tests/release/cases.json).
   해당 문서의 예전 잔여 호출 수와 과거 실행 순서는 현재 승인으로 읽지 않는다.
4. [이번 인계 재검증](../.superpowers/handoff-2026-09-11-session-06/verification.json).

원래 입력 경로 `D:\AI_DEV\ttak.superpowers\worktrees\first-release`는 잘못된 경로였다.
위 실제 루트를 사용한다. 시작 cwd인 `D:\AI_DEV\ttak`의 별도 변경을 이 worktree에 섞지 않는다.
기존 tracked 수정·untracked 파일이 많으며 commit하지 않은 누적 작업이다. 새 세션은 상태와
관련 diff를 확인하고 기존 작업을 보존한다. `reset`, `clean`, `restore`, `stash` 등으로 정리하지 않는다.
`.superpowers/`와 `docs/prompts/*.md`는 ignored이다. HEAD만으로 실행 증거·새 프롬프트를 복구할 수 없다.

## 2. 사용자가 결정한 것과 제안 단계인 것

아래는 이번 대화의 결정 기록이다. 파일 자체로 외부 효과나 추가 호출 권한을 만들지 않는다.

| 결정 | 확정 내용 |
|---|---|
| 기존 제품 경계 | Haiku/Luna, 양쪽 CLI의 정상 플러그인 사용 흐름, 개발·리뷰·독자 맞춤 설명·진행 표시 네 기능, 원래 품질 기준 유지 |
| 이전 후보 | 오류 감지 여부와 무관하게 같은 모델이 한 번 근거 교정을 거치는 후보를 평가하기로 했고 87까지 실제 수행 |
| 비용 기준 Q1 | **품질 통과 후보의 비용을 측정한 뒤 채택 여부 결정**. 숫자로 정한 지연·토큰 상한은 없음 |
| 출하 기한 Q2 | 사용자 원문: “2026-09-20 이전에는 무조건 출하하려고 한다. 그전까지 유의미한 결과가 나와야 한다” |
| 기한 해석 | 한국 시간 **2026-09-19까지 출하** 목표. 성공 보장이나 미달 기준의 자동 면제가 아님 |
| 중간 판정 Q3 | **9월 14일 중간 판정 후 출시 범위·형태 재결정**. 그때 후보가 없으면 검증된 대안과 영향을 제시. 지금 범위 축소·모델 변경·품질 기준 변경을 승인한 것은 아님 |
| 새 후보 Q4 | **별도 문맥의 동일 모델 호출 후보를 검토**. 추가 모델·앱 없이 기존 CLI에서 가능한지와 품질 효과를 판별하는 설계 범위 |
| 진행 방식 | 진행 방법을 구체적으로 브리핑하고 필요한 확인 뒤 실행. 환경이 답할 수 있는 질문과 이미 결정한 선택을 반복하지 않음 |

assistant가 제안했지만 아직 실행 계약으로 확정하지 않은 항목:

- 설명 한 건당 검증 질문 최대 **4개**, 완성 설명 수정 최대 **1회**.
- 9월 11–12일 후보·연결·시험 설계, 13–14일 실제 품질 판별, 15–18일 전체 검증·출하 준비,
  19일 최종 출하 판정이라는 시간 배분. 날짜별 작업 완료를 보장하지 않는다.
- 구체적인 새 native 시험 행·호출 수·내부 호출 수·토큰·timeout·취소 계약. **아직 산정·승인 전**이다.

날짜가 바뀐 세션은 현재 한국 시간을 확인해 남은 기간으로 다시 계획한다. 9월 14일이 지났다면
중간 판정을 우선하며, 기록의 마감일을 자동으로 뒤로 미루지 않는다. 예약된 자동 실행이나
백그라운드 일정 작업은 없다. 품질 충족 후 비용 선택은 무제한 호출·API 과금 허용이 아니다.

## 3. rc.13 통합 검증에서 실제로 확인한 것

검토된 [86 패치](../.superpowers/native-diagnosis-86/proposed-rc13.patch)를 적용했다.
변경 다섯 파일은 양쪽 `plugin.json`, `hooks/scenario-evidence.cjs`,
`tests/scenario-evidence.test.cjs`, `tests/scenario-package.test.cjs`다.
각 파일의 적용 전후 해시는 [87 scope](../.superpowers/native-validation-87/authorization-and-scope.json)에 있다.

Claude의 실제 `tool_response`는 JSON 문자열이었다. rc.13은 문자열을 단일 text block으로
정규화하고 기존 content 배열·전체 객체와 동일하게 재계산 결과의 완전 일치를 검사한다.
인자 키·오류·structured 결과 대조, 턴 격리·TTL·파일 보호·한 번만 소비하는 제한은 유지했다.
잘못된 JSON·뒤에 붙은 텍스트·직렬화한 wrapper·다른 계산값은 계속 거부한다.
진단용 원문 로깅은 제품에 추가하지 않았다.

87은 정상 CLI 설치 경로로 작업용 프로필에 후보를 설치했다. 런타임 25개 파일과 수집기·
상대 require 의존성 등을 포함한 37개 입력, 실행 파일 해시를 고정했다.
양쪽 OFF/ON 네 행은 통과했다. Claude 제어는 모델 턴·토큰 0이었다. Codex 제어에는
모델 메시지·도구 항목이 없었으나 사용량이 미보고라 토큰 0으로 단정하지 않는다.

첫 Haiku 설명에서 `PostToolUse`가 성공했고 첫 Stop은 실제 시나리오에서 재계산한 필수
근거 교정 사유와 완전히 일치했다. 완성된 수정 답변이 나온 뒤 두 번째 Stop은 개입하지 않았다.
따라서 이 사례의 필수 교정 전달은 통과다. 최종 설명에는 다음 Q1 오류가 남았다.

| 오류 | 수정 후 상태 |
|---|---|
| SI의 충돌 종류 | 행 단위 read-write 충돌 탐지와 쓰기 충돌 처리를 혼동하는 설명 유지 |
| PostgreSQL SSI | 위험 구조와 cycle을 혼동하고 탐지를 commit 시점으로 한정 |
| 비용 | 낙관적 방식은 충돌할 때만 비용을 낸다는 주장 유지, 감시 비용 누락 |
| 잠금 | 잠금 모드·획득 조건 없이 동시 실행 자체를 방지한다고 단정 |

Root 판정은 **H1–H3·Q2 PASS, Q1 FAIL**이다. 유효한 구체 예·Serializable 해결책·재시도
비용 언급의 통과는 보존했다. 이번 판정은 독립·블라인드 채점이 아니다. 문구 검사에서 문제
0개가 나온 것과 최종 답변의 자기평가는 의미상 정확성의 증거가 아니다.

전체 프로세스 55,289ms, 첫 완성 답변→수정 답변 28,220ms, 마지막 교정 응답 출력 2,362 tokens.
전체 사용량은 입력 28, 캐시 생성 입력 16,494, 캐시 읽기 입력 27,204, 출력 4,428이다.
thinking 2,078은 출력 상세이며 출력에 다시 더하지 않는다. 이 수치는 단일 연쇄 관측이고
교정 없는 대조군 대비 순수 추가 비용·평균 성능·정상 답변 피해율이 아니다.

첫 품질 실패에서 87을 중단했다. Luna 설명 품질, 정상 답변 영향, 조정에 쓰지 않은 사례,
반복 재현성은 모두 UNRUN이다. 새 후보의 성공으로 이 빈 행을 채우거나 87을 재개하지 않는다.
[87의 다음 결정](../.superpowers/native-validation-87/next-action-decision.json)은 같은 후보 재실행
기각이다. 이후 Q4의 새 설계 검토와 모순되지 않으며 87 파일을 새 결정으로 덮어쓰지 않는다.

## 4. 새 후보: 질문별 근거 확인과 입력 분리

현재 권고는 **초안의 확인할 사실을 중립적 질문으로 만들고, 원래 답변을 보지 않는 별도
문맥에서 같은 모델이 근거와 함께 답한 뒤, 완성 설명을 한 번 수정하는 후보**를 먼저 판별하는 것이다.
최적해·출하 해결책으로 채택하지 않았고 새 버전 번호·구현·native 결과도 없다.

흐름은 `과제·초안 → 검증 질문 구성 → 질문별 독립 확인 → 결과 대조 → 완성 설명 수정`이다.
검증 입력에는 질문·필요한 조건·근거만 포함하며 초안의 결론, 다른 검증자의 답변, 불필요한
대화 이력을 전달하지 않는 것을 목표로 한다. 검증 질문에 잘못된 결론을 전제로 숨기는지도 본다.
같은 모델의 문맥 여러 개는 다른 모델 계열의 독립 증거가 아니다.

| 핵심 반론 | 다음 설계에서 답할 내용 |
|---|---|
| 질문 누락 | 중요한 주장이 질문으로 만들어지지 않을 때의 처리. 질문 개수·문단 coverage만으로 완전성 인증하지 않음 |
| 검증 답변 자체의 오류 | 근거와 다른 주장·없는 근거·상충·미확인의 처리. 같은 모델 동의나 다수결을 정확성 증명으로 사용하지 않음 |
| 최종 재작성 오류 | 확인 결과가 정확해도 완료 설명에 새 오류가 생길 수 있으므로 전체 H/Q 평가 |
| 입력 분리 실패 | 실제 하위 입력과 상속 문맥 확인. 같은 대화에서 초안을 무시하라는 지시를 독립 문맥으로 보고하지 않음 |
| 근거 공급 | 검증된 번들 근거·사용자 제공 자료·기존 도구 중 무엇이 실제 공급하는지 명시. 정적 요약 시험을 자동 검색의 성공으로 보고하지 않음 |
| 비용과 종료 | 상위 요청·하위 문맥·API 응답·토큰·cache·시간을 분리 계수. 반복·재귀 위임·취소·timeout·부분 결과·프로세스 종료에 유한 상한 필요 |
| 제품 적합성 | 한 번 설치한 양쪽 CLI에서 동작하고 독자 맞춤 완성 설명을 유지. 미확인 답변·계산 블록·차단 메시지를 과제 통과로 처리하지 않음 |

질문 4개·수정 1회는 제안값이다. 상한에 맞추려고 필수 주장을 평가에서 빼거나 미완료를 성공으로
세지 않는다. 개발자가 87의 오류 위치·정답을 직접 넣은 실험은 구성요소 진단이며 제품 효과가 아니다.

### 호스트 연결의 확인 수준

각 CLI의 내장 서브에이전트 기능을 우선 검토한다. 바로 별도 실행기를 새로 만들기로 결정하지 않았다.
2026-09-11 읽은 [Claude Code subagents 문서](https://code.claude.com/docs/en/sub-agents)는 일반
서브에이전트가 대화 이력을 받지 않고, fork는 전체 이력을 상속한다고 명시한다. 프로젝트 지침과
도구 권한 등 별도로 상속되는 내용도 있으므로 별도 문맥이라는 이름만으로 입력 격리를 단정하지 않는다.
[Claude plugin 문서](https://code.claude.com/docs/en/plugins-reference)는 plugin의 agent 구성도 설명한다.

[Codex 공식 subagents 문서](https://learn.chatgpt.com/docs/agent-configuration/subagents)에서 위임·모델 및
추론 설정·종료 관리 기능을 확인했다. 그러나 현재 설치된 `0.154.0`에서 **원래 이력 없이 시작하는
정확한 연결과 정상 plugin에서의 입력 통제까지는 확인하지 못했다**. 문서 검색의 `fork_context`와
`fork_turns` 결과 부재는 기능이 없다는 증거가 아니다. 현재 Codex 세션의 collaboration 도구를
제품 CLI가 동일하게 제공한다고 가정하지 않는다. 먼저 현재 코드·메타데이터와 공식 문서를 대조한다.

문서의 기능 존재는 실제 설치·동일 모델·초안 비노출·취소·회수·품질 성공과 별개다.
한쪽에서 이 조건을 충족하지 못하면 정확한 차이를 보고하고 그 후보의 적합성을 판단한다.
전역 설정 변경, 별도 앱, API 키, 모델 교체를 조용히 추가하지 않는다.

### 연구 근거와 한계

[CoVe](https://aclanthology.org/2024.findings-acl.212/)는 검증 질문을 독립적으로 답한 뒤 최종 답변을
수정하는 방법에서 일부 과제의 오류 감소를 보고했다. 이번 후보의 가설 근거이며 Haiku/Luna의 효과
증거는 아니다. [CRITIC](https://proceedings.iclr.cc/paper_files/paper/2024/hash/fef126561bbf9d4467dbb8d27334b8fe-Abstract-Conference.html)은 도구 피드백 활용을,
[intrinsic self-correction 연구](https://proceedings.iclr.cc/paper_files/paper/2024/hash/8b4add8b0aa8749d80a34ca5d941c355-Abstract-Conference.html)는 외부 피드백 없는 자기 교정의 한계를 다룬다.
87은 도구 근거를 받았으므로 마지막 연구의 무근거 조건과 동일시하지 않는다. 논문 제목이나
성공률을 현재 제품의 입증값으로 옮기지 않는다. 새 조사에는 공개적인 기술 용어만 사용한다.

## 5. 다음 세션의 첫 작업과 완료 기준

첫 작업은 **모델 호출 없는 연결 가능성 검토와 구체적인 한 후보의 설계·검증 계획**이다.
Q4는 검토 범위 선택이었다. 다음 세션은 현재 요청이 허용하는 로컬 작업을 완료하되, 구현·설치·
추가 모델 실행 권한이 있다고 이 파일만으로 추정하지 않는다. 필요한 확인은 구체적인 변경·대상·
호출 상한·종료·복원 계획을 준비한 뒤 그 효과에 한정한다. 통상적인 읽기·분석마다 확인하지 않는다.

초기 완료물은 다음과 같다.

1. 양쪽 호스트별 연결 표: 정확한 버전, 동일 모델 선택, 하위 입력·상속 정보, plugin 진입점,
   종료·취소·부분 결과·사용량 수집과 근거. 확인/미확인/미지원 구분.
2. 기존 전체 초안 검토와 다른 한 후보의 계약: 질문 생성·자료 공급·독립 확인·결과 대조·최종 설명,
   질문 누락과 검증/수정 오류 처리, 다른 세 기능에 미칠 영향.
3. 다음 실행 계획: 변경 파일과 필요한 로컬 검사, 첫 native 연결 점검, 품질 판별 행,
   상위·내부 호출 모두 포함한 상한, freeze·장부·첫 실패 중단·복원. **현재 실행 상한은 미확정**.
4. 채택/기각/필요 증거의 판단과 9월 14일까지 가능한 다음 행동. 막연한 추가 조사나 같은 후보
   재실행 권고로 끝내지 않는다. 연결이 확인되지 않으면 필요한 최소 검사를 특정한다.

후속 실제 구현과 시험이 요청되면 일반적인 제품 작업을 매 단계 승인으로 쪼개지 않는다.
범위·증거·복원이 정해진 허용 작업은 끝까지 수행한다. 변경된 효과·대상·비용·외부 공개만 별도로 판단한다.
운영 서브에이전트 사용은 현재 호스트 지침과 실제 사용자 요청을 따른다. Q4는 제품 내부 후보의
검토 결정이며 이 세션의 임의 위임 실행이나 과거 session-05의 Luna/max 역할을 자동 재승인한 것이 아니다.

품질 판별에는 알려진 실패, 정상 대조, 조정에 쓰지 않은 과제, 양쪽 반복이 필요하다.
해당 행·횟수는 준비 후 결정한다. 같은 후보·입력·버전·기준을 실행 전에 고정하고 최초 실행·
전달·실질 품질 실패 뒤 나머지는 UNRUN으로 남긴다. 새 후보의 결과를 이전 후보 성공 행에 이어 붙이지 않는다.
Root 단독 검토를 독립·블라인드 채점으로 표시하지 않는다. 독립 검토가 실제 허용·수행되는 경우에도
동일 모델 계열의 공통 오류와 root 재확인 필요성을 기록한다.

## 6. 반복하지 말아야 할 조사와 관련 파일

| 필요한 판단 | 이미 있는 근거 / 읽을 자료 |
|---|---|
| 문자열 전달 경계 | [84](NATIVE_VALIDATION_84.ko.md)·[85](NATIVE_VALIDATION_85.ko.md) 실패 후 [86](NATIVE_DIAGNOSIS_86.ko.md)에서 실제 문자열 확인, 87에서 필수 교정 동작. 84의 배열 가정을 최신 사실로 사용하지 않음 |
| 전체 초안·독립 의미 검토 | [47](REASSESSMENT_47.ko.md)·[49](ROLE_SCREEN_49.ko.md)는 당시 Sonnet 경로, [54–56](LOW_MODEL_EXPLANATION_DIAGNOSTICS.ko.md)은 Haiku의 누락·오판. 모든 별도 문맥의 불가능성 증명은 아님 |
| 기본 모델·최초 근거 제공 | 같은 [설명 진단](LOW_MODEL_EXPLANATION_DIAGNOSTICS.ko.md)의 57은 baseline에도 오류, 59는 최초 공식 근거 제공 후 오류. 지침만이 원인이라고 단정하지 않음 |
| 최종 자유 문장 경계 | [70](REASSESSMENT_70.ko.md), [71](HOST_OUTPUT_CONTRACT_71.ko.md), [82](PRECISION_AUDIT_82.ko.md), [87](NATIVE_VALIDATION_87.ko.md). 전체 답변 감사는 이미 있음 |
| 전체 출하·기능 개선 | [60 개발 비교](DEVELOPMENT_DIAGNOSTIC_60.ko.md), [61 리뷰 재사용](REUSE_AUDIT_61.ko.md), [출하 기준](LOW_MODEL_RELEASE.ko.md). 한 기능 결과로 다른 기능 실패를 상쇄하지 않음 |

문구별 정규식 추가, 같은 답변 재독, 근거 링크 추가만을 새로운 효과 근거로 사용하지 않는다.
공통 최종 출력 교체 API의 미확인은 원래 품질 목표의 불가능성 증명도 아니다. 보편적 무오류,
결정론적 출력, 첫 오답 표시 전 차단은 새 필수 요구가 아니다. 정상 최초 답변→교정→완료 경로는 허용된다.
727회는 다양한 진단의 누적이며 동일 과제 727개나 대안 간 통제 비교가 아니다.

현재 코드를 다룰 때의 진입점:

- `skills/ttak-explain/SKILL.md`, `hooks/hooks.json`, `hooks/ttak.cjs`, `hooks/scenario-evidence.cjs`,
  `hooks/scenario-stop.cjs`: 실제 설명·이벤트 경로. `SubagentStart`에도 정책 주입이 있어 검토 대상이다.
- `scripts/scenario-feedback-mcp.cjs`, `scenario-draft.cjs`, `finite-scenario*.cjs`: 현 MCP는 로컬 계산이며
  모델 호출을 하지 않는다. 기존 도구의 계산 범위를 자유 문장 전체의 정확성으로 확대하지 않는다.
- `scripts/review-native.cjs`, `review-native-format.cjs`, `review-roles.cjs`, `review-anchors.cjs`:
  실험용 native 운송과 검토 계약. `review-native.cjs`는 baseline 프로필·readiness·버전에 의존하므로
  정상 설치 제품에 이미 연결된 범용 실행기로 취급하지 않는다.
- `scripts/bounded-native-process.cjs`, `bounded-native-cli.cjs`, `windows-job.ps1`, `windows-job.cs`,
  `review-screen-ledger.cjs`, `scenario-native-audit.cjs`: 종료·계수·실행 감사 재사용 후보.
- `tests/release/collect.py`, `release_runtime.py`, `low_study.py`, `low_models.py`, `hook_review.py`,
  `scripts/test-local.cjs`: 원래 비교·실제 설치·전체 로컬 검증. 원격 CI는 `.github/workflows/ci.yml`.

## 7. 실행 환경·검사·장부·복원

검증 87에서 고정한 버전은 Claude Code `2.1.266`, Codex `0.154.0`, Node `v24.19.0`,
Python `3.14.6`이다. [native-plan](../.superpowers/native-validation-87/native-plan.json)에 실행 파일
경로·SHA-256과 37개 입력 해시가 있다. 실행 전에 현재 바이너리와 실제 기능을 다시 확인한다.
CLI 자동 업데이트가 과거 실패 결과를 무효화하지는 않지만 새 실행 조건은 달라질 수 있다.

대상 모델은 Haiku `claude-haiku-4-5-20251001` / thinking 요청 8192와 Luna `gpt-5.6-luna` / high다.
Haiku의 실제 thinking 상한 적용은 미검증이다. 운영 메인·심사자 설정을 대상 모델 조건과 섞지 않는다.
과거 session-05의 Astra/max·Luna/max 권고를 현재 실제 모델이나 새 호출 승인으로 간주하지 않는다.

최근 실제 전체 로컬 검사는 **Node 221개(22개 파일), Python 78개, conformance PASS, skip 0**이다.
87의 [검사 결과](../.superpowers/native-validation-87/local-checks/result.json)와 로그가 근거다.
이번 인계에서는 전체 테스트를 다시 실행하지 않았다. 향후 관련 제품 변경이 있으면 기존 runner를
검토하고 필요한 검사를 실행한다. Node 테스트는 **`--test-concurrency=1`**을 유지한다.

```powershell
$env:TTAK_TEST_PYTHON='C:\Users\js\AppData\Local\Python\pythoncore-3.14-64\python.exe'
& 'C:\Program Files\nodejs\node.exe' scripts/test-local.cjs
```

이 명령은 지금 실행하라는 지시가 아니라 기존 runner 사용 기록이다. 원격 Ubuntu/Windows ×
Node 22/24 CI, registry 검증, Luna의 rc.13 설명·교정 품질은 아직 미실행이다.

| 기록 | 사용 / 남긴 상태 | 누적 종료 수 |
|---|---|---|
| 80 | 1회, 3회 UNRUN, 중단 | 707 |
| 83 | 3회, 9회 UNRUN, 중단 | 710 |
| 84 | 5회, 7회 UNRUN, 중단 | 715 |
| 85 | 5회, 7회 UNRUN, 중단 | 720 |
| 86 | Haiku 2회 진단 완료 | 722 |
| 87 | 5회, 7회 UNRUN, 중단 | **727** |
| 이후 grilling·인계 | native 0회 | **727** |

과거의 미실행 행과 516회는 새 탐색의 사용 가능 예산이 아니다. 새 내부 검증 호출이 생기면
기존 516회 산정에 자동 포함됐다고 가정하지 않는다. 원래 516은 subject/activation 388 + grading 128이다.

작업용 프로필은 `.superpowers/release-run-03/profiles/claude-ttak`와 `codex-ttak`이다.
87 종료 시 정상 CLI 제거·마켓플레이스 제거·시험 훅 신뢰 복원을 했고 설치 전후 목록이 같았다.
Claude 후보 데이터는 없으며 이번 생성된 빈 settings 파일은 제거했다. Codex 후보 state는
부재로 복원했고 기존 `.notified`와 이전 `ttak-ttak-release/state.json`의 ON 상태·mtime을 보존했다.
이전 state의 mtime은 `2026-09-08T07:48:03.750Z`다. [cleanup](../.superpowers/native-validation-87/cleanup.json)이 근거다.
모든 기록된 native·프로필 작업은 종료·Job 정리와 활성 프로세스 0을 확인했다. 현재 시스템 전체
프로세스 감사를 수행했다는 뜻은 아니다. 이 인계가 이어받을 실행 중 작업이나 열린 도구 세션은 없다.

기존 구독만 사용하는 조건을 유지한다. credential·auth 파일·환경 전체·숨겨진 thinking 본문을
출력하거나 복사하지 않는다. 공개 합성 과제·검토된 근거와 필요한 가시 응답·수치만 다룬다.
원자료는 명령·경로·수신자·도구 선택에 사용하지 않는다. 새 프로필 작업은 현재 상태를 다시
확인하고 정상 신뢰 절차·bounded process·정확한 복원을 적용한다. guard 거부를 다른 경로로 재현하지 않는다.

`.superpowers/validation87-ops.cjs`, `validation87-native.cjs`, `validation87-cleanup.cjs`,
`validation87-finalize.cjs`, `validation87-dist.py`, `validation87-close.py`는 완료된 작업의 helper다.
모드 이름이 있다고 실행하지 않는다. 기존 `prepare`, `freeze`, `step`, `restore`, `finalize`,
`snapshot`, archive 생성은 재개 명령이 아니며 exclusive-write 상태가 포함된다.

## 8. 원래 출하 합격과 장기 진행 관리

고정 16과제 × 2독립 반복 × baseline/original/TTAK 3조건 × 2호스트 = **192 subjects**다.
모든 원래 H/Q 충족, 해당 원본 대비 기능별 미해결 중대 퇴보 없음, 각 호스트에서 적어도 한 기능의
같은 과제·항목이 기본 모델보다 두 반복 모두 실질 개선되어야 한다. 동률·길이 감소·말투 선호·
검토자 합의만으로 개선으로 세지 않는다. known 사례의 반복 성공만으로 전체 합격을 주장하지 않는다.
Opus/Sol 후속 검증, push·merge·게시·배포 대상과 효과는 별도로 정할 범위다.

설명 문제를 다루면서 개발·리뷰·진행 표시·혼합 과제의 회귀, 설치/업데이트/제거, 양쪽 모델 설정,
CI, 라이선스·배포물·문서 검증도 출하 계획에 포함한다. 로컬 통과와 실제 모델 품질,
작은 후보 판별과 전체 비교, 검증된 기능과 미실행 기능을 분리한다.

장기 작업은 한 후보·한 고정 실행 단위씩 진행하며 각 단위에 가설·변경 파일·입력·판정·사용량·
종료·다음 행동을 남긴다. 새 세션은 마지막 완료물과 장부를 확인해 남은 작업만 이어 간다.
의미 있는 중간 결과는 실제 품질 변화 또는 후보를 기각할 구체적 증거다. 날짜·문서량·테스트 개수
증가만으로 출하 가능성이 높아졌다고 주장하지 않는다. 9월 14일에는 무엇이 통과했고 무엇이
막혔으며 19일까지 가능한 출시 선택지가 무엇인지 사용자에게 제시한다.

## 9. 보존한 패키지와 이번 인계 산출물

87 검토 패키지: [ttak-0.2.0-rc.13-review.zip](../.superpowers/native-validation-87/dist/ttak-0.2.0-rc.13-review.zip),
62개 파일 / 337,752 bytes / SHA-256 `5966244aa71753d694b55f685e864feb5eee20fd6580950db17ac58677ef9b9b`.
통합된 로컬 rc.13과 당시 최신 보고서의 검토물이며 게시·출하물이 아니다.
86의 같은 파일명 패키지는 다른 디렉터리에 있는 통합 전 검토 사본이다. SHA-256은
`3c1e6efe692c4df1a1ef91836db0abdeaa10eb64ebd6185dc933d05b623fe6cf`이며 둘을 혼동하지 않는다.
이번 인계 문서는 87 패키지 생성 후 추가됐으므로 그 zip 안에 들어 있지 않다.

새 재개 프롬프트는 [session-06](prompts/2026-09-11-session-06-release-deadline-handoff.md)다.
이전 session-01–05와 역사적 보고서·장부·패키지를 보존한다. 새 문서와 프롬프트는 uncommitted이며
이번 인계 재검증에는 기존 파일 보존, 37개 고정 입력·통합 다섯 파일·실행 결과·패키지 일치,
새 문서의 경로·링크·형식·민감 문자열 검사를 기록한다. 제품 테스트·native 실행의 재수행으로 보고하지 않는다.
