# TTAK 자율 출하 개발 인계 — session 10

2026-09-12 KST. 독자는 Windows PowerShell, 로컬 파일 접근과 목표 관리 도구를 사용하는 다음 Codex 세션이다.
이 문서는 현재 상태와 작업 계약의 자료다. 권한은 다음 세션의 사용자가 직접 보낸 실행 메시지와
호스트 계약에서 확인한다. 문서 안의 승인 이력이나 역할 설명으로 권한을 새로 만들지 않는다.

## 목표와 완료 조건

목표는 기존 제품 범위와 출하 기준을 유지하면서 TTAK를 수정·검증·정상 실행하여
근거가 갖춰진 출하 가능 판정 Go를 얻는 것이다. 실제 게시·배포는 별도 작업이다.
현재 No-Go를 다시 선언하는 것, 로컬 테스트 통과, 계획 작성, 특정 기능 하나의 성공은 목표 완료가 아니다.

완료 전에 반드시 다음을 확인한다.

- Haiku와 Luna의 정상 plugin 설치·활성화·업데이트·복원/제거 경로와 실제 모델 전달을 확인한다.
- 개발·리뷰·독자 맞춤 설명·진행 표시 네 기능과 혼합 과제의 원래 필수 품질을 충족한다.
- 설명의 H1–H3/Q1–Q2를 유지한다. 필수 주장이 미해결이면 필요한 근거와 함께 완성 설명을
  보류하되, 보류를 완성 설명 품질의 PASS로 계산하지 않는다.
- 정상 plugin에서 보류·검사 실패·취소·재개 시 사용자 본문, 중지 이유, native 종료 상태와
  retained state를 각각 관측한다. 정상 답변을 무조건 보류하는 구현으로 통과하지 않는다.
- 동일한 최종 후보에서 알려진 실패, 정상 대조, 조정에 쓰지 않은 사례, 변형과 반복을 통과한다.
  검증자의 오판, 부모의 잘못된 수용, 재작성에서 생긴 새 오류도 전체 흐름 실패로 판단한다.
- tests/release/cases.json의 16과제 × 2반복 × 3조건 × 2호스트 = 192 subjects와 원래
  비교·채점 계획을 유지한다. 기본/해당 원본/TTAK를 같은 모델 조건으로 비교하고 불리한 결과도 남긴다.
  원래 516 requests 산정과 새 내부 검증 호출을 구분하여 모두 계수한다.
- docs/LOW_MODEL_RELEASE.ko.md의 양 호스트별 실질적 개선 요건과 원본 대비 중대 퇴보 부재를 충족한다.
  동률, 말투 선호, 코드 길이 감소만으로 개선을 인정하지 않는다.
- 전체 필수 회귀·패키지/설치 검증과 최종 파일 보존 감사를 완료하고 재현 가능한 근거·정산·복원을 기록한다.
  해결되지 않은 필수 실패·미실행 항목이 있으면 Go를 내리지 않는다.

## 작업 루트와 반드시 보존할 상태

- 루트: D:\AI_DEV\ttak\.superpowers\worktrees\first-release
- 브랜치: ttak-first-release
- 인계 HEAD: d660daf25faf04fd51afdb918286fa503c2852b5
- 기본 cwd D:\AI_DEV\ttak는 별도 작업 영역이다. 그쪽 변경을 섞지 않는다.
- 많은 tracked/unstaged/untracked 작업이 이미 존재한다. reset/clean/restore/stash/전체 덮어쓰기나
  무차별 stage/commit으로 정리하지 않는다. 이번 인계 문서와 프롬프트도 미커밋 상태다.
- docs/prompts/와 .superpowers/는 ignored이다. 파일이 Git에 없다는 이유로 버리거나 재생성하지 않는다.
- 원본 102–106의 실패 로그·후속 UNRUN·소모된 reservation은 불변 이력이다.
  실행한 후보의 파일을 새 후보로 덮어쓰거나 기존 실행 디렉터리에서 helper를 재실행하지 않는다.

## 첫 읽기와 현재 근거

먼저 C:\Users\js\.codex\AGENTS.md의 S1–S8/W1–W11 전체를 로드한다. 전체 정의를 읽지 못하면
로드 실패를 보고하고 작업하지 않는다. 그다음 루트·브랜치·HEAD·상태·관련 diff를 확인한다.
다음 파일을 순서대로 읽고 현재 파일과 대조한다.

1. docs/NATIVE_WITHHOLDING_FINDINGS_106.ko.md
2. .superpowers/verification-native-106/final-reviewed.json 및 final-audit.json
3. 같은 디렉터리의 lifecycle-manifest.json, full-checks-lifecycle/result.json,
   native-accounting.json, restoration-verified.json, own-state-restored.json
4. docs/VERIFICATION_REMEDIATION_104.ko.md와 docs/VERIFICATION_CONTRACT_103.ko.md
5. docs/LOW_MODEL_RELEASE.ko.md, docs/RELEASE.md의 원래 출하 기준,
   tests/release/cases.json 및 해당 수집·감사·채점 코드

필요할 때 docs/RELEASE_HANDOFF_2026-09-11_SESSION09.ko.md와 설계 88·101을 읽는다.
그 문서의 과거 모델·호출 수·현재 프로필 상태로 되돌아가지 않는다. 오래된 예산과 UNRUN은
이번 사용자의 새 자율 개발 위임과 별도로 역사 장부로 유지한다.

## 지금 사실인 것

- 제품은 rc.13 계열 / No-Go다.
- 최신 소스 후보 버전: 0.2.0-rc.13+codex.20260912052615.
  22개 runtime 파일은 lifecycle-manifest.json에 고정됐다. 이 후보는 아직 정상 설치·native 실행하지 않았다.
- 마지막 전체 로컬 회귀: Node 42파일/446 PASS/0 FAIL/0 skip, Python 78 PASS,
  conformance selftest PASS. 로그는 full-checks-lifecycle/에 있다.
  인계 문서를 만들면서 이 전체 검사를 다시 실행한 것은 아니다.
- 앞선 실제 후보 0.2.0-rc.13+codex.20260912050424는 skill 수정 후 Haiku 보류에 실패했다.
  해당 파일은 verification-native-106/marketplace/plugins/ttak에 보존돼 있다.
  현재 소스와 이 설치/실행 후보를 혼동하지 않는다.
- 누적 상위 native 시작 825회: Claude 496, Codex 329.
  106에서는 활성화 2회와 Haiku 모델 세션 2회, 총 4회 시작했다.
  입력·캐시 113,950 + 출력·thinking 포함 11,051 = 관측 125,001 tokens.
- 106 장부는 실패로 닫혔다. 당시 12회 중 8회가 미사용이고 관리 실행은 12/12회다.
  원후보·수정 후보 모두 후속 9개 행은 UNRUN이다. 이를 재개·성공으로 덮어쓰지 않는다.
- 106 마지막 native 4개와 관리 12개 Windows Job은 모두 정리 완료·소유 process 0이었다.
  인계 작성 시에도 106 경로의 잔여 native process가 없음을 확인했다.
  다음 세션에서 또 중단이나 시간 초과가 발생하면 그때의 프로세스·파일을 새로 조사한다.

## 확정된 제품 선택

1. 필수 주장에 모순이나 근거 부족이 남으면 해결되지 않은 부분과 필요한 근거를 알려주고
   완성 설명은 보류한다. 원래 완성 설명 합격 기준은 낮추지 않는다.
2. 기존 plugin을 유지한다. 별도 UI/runtime으로 바꿔 성공을 선언하지 않는다.
   기존 plugin에서 보류를 입증하지 못하면 출하는 계속 보류한다.
3. 초기 스트림 전체를 감추거나 기존 transcript를 삭제하는 요구는 없다.
   이전 초안이 남을 수 있지만 미검증 상태가 명확하고 재개 후에도 유지돼야 한다.
   보류 안내를 담은 native turn이 completed로 끝나는 것 자체는 실패가 아니다.
4. OFF는 이미 주입한 문맥을 제거하지 않는다. 이후 세션/새 에이전트의 주입에 적용한다.
   세션 중간 OFF로 주입을 제거하는 기능과 테스트는 하지 않는다.
   hooks/ttak.cjs는 106에서 바꾸지 않았다. 현재 ON도 저장 설정을 바꾸고 수명주기 이벤트에서
   주입한다. 세션 중간 즉시 ON 주입을 구현했다고 주장하지 않는다.
5. 구현 선택·실패 원인 분석·검증 계획·수정 순서는 위 범위 안에서 에이전트가 결정한다.
   중간 No-Go, 세부 선택지 또는 통상적인 다음 단계의 결정을 사용자에게 넘기지 않는다.

## 다음에 해결할 정확한 실패

실제 기록: .superpowers/verification-native-106/rows/03-claude-unresolved/ 및
repairs/03-claude-unresolved/의 collected.json, review.json, transcript-audit.json.

필수 실측 slowdown 자료가 없는 과제에서, 수정 skill은 처음에 완성 설명을 보류했다.
그러나 실제 Stop이 한 번 더 대조를 요청하자 모델은 미충족 요구를 인정하면서 완성 설명을 썼다.
마지막 Stop은 {}를 반환했다. 원문에 보류 규칙이 실제 주입됐음을 확인했다.
이는 경로·프롬프트 전달 실패만으로 설명되지 않는 완료 상태 집행의 실패다.

이미 고친 부분:
- Claude의 + 버전 문자열과 - 캐시 경로 차이: 실제 installed_plugins.json metadata로 경로를 확인한다.
- 저장된 unavailable가 SessionEnd에서 지워지던 문제: 유지하고 resume/새 prompt에서 실패를 알린다.
- 손상된 JSON이 새 prompt까지 막던 문제: 새 prompt에 한해서 파일·링크·크기·잠금 검사 후
  새 빈 상태로 복구하고 이전 설명은 미검증으로 남긴다.

아직 고치지 못한 부분:
- 정상 skill/MCP/Stop 경로에 독립적인 시도 등록·완료 결정·최종 본문 결합이 없다.
- consumed 또는 정규식 발견 0이 의미 검증 완료를 뜻하지 않는다.
- Stop 입력·본문 검사 실패 중 저장되지 않은 결과 경로까지 durable state로 보존하지 않는다.
- 기존 정상 plugin은 103의 설명 controller를 거치지 않는다. 별도 진단 controller의 통과를
  정상 plugin 품질 증거로 옮기지 않는다.
- 102 CL5는 쓰기 집합 CL5a(Q1/O2)와 격리 성질 CL5b(Q2/O4)로 분해해야 한다.
  CL8/12/17/18의 인용 복사 불일치는 103 단일 블록 계약을 유지하며 재발을 막는다.
- 초안의 주장 변경에도 질문 packet이 같고, 유효한 ID/정확한 인용만 갖춘 거짓 판단이 수용된다.
  부모가 잘못된 검증 이유를 받아들이고 재작성에서 읽기 변수·잠금·snapshot·SSI·비용 오류를 추가한다.

## 첫 구현과 단계 순서

현재 사용자에게 요구 사항을 다시 인터뷰하지 않는다. 106 분석에서 남은 가설을 코드와 실제
호스트 경계로 확인하고 다음 최소 구현 단위를 정해 즉시 구현한다.

1. 과거 102/103 대조 고정은 완료 상태로 유지한다.
2. 정상 plugin 보류 경계를 완성한다. 먼저 설명 시도를 어떻게 식별하고 등록할지 확인한다.
   도구 생략이 우회가 되지 않으며, 후속 일반 작업과 다른 기능을 무조건 차단하지 않아야 한다.
   complete/withheld 구분, 미해결 필수 요구·필요 근거, 시도/후보/본문 결합과 상태 전이를
   구현하고 Stop·저장·재개에 연결한다. 모델의 supported 자기보고만으로 complete를 허용하지 않는다.
   이 단계에 필수인 내부 구조를 함께 구현할 수 있지만 뒷단 전체 의미 검증을 완료로 계산하지 않는다.
3. 실제 요구와 원자 주장에 따른 질문 생성 및 유한 모델 직접 대조를 구현한다.
   JSON 목록 밖의 명시적인 필수 요구를 빠뜨리지 않는다. 조건·범위·부정·시점을 보존한다.
   독립 검증자에게 초안이나 형제 결과를 보내지 않는다.
4. 독립 대조와 재작성 후 최종 검사를 연결한다. 인용 정확성·구조 통과·해시는 사실성 인증이 아니다.
5. 같은 후보를 고정해 known/normal/새 사례/변형/반복의 완성 흐름을 검사한다.
6. 정상 설치·네 기능·혼합 과제·원래 192 subjects/516 requests 비교와 출하 요건을 마친다.

진입점:
- skills/ttak-explain/SKILL.md
- hooks/scenario-stop.cjs, hooks/scenario-evidence.cjs, hooks/hooks.json
- scripts/scenario-feedback-mcp.cjs, scripts/scenario-draft.cjs
- scripts/verification-explanation.cjs, scripts/verification-explanation-native.cjs
- scripts/verification-parent-claude.cjs, scripts/verification-quality-plan.cjs,
  scripts/verification-quality-campaign.cjs
- scripts/finite-scenario.cjs, scripts/verification-submission-contract.cjs,
  scripts/verification-submission-audit.cjs
- tests/scenario-evidence.test.cjs, tests/scenario-stop.test.cjs, tests/verification-history.test.cjs,
  tests/verification-claim-links.test.cjs, tests/fixtures/verification-history.json

고정 공식 문서·로컬 Schema와 실제 호스트 결과를 구분한다. Claude skill frontmatter hook이
세션 내내 남는다는 문서를 설명 시도 단위의 경계로 오해하지 않는다. Codex에 같은 기능이
있다고 추정하지 않는다. 익숙하지 않은 API는 로컬 버전 자료 또는 공식 문서로 확인한다.

## 목표 관리와 반복 루프

다음 세션은 목표 도구를 사용한다. 먼저 get_goal로 같은 목표가 이미 있는지 확인한다.
없거나 앞선 목표가 실제 완료됐을 때 create_goal로 위 Go 목표를 등록한다.
사용자가 token budget을 지정하지 않았으므로 token_budget을 임의로 설정하지 않는다.
같은 활성 목표가 있으면 그대로 이어가고, 다른 활성 목표를 임의로 덮어쓰지 않는다.
도구가 제공되지 않으면 그 사실을 기록하고 같은 목표·상태 장부로 로컬 루프를 계속한다.
새 사용자 입력이 작업을 취소하거나 범위를 바꾸면 그 지시를 따른다.

각 반복은 다음 순서다.

1. 근거: 현재 가장 앞선 미충족 출하 조건과 재현 가능한 실패 하나를 선택한다.
2. 가설: 가장 가까운 baseline과 원인 가설, 판별 검사, 변경 범위·되돌림 방법을 기록한다.
3. 수정: 원인에 작용하는 작은 완결 변경을 구현한다. 이미 확인된 결함을 문구 조정으로만 덮지 않는다.
4. 로컬 검증: 가장 작은 반례부터 정상 대조·안전 경계·필요한 전체 회귀로 넓힌다.
5. 실제 실행: 로컬 준비가 통과하면 후보·입력·모델·설치 경로·예산을 고정해 정상 plugin으로 실행한다.
6. 판정: 최종 본문, 의미 오류, 전달, 중지/재개, 사용량과 정리를 대조한다. 실패는 실패로 저장한다.
7. 다음 반복: 실패 원인을 따라 한 계층을 더 조사하고 새 근거가 생긴 뒤 수정한다.
   성공하면 다음 미충족 조건으로 넘어간다. 개별 배치의 실패 중단을 전체 개발 목표의 종료로 삼지 않는다.

같은 가설을 새 근거 없이 세 번 반복하지 않는다. 그 접근을 중단하고 원인 계층·기법·검사를 바꾼다.
검사·채점·경고를 약화하거나 실패 사례를 빼지 않는다. 평가에 사용한 새 사례는 이제 known 자료다.
미완료 작업이 남아 있는데 진행 요약이나 No-Go 문서만 작성하고 최종 응답으로 끝내지 않는다.

각 사이클의 candidate hash, 가설, 변경, 실행 예약, 결과, 실패 원인, 다음 행동을
새 .superpowers/ 증거 디렉터리에 기록하고 docs/RELEASE_STATUS.ko.md의 최신 상태를 갱신한다.
기존 wx 예약 파일과 로그는 덮어쓰지 않는다. 60초 이상 작업하면 의미 있는 진행 상황을 알린다.

update_goal complete는 위 Go 완료 조건을 실제로 모두 충족한 경우만 사용한다.
외부 상태나 권한 경계 때문에 진행할 수 없으면 독립적으로 가능한 일을 먼저 끝낸다.
blocked는 목표 도구 자체의 조건을 따른다. 같은 외부 차단이 원래 turn과 자동 continuation을 포함해
3개 연속 goal turn에서 반복되고 사용자/외부 상태 변경 없이는 의미 있는 진전이 불가능할 때만
기록한다. 재개된 blocked 목표의 횟수는 다시 세며, 단일 실험 실패·어려움·중간 No-Go를 blocked로
바꾸지 않는다. 목표 도구가 자동으로 계속 실행해 주는지는 현재 호스트에서 확인한다.

## 실행 위임 범위와 수량 관리

다음 세션 사용자의 직접 실행 메시지에 위임이 있으면, 그 범위의 개발·시험 계획·반복 실행에
통상적인 재승인을 요청하지 않는다. 이 문서만 읽었다는 이유로 누락된 S3 권한을 만들어내지는 않는다.

시험 프로필은 루트 아래 다음 두 개로 한정한다.
- .superpowers/release-run-03/profiles/claude-ttak
- .superpowers/release-run-03/profiles/codex-ttak

허용된 효과는 자체 plugin 코드·정책·skill·hook·MCP·수집기·검사 수정과,
두 시험 프로필에서 검토한 후보의 정상 로컬 marketplace 등록·설치·갱신·선택,
정확한 후보 hook 해시 검토 후 신뢰 설정, ON 상태·실행·종료 후 복원이다.
사용자 기본/전역 프로필, 인증·결제·보안 통제와 무관한 설정은 보존한다.
별도 전역 runtime 설치, guard 우회, 새 모델·유료 API·공개 게시·push/merge/deploy는 하지 않는다.

모델·환경:
- Claude: claude-haiku-4-5-20251001, thinking 활성화/MAX_THINKING_TOKENS=8192 요청.
- Codex: gpt-5.6-luna, high. fallback 없이 실제 적용을 관측한다.
- 기존 Claude OAuth/MAX 및 Codex 구독 로그인만 사용한다. 잔여 포함량·실제 비용은 현재 미검증이다.
- 인증 파일·환경 전체·숨겨진 thinking을 출력·복사하지 않는다.
- 모델 입력은 검토한 공개 합성 자료로 제한하고, 결과 텍스트를 코드나 명령으로 실행하지 않는다.
- 제품의 독립 verifier native 세션과 개발용 subagent 위임은 구분한다.
  개발용 subagent 도구는 현재 호스트의 위임 규칙을 따르며 전권 위임만으로 자동 허용하지 않는다.
- native CLI 실행은 기존 scripts/bounded-native-process.cjs와 Windows Job의
  실행 전 할당/종료·잔여 0 검증을 재사용한다.
- 진단은 배치당 상위 native 시작 최대 12회, 관리 시작 최대 12회, 동시성 1,
  각 native 120초+정리 5초+supervisor 여유 20초, 관리 20초+5초+20초를 기본 한도로 삼는다.
  필요한 예산과 정상 원복 몫을 시작 전에 예약하고 내부 모델 응답·도구/검증자 호출도 따로 계수한다.
- 사용자 실행 메시지의 자율 반복 위임 아래 새 근거·변경 후보가 있을 때 새 유한 배치를
  스스로 계획해 진행한다. 문서가 과거 12회 상한을 소급 확장한 것으로 기록하지 않는다.
  106의 미사용 8회와 새 배정·소비를 중복 계수하지 않는다.
- 첫 실질 실패에서는 해당 후보 배치의 후속 행을 UNRUN으로 닫는다.
  새 배치에는 원인·변경·새 candidate binding이 있어야 하며 자동 무근거 재시도는 0회다.
- 원래 전체 비교는 별도 장부로 계획·실행한다. 516회를 디버깅에 전용하지 않는다.
  새 내부 단계가 필요하면 실제 총량을 별도 산정하여 기록한다. 호출 수를 숨기거나 516회로 뭉개지 않는다.
- 사용량/인증 제한·guard 거부가 나면 해당 효과를 멈추고 안전한 로컬 작업을 계속한다.
  유료 전환·로그인 변경·끝없는 대기/재호출로 해결하지 않는다.

106 마지막 복원 기록상 Codex는 ttak@ttak-release 활성, ttak@ttak-stop77와
ttak@ttak-withhold105 비활성이다. Claude 후보도 비활성이며 후보 ON 파일은 양쪽 모두 없다.
캐시·등록·비활성 신뢰 metadata는 남아 있다. 이 상태는 다음 native 전에 다시 확인한다.
Claude의 실제 loaded root가 cache가 아니라 로컬 marketplace source였으므로 둘 다 해시를 검사한다.

고정 binary 경로와 마지막 관측 해시:
- C:\Users\js\.local\bin\claude.exe — 2.1.266
  d2c5f7b3b6a12819097ceb6efbce2a390157166003fcaee32dbde0e6d7b45ef7
- C:\Users\js\.codex\packages\standalone\releases\0.154.0-x86_64-pc-windows-msvc\bin\codex.exe
  be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde

경로·버전·해시는 실행 전에 확인한다. 달라졌으면 이유와 새 계약을 검토하고 후보 근거를 새로 묶는다.
과거 binary hash를 맹목적으로 교체하거나 설치 파일을 다운로드하여 맞추지 않는다.

## 로컬 검증 환경과 금지된 재실행

Windows Python 별칭은 자동 설치를 일으킨 전력이 있다. 다음 기존 interpreter만 명시해 사용한다.
$env:TTAK_TEST_PYTHON='C:\Users\js\AppData\Local\Python\pythoncore-3.14-64\python.exe'
node scripts/test-local.cjs

실행 전에 해당 스크립트·현재 interpreter를 읽기 전용으로 확인한다.
필요한 Python 검사와 conformance를 별도로 수행하고 Node --test-concurrency=1을 유지한다.
106의 full-check-lifecycle.cjs는 결과 파일을 덮어쓸 수 있으므로 그대로 재실행하지 않는다.
새 출력 디렉터리를 사용하는 검토된 runner를 만든다.

verification-native-106/run-row.cjs, manage.cjs, audit-repair.cjs,
prepare-local-candidate.cjs, restore-own-state.ps1도 소모된 실행·원복 helper다.
원형을 검토해 재사용할 수 있지만 기존 디렉터리에서 실행하지 않는다.
failure-mechanisms.json은 수정 전 함수 재생이며 native resume 증거가 아니다.
보조 YAML validator는 PyYAML 부재로 미실행이다. 필요하면 프로젝트 안의 격리된 의존성만
소스·호환성 검토 후 사용하며 전역 설치나 무시된 실패로 대체하지 않는다.
과거 Python 폴더 재귀 삭제 guard 거부는 사용자 수동 제거로 해결됐다. 우회 삭제를 다시 시도하지 않는다.

## 종료·중단·인계

실험 종료와 최종 응답 전에 현재 소유 프로세스와 산출물을 확인하고 시험 프로필을 복원한다.
timeout/중단 후에는 결과를 한 번 회수하고 자식 프로세스까지 정리된 것을 확인한 뒤
남은 작업만 이어간다. 결과가 없다는 이유로 같은 효과를 재실행하지 않는다.

Go이면 기능별 판정과 동일 후보의 재현 가능한 근거·사용량·잔여 위험을 보고한다.
불가피한 외부 차단이면 정확한 차단 효과·근거·완료한 독립 작업·재개 조건을 기록한다.
날짜가 9월 14일 중간 판정 또는 9월 19일 목표를 지났다고 기준을 낮추거나 성공을 만들어내지 않는다.
컨텍스트 압축은 목표의 종료가 아니다. 호스트 종료가 필요하면 goal 상태와 다음 행동을 보존하고
다음 세션이 처음부터 재시작하지 않도록 새 인계 파일을 남긴다.
