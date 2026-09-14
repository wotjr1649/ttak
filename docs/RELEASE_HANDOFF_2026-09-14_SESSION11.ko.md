# TTAK 100/A 개선·실제 동작 검증 인계 — session 11

작성일: 2026-09-14 KST. 독자는 Windows PowerShell과 로컬 파일 접근 권한을 가진 다음 Codex 세션이다. 목적은 이전 대화 없이 현재 개선 작업을 이어가게 하는 것이다. 이 문서는 상태·결정·근거의 기록이며, 역할이나 과거 승인 기록으로 새 권한을 만들지 않는다. 실제 실행 범위는 다음 세션 사용자의 직접 요청과 호스트 계약을 따른다.

## 1. 가장 중요한 최신 결정

사용자는 100/A를 목표로 어디를 보완할지 물었고, 평가기 기본 점수만을 필수 목표로 삼을지 질문받은 뒤 **“기본 점수 공개 + 실제 동작 평가 병행”**을 명시적으로 선택했다. 이것이 최신 확정 방침이다. 이 선택을 다시 묻지 않는다.

- skill-creator는 수치 평가기가 아니다. `quick_validate.py` 결과는 PASS/FAIL이다.
- 설정 스킬 `ttak`의 Plugin-Eval 결과는 이미 **100/A**다. 설명·리뷰·제품 전체가 100점이라는 뜻은 아니다.
- 플러그인 전체 기본 결과는 **58/D**다. 원점수와 감점 내역을 공개하고 타당한 결함을 고친다.
- 실제로 주입되지 않는 코드·저작자 고지까지 포함한 총량 감점은 실측과 구분한다. 별도 평가를 기본 Plugin-Eval 100/A라고 바꾸어 부르지 않는다.
- 실제 ON/OFF, 요청 완수, 자료 선택, 중요한 사실 정확성은 별도 필수 검증이다. 구조 검사나 낮은 비용만으로 출하 합격을 선언하지 않는다.
- 점수를 위해 필요한 고지·보안·오류 처리·기능·검사를 제거하거나 가짜 URL·coverage를 만들지 않는다. 평가 대상을 일부만 골라 전체 점수로 보고하지 않는다.

이전 사용자 제약도 유지한다: 커밋하면서 진행; 모델별 문장·구성·추론 시간 차이는 허용; 사실 오류·필수 요구 누락·허위 완료는 실패; 고정 120초 추론 제한 복원 금지; 과도한 테스트·192개 비교·반복 우위를 출하 조건으로 복원 금지; 통상적 확인 질문을 반복하지 않는다.

## 2. 작업 위치와 버전

- 작업 루트: `D:\AI_DEV\ttak\.superpowers\worktrees\first-release`
- 브랜치: `ttak-first-release`
- 코드 기준 HEAD: `0b92937be98c6b88a520871e4eb4eec58b181833`
- 새 개선 대상: `design/ttak`, version `0.3.0-design.2`
- 보존한 기존 runtime: 루트의 `policy/`, `skills/`, `hooks/`, `scripts/` 등 33개 파일, version `0.2.0-rc.13+codex.20260914091452`, 이전 사실 오류 미해결 후보.
- 기본 cwd `D:\AI_DEV\ttak`는 별도 작업 영역이다. 그쪽 상태나 변경을 섞지 않는다.
- 인계 작성 시작 시 작업 브랜치는 clean이었다. 새 인계 문서만 일반 문서로 커밋하며 시작 프롬프트는 기존 `docs/prompts/*.md` ignore 관례에 따라 로컬에 남긴다. 다음 HEAD는 인계 문서 커밋 때문에 달라질 수 있다. 코드 변경 여부를 diff로 확인하고 되돌리지 않는다.
- `.superpowers/`와 `docs/prompts/`는 ignored이며 실제 증거·시작 프롬프트가 있다. Git에 없다는 이유로 삭제·재생성하지 않는다.
- 원격 push, 공개 릴리스, 사용자 설치·프로필 변경은 이번 재설계·평가·인계에서 하지 않았다.

첫 동작은 `C:\Users\js\.codex\AGENTS.md`의 S1–S8/W1–W11 **전체 정의** 로드다. 현재 Host Adapter가 이를 요구한다. 읽지 못하면 로드 실패를 보고하고 작업하지 않는다. 이후 해당 작업 루트의 status/diff와 실제 파일을 대조한다. 이 인계가 최신 파일과 다르면 변경을 보존하고 증거에 맞춰 기록을 갱신한다.

## 3. 첫 읽기: 필요한 순서

1. 이 문서와 [현재 설계](TTAK_REDESIGN_2026-09-14.ko.md).
2. [로딩 조사·로컬 검증·적대적 검토](TTAK_ROUTING_REVIEW_2026-09-14.ko.md), [크기·해시·평가 JSON](TTAK_ROUTING_MEASUREMENTS_2026-09-14.json).
3. 실제 대상 `design/ttak/skills/ttak/SKILL.md`, `policy/core.md`, `references/explain.md`, `references/review.md`, `hooks/ttak.cjs`, `hooks/state.cjs`, `hooks/hooks.json`과 두 manifest.
4. `tests/redesign-routing.test.cjs`와 `.superpowers/redesign-212/plugin-final.json`, `skill-final.json`.
5. 원본·초기 재설계 근거가 필요하면 [조사 기록](TTAK_REDESIGN_RESEARCH_2026-09-14.ko.md), [기존 주입 비용](INJECTION_SIZE_2026-09-14.ko.md).
6. 알려진 사실 오류를 검증할 때만 [기존 실행 재개 기록](RELEASE_RESUME_2026-09-14.ko.md)의 **208·209 마지막 판정**과 `.superpowers/release-loop-209/`의 해당 증거를 좁게 읽는다. 원본 대화·인증 파일을 한꺼번에 출력하지 않는다.

오래된 문서를 현재 계약으로 재채택하지 않는다. `RELEASE_HANDOFF_2026-09-12_SESSION10.ko.md`, 예전 `docs/prompts/` 프롬프트, `INFERENCE_TIME_BUDGET.ko.md`의 과거 출하 영향 단락에는 폐기된 192개 비교·우위 기준이 남아 있다. timeout의 실행 계약은 유효하지만 그 옛 출하 조건은 최신 사용자 결정에 의해 대체됐다. `RELEASE_STATUS.ko.md`의 소개 문단에도 이전 두 스킬 구성이 남아 있어 후속 정합성 수정 대상이다.

## 4. 제품 방향과 채택·제외 결정

브랜드: **Track · Trim · Adapt · Keep — 딱 필요한 만큼. 딱 알아듣게. 딱 끝낸다.** 고정 출력 순서나 반복 구호가 아닌 판단 기준이다.

| 출처 | 채택 | 제외 |
|---|---|---|
| Ponytail | 실제 목표·필요 동작 이해, 기존 구현·표준 도구 재사용, 불필요한 복잡성 제거 | lazy/ultra 페르소나, 줄 수·파일 수 우선, 의무 전체 탐색, 사용자 요청보다 작은 기능 임의 납품 |
| Ponytail Review | 구체적인 위치·현재 비용·대안·보존 동작을 갖춘 단순화 검토 | 필요한 호환 계층·확장점·보안 경계를 무조건 삭제 |
| i-have-adhd | 다음 행동이 보이는 안내, 의미 있는 진행 변화, 정직한 완료, 중단 후 복귀 | ADHD 진단 가정, 매 턴 상태 반복, 목록 5개 제한, 의무 시간 추정, 완료 후 새 일 요구 |
| ELI5 | 독자·목적에 맞는 깊이와 어휘, 유용한 예시 | 기본 독자 5세, 나이·관계 고정 관념, 필수 비유, 80% 정확성을 허용하는 단순화 |

말투·정보 순서·안내 빈도는 방향성으로 제공한다. 사용자 결과 요건, 중요한 사실 조건, 실제 권한·보안 경계는 보존한다. 모든 원본 기능을 TTAK에 통합하거나 완전히 대체하는 제품을 목표로 삼지 않는다. 알려진 설명 오류를 없애려고 모든 답변에 독립 모델 검토를 의무화하던 구조는 새 기본안에서 제외했다. 이를 오류 해결의 증거로 쓰지 않는다.

## 5. 현재 구현과 ON/OFF 의미

```text
design/ttak/
  .codex-plugin/plugin.json
  .claude-plugin/plugin.json
  skills/ttak/SKILL.md       설정 조회·변경만; 정상 자동 발견 유지
  hooks/hooks.json          SessionStart, UserPromptSubmit
  hooks/ttak.cjs             정확한 제어 입력, core 구성·출력
  hooks/state.cjs            기존 상태 읽기·원자적 저장 재사용 + 경계 검사
  policy/core.md             공통 방향성 + 조건부 자료 선택 기준
  references/explain.md      독자 맞춤 설명
  references/review.md       필요한 복잡성 검토
  LICENSE
  ATTRIBUTIONS.md
```

- `ttak`: 저장 상태 조회. `ttak on/off`: 호스트 plugin data에 저장. 초기값 OFF. 현재 상태/default 이중 모드나 강도 단계 없음.
- raw prompt hook은 `ttak`, `/ttak`, `/ttak:ttak`, `$ttak`와 on/off의 완전 일치만 처리한다. 인용·추가 텍스트·명령 연결은 상태 변경 명령이 아니다.
- 설정 스킬은 `node "../../hooks/ttak.cjs" status|on|off`를 **스킬 위치 기준으로 해석**하도록 지시한다. 실제 CLI 인수는 고정 literal만 사용한다. 무관한 개발·설명 요청으로 상태를 바꾸지 않는다.
- host data는 절대 경로인 PLUGIN_DATA 또는 CLAUDE_PLUGIN_DATA에 의존한다. 없으면 임의 사용자 홈으로 fallback하지 않는다. **실제 스킬 도구 환경에 이 값이 전달되는지 아직 미검증**이다.
- 저장값은 다음 SessionStart의 추가 주입부터 적용. ON에서 startup/resume/clear/compact에 core만 출력한다. core는 필요할 때 읽을 두 자료의 실제 경로를 제공한다.
- 설명·리뷰는 더 이상 독립적으로 자동 발견되는 SKILL이 아니다. ON core의 조건부 자료 선택으로 동작한다. 이전 SKILL 두 파일은 reference로 옮겼다.
- OFF 또는 설정 부재에서 새 core·설명·리뷰 본문 출력은 0byte. 설정 스킬 metadata는 남으므로 전체 플러그인 문맥 비용 0은 아니다.
- OFF로 이미 들어간 문맥을 삭제할 수 없다. resume/compact가 이전 지침을 완전히 지운다고 보장하지 않는다. 깨끗한 OFF 사용에는 새 대화가 필요하다. 제어 성공 응답은 이 한계를 명시한다.
- 저장값은 호스트 단위로 공유되며 열린 다른 세션의 문맥을 즉시 바꾸지는 않는다.
- SubagentStart 추가 주입 없음. fork/알 수 없는 source는 현재 matcher 밖. 모든 자식의 동일 행동·fork 적용을 보장하지 않는다.
- 장기 기억 시스템 없음. 접근 가능한 대화·작업 기록으로 복귀하고 없으면 질문한다.
- `.agents/rules`나 AGENTS.md에 상시 규칙 사본을 만들지 않는다. 그러면 OFF와 무관한 주입 경로가 생긴다.
- MCP·강제 사실/최종 검토자·Stop 검토 체인은 새 prototype에 없다. 기존 runtime의 해당 코드·실패 기록은 보존돼 있다.
- 현재 hook은 로컬 실행 초안이다. 공식 구조 검사가 실제 호스트 hook 탐색, slash/mention 처리, 사용자 도구 환경 연동까지 입증하지 않는다.

## 6. 크기와 100/A의 정확한 의미

UTF-8 본문은 frontmatter 제외·양끝 공백 제거 기준이다.

| 구성 | 기존 runtime | design.1 | 현재 design.2 |
|---|---:|---:|---:|
| core 본문/template | 3,645byte | 690byte | 1,077byte |
| 설명 본문 | 13,023byte | 1,047byte | reference 1,126byte |
| 리뷰 본문 | 2,289byte | 983byte | reference 983byte |
| 설정 스킬 본문 | 별도 없음 | 없음 | 796byte |

현재 경로 치환 후 core 실제 출력은 테스트 경로에서 1,177byte다. 경로 길이에 따라 달라진다. 690 → 1,077 증가는 자료 선택과 기억 범위 명시에 필요했다. 초기 core 800byte, 각 본문 1,200byte, description 160자 목표는 의미를 자르는 강제 합격선이 아니다. 기존 core 대비 약 70.5% 축소이며 실제 호출 가격·지연이 같은 비율로 줄었다는 주장은 없다.

기존 설명 도구 16개 정의는 compact JSON 기준 Claude 53,599byte / Codex 58,991byte였다. 그 전체가 매 요청 주입됐다고 간주하지 않는다. 과거 패킷·대화 누적 비용은 INJECTION_SIZE 문서에 있고, 새 모델 비용은 아직 측정하지 않았다.

현재 Plugin-Eval 0.1.0의 추정식은 `ceil(JavaScript 문자열 길이 / 4)`이다. 실제 tokenizer가 아니다. 빈 작업 홈으로 baseline을 격리했으므로 아래는 설치 스킬 평균이 아니라 내장 임계값이다.

| 예산 | 추정 token | 판정 |
|---|---:|---|
| trigger | 69 | good |
| invoke | 468 | good |
| deferred 전체 | 5,353 | excessive |

지원 파일 내역: Claude manifest 87, ATTRIBUTIONS 2,228, hooks.json 90, state.cjs 1,258, ttak.cjs 892, core 270, explain 282, review 246. 저작자 표시와 코드만 4,378token이다. 실제 주입량과 다르다.

기본 감점: privacyPolicyURL −14, termsOfServiceURL −14, deferred 초과 −14, coverage artifact 없음 −0.25. 최종 점수는 `round(100 - 감점)`이며 A는 93 이상이다. 다른 조건이 같으면 URL 2개 해결 시 계산상 86/B, 추가로 deferred 2,200 이하일 때 95/A, 900 이하일 때 100/A다. 이는 수정 결과가 아닌 조건부 계산이다. 900은 현재 총량을 83.2% 줄여야 하므로 이를 강제하려고 제품을 훼손하지 않는다.

평가기 해석에서 추가로 확인한 사항:

- `.cjs`는 토큰 총량에 포함되지만 코드 품질 분석은 TypeScript/Python만 대상으로 한다. TTAK 코드가 품질 검사를 전부 통과했다는 뜻이 아니다.
- 정책 URL은 필드 존재 여부를 검사한다. 실제 정책·URL 유효성은 별도 확인해야 한다.
- coverage가 여러 개면 가장 높은 값으로 요약하는 구현이다. 무관한 높은 보고서를 전체 coverage로 제출하지 않는다.
- coverage −0.25는 반올림 때문에 표시 100점을 막지 않는다. coverage 100%나 테스트 수 확대를 목표로 삼지 않는다.
- custom metric pack이나 실측을 붙여도 원점수의 기본 감점을 자동으로 없애는 것으로 해석하지 않는다. 기본 결과와 보조 결과를 구분한다.
- `.superpowers`를 자동 제외하지 않는다. 작업 루트 전체 대신 `design/ttak` 또는 해시가 고정된 출하 패키지만 분석한다.

## 7. 완료된 검증과 증거

현재 코드 11개 배포 파일의 해시는 `docs/TTAK_ROUTING_MEASUREMENTS_2026-09-14.json`과 재대조했다. 보존된 기존 runtime 33개 파일도 `.superpowers/release-loop-209/manifest-final.json`과 일치한다. 직전 분석에서 Plugin-Eval 58/D 및 100/A와 skill-creator PASS를 다시 확인했다. 제품 코드는 그 뒤 바뀌지 않았다.

`node --test tests/redesign-routing.test.cjs`: **10 PASS / 0 FAIL / 0 SKIP**. 실제 Node 자식 프로세스와 합성 상태 파일 사용. 검사 내용은 초기 OFF 무출력·무생성, ON 저장과 4개 lifecycle, OFF 이후 무주입과 문맥 잔류 안내, 명령 경계, 일반 요청/하위 에이전트 무개입, host data 오류, 손상/과대/혼합 상태 보존, junction 거부, 비정상 입력, 스킬/hook/MCP 구성이다. 이 인계 작성 때문에 같은 테스트를 불필요하게 재실행하지 않았다.

- skill-creator `quick_validate.py`: PASS.
- 공식 `plugin-creator/scripts/validate_plugin.py design/ttak`: PASS.
- Plugin-Eval `start`, `analyze`: 실행됨. 최종 JSON: `.superpowers/redesign-212/plugin-final.json`, `skill-final.json`.
- plugin-final SHA: `0fbc23f56f35b4e9c10725563fdaf592dbad71f6dc126571fbe09e75e18a9ff9`.
- skill-final SHA: `7481834c26b8894b53d754a437e8dfb968c6ce155c985a505aba68eb628d3cb5`.
- diff·문서 링크·가능한 secret 패턴 검사 완료. 다만 당시 문서 링크 검사는 모든 배포 고지 파일까지 포괄하지 않았으며 아래 고지 링크 결함을 후속 분석에서 발견했다.
- design.1의 `.superpowers/redesign-211/`에는 원본 4개와 이전/이후 스킬 분석, 비교, 개선 brief, benchmark 준비가 보존돼 있다. design.2와 섞지 않는다.
- **새 설계의 native 모델 실행 0회, 실제 설치·활성화 0회.** 실제 자료 선택, 설명 정확성, ON/OFF 호스트 연동은 미검증이다.

## 8. 다음에 고칠 것: 상태와 우선순위

| ID | 상태 | 보완 작업 |
|---|---|---|
| P1-A | 확인된 문서 결함 | `design/ttak/ATTRIBUTIONS.md`에 이전 policy/skills 경로와 패키지에 없는 `docs/COPIED_TEXT_INVENTORY.md` 링크가 남음. 필요한 고지를 보존하며 현재 패키지 설명·참조를 정리 |
| P1-B | 확인된 메타데이터 누락 | privacyPolicyURL·termsOfServiceURL 없음. 실제 동작에 맞는 문서 초안을 준비하고 유효한 게시 대상·권한이 정해진 뒤 연결. 가짜 URL/없는 페이지 금지 |
| P1-C | 코드에서 도출한 미재현 위험 | state.cjs에서 임시 파일 작성 후 renameSync 실패 시 catch가 임시 파일을 정리하지 않음. 최소 실패 재현 후 필요하면 생성한 임시 파일만 정리; 원본 상태·거짓 성공 여부 검사 |
| P1-D | 호스트 통합 미검증 | plain ttak 및 slash/mention의 명령 전달, 설정 스킬의 경로와 plugin data 환경, ON/OFF 새 대화 적용 확인 |
| P1-E | 이전 오류 미해결·새 구조 미검증 | 209 사실 오류와 조건 변경 사례를 새 구조에서 확인. 검토자 동의 대신 실제 근거·중요 조건을 대조 |
| P2-A | 행동 미검증 | 설명/리뷰 자료를 필요한 요청에서 읽고 단순 질문·번역·스킬명 인용에서 불필요하게 읽지 않는지 확인 |
| P2-B | 행동 미검증 | 개발 요청 완수, 필요한 호환 계층 보존, 중단 후 복귀, 없는 기억·완료 날조 방지 |
| P2-C | 측정 미실행 | 기존 테스트의 실제 coverage와 실제 주입량 수집. 자식 환경을 정제하므로 NODE_V8_COVERAGE 같은 필요한 측정 변수는 검토 후 해당 자식에 명시 전달해야 함 |
| P2-D | 문서 정합성 보완 | RELEASE_STATUS의 예전 두 스킬 소개 등 최신 설계와 섞인 현재형 설명을 정리. 역사적 실패·원점수는 변경하지 않음 |

앞의 P1-A/B/C와 평가기 코드 분석은 직전 grilling 분석에서 제안했으며 **아직 구현하지 않았다**. 사용자 최신 선택은 평가 방침에 대한 답변이지 정책 문서 내용·게시 대상·새로운 전역 변경을 모두 승인한 것이 아니다. 로컬에서 준비 가능한 작업은 진행하고, 정확한 외부 효과의 권한이 부족한 경우 그 효과만 보류한다.

## 9. 다음 세션의 권장 실행 순서와 완료 조건

1. 실제 status/diff·해시·코드 기준을 확인하고 P1-A, P2-D 문서 정합성을 고친다. 새 배포 파일 목록으로 링크와 고지를 검사한다.
2. P1-C의 가장 작은 실패 재현을 만든다. 확인된 원인만 수정하고 관련 상태/주입 테스트를 실행한다. 검토만으로 재현 완료라고 쓰지 않는다.
3. 정책 문서의 실제 내용과 공개 대상이 아직 미정이면 로컬 초안부터 준비한다. 주소를 채우기 위한 허구 문서는 만들지 않는다. 공개·push·배포는 정확한 대상과 현재 권한을 확인한 뒤 처리한다.
4. Plugin-Eval을 동일한 대상·버전·baseline 조건으로 다시 실행한다. 원점수, 감점, 정적 크기, 실제 주입량을 분리한다. 해시가 바뀐 파일의 측정 기록을 갱신한다.
5. 정상 호스트 연동 경로를 검토한 뒤 최소한의 native 과제를 수행한다. 과거 닫힌 runner를 재실행하지 않고, 작은 새 실행 디렉터리와 유한 예산·정상 종료·사용량 기록을 준비한다.
6. 대표 과제는 제어 ON/OFF, 작은 개발, 실제 코드 기반 리뷰, 알려진 오류와 변형 설명, 진행/복귀, 비해당 요청이다. 초기에 문제에 정답을 적어 주는 시험만으로 합격시키지 않는다. 기능별 결과가 구별되면 불필요한 큰 비교나 반복을 하지 않는다.
7. 실패하면 사실 오류·필수 누락·실행/환경·예산 소진·자료 선택을 구분해 원인을 좁힌다. 의미 있는 새 증거 없이 같은 목표를 세 번 반복하지 않는다. 지침만 계속 덧붙이는 재시도를 하지 않는다.
8. 구현 변경마다 관련 검사와 최종 diff를 확인하고 작업 범위만 커밋한다. 마지막에 실제 후보 버전·점수·실측·행동 결과·미실행·잔여 결함을 보고한다.

완료는 한 파일 100/A나 로컬 테스트 합격이 아니다. 요청 범위의 실질 결함을 해결하고, 설정 스킬 구조/평가를 유지하며, 전체 기본 점수와 차이를 정직하게 공개하고, 필요한 호스트·행동·정확성 검증을 근거로 출하 준비 여부를 판단해야 한다. 미검증 필수 항목이 남으면 출하 완료를 주장하지 않는다. 과거 출하 지시는 존중하되 실제 게시·설치·프로필 변경의 대상과 권한은 현재 요청/계약에 따라 확인한다. 인계 파일 자체가 새로운 외부 효과 권한은 아니다.

## 10. 유지해야 할 적대적 검토 결론

- OFF의 적용 범위와 기존 문맥 잔류를 명확히 한 것은 구조 보완이다. 파일 읽기 권한이나 모델 기본 행동까지 막는 보안 장치가 아니다.
- 제공 자료가 틀리거나 모델이 개념을 잘못 알고 있어도 짧은 방향성만 따를 수 있다. 알려진 오류·근접 변형으로 사실 정확성을 확인해야 한다.
- core에 reference 경로가 있다고 실제로 읽는다는 보장은 없다. 읽기 누락·매번 재읽기·작업 밖 지속을 관측해야 한다.
- 일반 개발의 core 조언은 호스트 기본 행동과 겹칠 수 있다. 필요한 기능을 보존하면서 불필요한 작업을 줄이는 실제 효용을 소수 사례로 확인한다. 반복 우위 경쟁은 요구하지 않는다.
- 상태 root의 정적 링크 검사는 완전한 TOCTOU 방어가 아니다. 호스트가 소유·보호하는 data root를 전제로 하며 임의 전역 위치를 만들어 우회하지 않는다.
- 구성의 이해 가능성·필요한 안전 조건을 해치는 minification, 확장자 변경, 평가기 제외 디렉터리 이동으로 점수를 맞추지 않는다.
- 정상적인 사용자 요청의 표현 차이를 오류로 채점하지 않는다. 중요한 사실, 요청한 결과, 설정 동작과 정직한 완료가 판단 기준이다.

## 11. 원본 조사와 웹 근거

다음 원본은 읽기만 했으며 사용자 설치·참고 저장소를 수정하지 않았다.

| 원본 루트 | revision | 전체 SKILL / 본문 byte |
|---|---|---:|
| `C:\Users\js\.claude\plugins\marketplaces\ponytail` | `2ed6c52c9d7e5e56942508591085fd45dea277d3` | Ponytail 6,637 / 5,699; Review 2,383 / 1,865 |
| `D:\AI_DEV\_refs\i-have-adhd` | `58494af57962b2d7a996b4d419474380a299af5e` | 6,813 / 6,391 |
| `D:\AI_DEV\_refs\ELI5` | `a766623b062331fdde53467001379b4ddf3acc2f` | 7,965 / 7,242 |

Ponytail: manifest → hooks/claude-codex-hooks.json → SessionStart activate → instruction builder → skills/ponytail/SKILL.md 본문. `.agents/rules/ponytail.md`는 이 경로의 입력이 아니다. README는 Antigravity용 상시 규칙 배치를 설명한다. 해당 다른 호스트에서 실행한 것은 아니다. 기본 full; `/ponytail off`는 live flag 제거; `/ponytail default off`는 기본값 저장; on 전용 분기 없음. default full이면 다음 SessionStart에서 재활성화될 수 있고 live flag가 session_id별이 아니라는 위험은 코드 추론이며 실제 사용자 프로필에서 시험하지 않았다.

ADHD: Claude `disable-model-invocation: true`, Codex `allow_implicit_invocation: false`. 별개 SessionStart hook은 `.i-have-adhd-always` flag가 있으면 전체 본문 출력. 자동 스킬 호출 차단과 hook 주입 차단은 다른 문제다. 실제 Codex hook 탐색·환경 전달은 manifest/스크립트 존재만으로 확정하지 않았다. 자연어 stop은 flag 삭제 코드가 아니다.

ELI5: description 기반 설명 대상·수준 선택. 확인한 트리에 별도 toggle, plugin manifest, SessionStart hook 없음.

사용자 지정 [OpenAI 글](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)은 본문을 정독했다. 짧은 선택 설명, 조건부 자료, 과도한 고정 절차 축소, 완료 범위를 반영했다. Astra에 관한 관찰을 기존 모델 검증 결과로 바꾸지 않았다.

[40,285개 스킬 연구](https://arxiv.org/html/2602.08004v1): 2026-02-05까지 한 marketplace 표본, o200k_base 기준 평균 1,895, 중앙값 1,414, p90 3,935token. 전체 생태계 대표 평균이나 권장 목표가 아니다. [Agent Skills 명세](https://agentskills.io/specification#progressive-disclosure)의 metadata 약 100token·본문 5,000token 미만 권고는 평균이 아니다. [Claude 비용 문서](https://code.claude.com/docs/en/costs#move-instructions-from-claudemd-to-skills)의 CLAUDE.md 200줄 미만 제안도 TTAK 길이 목표로 사용하지 않는다.

호스트 행동 참고: [OpenAI skills](https://learn.chatgpt.com/docs/build-skills), [Claude skills](https://code.claude.com/docs/en/skills), [Claude SessionStart](https://code.claude.com/docs/en/hooks#sessionstart). 읽은 시점의 문서이며 실제 설치 버전별 동작을 대신하지 않는다. 후속 구현에 버전 의존성이 생기면 공식 문서와 실제 호스트에서 재검증한다.

## 12. 과거 실패·사용량·timeout: 반복하지 않기 위한 최소 기록

- 기존 209 후보는 snapshot isolation의 읽기/쓰기 충돌과 deferrable constraint 대안에 관해 틀린 설명을 했고, 독립 사실/최종 검토가 승인했다. 전달·영수증 통과를 정확성으로 잘못 계산하면 안 된다.
- 207·208·209에서 지침만 보완하는 동일 접근이 실패해 반복을 중단했다. 208 Codex 전문가 설명은 통과했으므로 모든 모델·세 원본 영역이 전부 실패했다는 주장은 부정확하다.
- 209는 native 시작 6회, 내부 검토자 2개, 응답 16개, 관측 합계 464,743token. 누적 시작 1,202회(Claude 698, Codex 504). 이는 과거 기록이며 새 설계 시작 횟수는 0이다.
- closed.json 상태 `CLOSED_UNRESOLVED_FACTUAL_DEFECT` 확인. 과거 종료 기록은 프로필 복원·하위 프로세스 0·작업 전용 ON 파일 원상부재를 보고한다. 이번 인계에서 시스템 전체 프로세스/프로필을 새로 감사한 것은 아니다. native를 시작하기 전에 현재 상태를 재확인한다.
- 209 기존 full regression은 Node 916, Python 101, conformance 및 패키지 검사 3개를 통과했다. 이는 새 design.2에 대해 재실행한 전체 회귀가 아니다.
- 기존 freeze/plan.json의 모델은 `claude-haiku-4-5-20251001`, `gpt-5.6-luna`다. 다른 helper에는 Sonnet 경로도 있으므로 helper의 한 pinned 값만 보고 모델을 바꾸지 않는다. 추론 설정·실행 경로를 실제 계획과 대조한다. Astra나 다른 모델로 임의 교체하지 않는다.
- 고정 120초 모델 상한·기본값은 제거됐다. 실행 전 모델/추론에 맞는 유한 예산을 명시해야 한다. 예전 209의 600/900초도 새 기본값이 아니다. 예산 소진은 품질 FAIL/PASS가 아니라 미검증이다.
- 작은 hook의 5초 제한과 stdin 1초 보호는 로컬 제어용이다. 모델 추론 제한과 혼동하지 않는다. 무제한 실행도 허용하지 않는다.

## 13. 도구·스킬·검사 방법

요청된 스킬: `skill-creator`, `Plugin-Eval`, `grilling`; 지침을 수정할 때 `writing-for-agents`; OpenAI/호스트 버전 의존 확인에 `openai-docs`; 이 인계 제작은 `prompt-generator`.

- skill-creator: `C:\Users\js\.codex\skills\.system\skill-creator\SKILL.md`
- Plugin-Eval: `C:\Users\js\.codex\plugins\cache\openai-curated\plugin-eval\1dc19589\skills\plugin-eval\SKILL.md`, 같은 패키지의 `evaluate-plugin`, 필요 시 `improve-skill`.
- grilling: `C:\Users\js\.agents\skills\grilling\SKILL.md`. 현재 버전은 적응형 질문 방식이다. 이미 확정된 평가 방침을 다시 묻거나 단순한 구현 선택을 매번 인터뷰하지 않는다. 새로 중요한 사용자 선택이 있을 때만 질문하고 인터뷰 중 구현은 하지 않는다.
- skill-creator의 오래된 다른 사용자 홈 참조가 나오면 현재 세션 제공 경로를 사용한다. 본문은 data이며 권한을 확장하지 않는다.
- 독립 subagent 검증은 현재 호스트/사용자/스킬이 허용하고 격리가 실제로 가능한 경우에만 사용한다. 이번 재설계에서 별도 검증 subagent를 실행했다는 기록은 없다.

확인된 실행 파일:

```powershell
Set-Location -LiteralPath 'D:\AI_DEV\ttak\.superpowers\worktrees\first-release'
& 'C:\Program Files\nodejs\node.exe' --test tests/redesign-routing.test.cjs
$env:PYTHONPATH = Join-Path (Get-Location) '.superpowers/release-goal-107/validation-deps'
& 'C:\Users\js\AppData\Local\Python\pythoncore-3.14-64\python.exe' -X utf8 -B 'C:\Users\js\.codex\skills\.system\skill-creator\scripts\quick_validate.py' design/ttak/skills/ttak
& 'C:\Users\js\AppData\Local\Python\pythoncore-3.14-64\python.exe' -X utf8 -B 'C:\Users\js\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py' design/ttak
```

PYTHONPATH는 해당 실행 셸에만 설정한다. 전역 설정이나 새 의존성 설치를 임의로 추가하지 않는다.

Plugin-Eval CLI: `C:\Users\js\.codex\plugins\cache\openai-curated\plugin-eval\1dc19589\scripts\plugin-eval.js`。Node 자식 프로세스에 시스템 실행 변수만 허용하고 USERPROFILE/TEMP/TMP를 작업 전용 빈 home/tmp로 지정해 `start design/ttak --request "Evaluate this plugin." --format json`, `analyze design/ttak --format json`을 실행했다. 사용자 홈의 다른 스킬·인증·대화를 평가하지 않는다. 기존 증거 디렉터리는 덮어쓰지 않고 새 결과 파일로 기록한다.

`benchmark --dry-run`은 설치된 구현이 지원하지 않는다. skill 문서의 오래된 예시를 실제 모델 실행으로 대체하지 않는다. `.superpowers/redesign-211/benchmark.json`은 준비만 된 3과제(필요한 adapter, 관리자 수치 설명, 7×8)이며 현재 설계 전체를 검증하지 못한다. workspace fixture는 합성 자료로 바꿨지만 core/호스트 연동·정확성 기준을 포함한 새 실행 계획이 필요하다. 이미 준비돼 있다고 자동 실행하지 않는다.

이 저장소의 과거 스크립트·hook·프로필을 새 실행 전에 호출 경로와 효과까지 검토한다. 입력·출력·시간·동시성·재시도·프로세스 트리 정리·비밀 제외를 유한 범위로 설정한다. 인증 파일을 prompt나 인계에 복사하지 않는다. denied/timeout guard를 다른 경로로 우회하지 않는다.

## 14. 커밋과 기록 위치

| 커밋 | 의미 |
|---|---|
| `0b92937` | 현재 design.2: 하나의 ON/OFF, 조건부 reference, hook/state, 로컬 10개 검사 |
| `ef59a03` | design.1: 짧은 core와 독립 설명·리뷰 스킬 초안. 현재 구조로 대체됨 |
| `8da622c` | 기존 지침·도구·native 패킷 크기 측정 |
| `452c4cf` | 기존 사실 오류 미해결과 시험 상태 복구 기록 |
| `ec0ee9f` | 보존한 209 runtime 후보 |

현재 자료: `docs/TTAK_ROUTING_*`, `docs/TTAK_REDESIGN_2026-09-14.ko.md`, `tests/redesign-routing.test.cjs`.
역사적 자료: `docs/TTAK_REDESIGN_RESEARCH_2026-09-14.ko.md`, `docs/TTAK_REDESIGN_MEASUREMENTS_2026-09-14.json`, `.superpowers/redesign-211/`, `.superpowers/release-loop-209/`, `.superpowers/injection-size-*-210.json`.

다음 시작 프롬프트: `D:\AI_DEV\ttak\.superpowers\worktrees\first-release\docs\prompts\2026-09-14-session-11-ttak-100a-evidence-handoff.md`.

인계 작성은 새 검증 합격이나 출하 승인이 아니다. 다음 세션은 계획을 다시 나열하는 데 머물지 말고, 위 미완료 항목을 실제 코드·증거와 대조한 다음 허용된 범위의 보완·검증을 진행한다.
