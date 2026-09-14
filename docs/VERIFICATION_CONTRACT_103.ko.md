# 부모 출력·메타 이벤트·주장 연결 계약 보완 103

작업 루트는 `D:\AI_DEV\ttak\.superpowers\worktrees\first-release`다. 102의 실패 기록을
보존하고, 현재 사용자가 요청한 원인 진단·수정·재검증을 진행한다. 기존 84회 승인 중
102에서 사용한 1회를 제외한 **최대 83회**를 새 장부의 상한으로 두며, 새 자식은 최대
60개, 동시성 1, 각 native 실행 120초·정리 5초를 유지한다. 자동 재시도는 없다.
각 실패는 닫힌 기록으로 남기고 새 근거를 확보한 뒤 별도 예약으로 실행한다.

## 변경한 계약

부모는 `claim_map_sha256`와 `blocks[{id,text,link_ids}]`를 생성한다. 각 연결 ID는 검토된
질문 계획의 질문/의무 한 쌍을 나타낸다. 전체 spec의 해시로 매핑을 고정하며, 존재하지
않는 연결이나 오래된 매핑은 거부한다. 모델이 독립적인 `question_ids`/`obligation_ids`
배열을 조합하지 않는다.

본문은 블록 텍스트를 두 줄바꿈으로 이어 만들고, 주장 인용문은 같은 블록에서 가져온다.
원래의 본문/인용 일치, 질문 범위, 의무 누락, 미해결 비교, 결과 해시 검사는 그대로 실행한다.
연결된 블록은 선언된 범위의 근거이며, 그 안의 모든 의미가 정확하다는 인증은 아니다.

재작성의 비교는 `check_id`를 고른다. 로컬 코드가 ID를 실제 질문과 전체 결과 해시에
결합한다. 이전 계약은 계산 도구가 없는 모델에게 입력에 제공하지 않은 해시를 요구하고
있었다. 고정 비교표에는 결과와 해시가 함께 있으며, 모델은 해시를 계산하거나 출력하지 않는다.

재작성은 먼저 초안의 각 주장과 연결된 질문 결과의 조합을 모두 평가한다. 로컬 코드가
`R0001…` 검토표를 고정하고, 모델은 각 항목의 `supported`/`contradicted`/`not_established`와
근거를 한 번씩 제출한다. 누락·중복·알 수 없는 ID를 거부하며, 오류로 인정한 초안 블록이
완성 답변에 그대로 남으면 거부한다. 다른 표현으로 같은 오류를 남기거나 거짓 `supported`를
내는 경우까지 기계적으로 판정하는 검사는 아니다. 실제 실행에서 이 한계가 확인됐다.

`unmapped_claims`는 **실제로 출력한 주장 중 질문 계획이 다루지 못하는 내용**을 뜻한다.
사용하지 않은 대안이나 요청받지 않은 주제를 적는 필드가 아니다. `uncovered_obligations`도
필수 의무의 미충족만 기록한다. Haiku가 쓰지 않은 SSI 대안을 전자에 넣은 실제 중단 이후,
스키마 설명과 생성 지시 양쪽에 이 의미를 명시했다. 비어 있지 않은 배열을 거부하는 기존
수신 검사는 유지했다. 해당 사례의 후속 실행은 조정 후 진단이며 새로운 미검증 표본이 아니다.

Claude 부모는 내장 `StructuredOutput`을 한 번 호출하도록 명시한다. Codex 부모는 기존
`--output-schema` JSON 응답을 사용한다. Claude 감사는 원래 입력, 선택적인 정확한
`structured-output-enforce` 메타 이벤트, 출력 호출, 성공 응답의 순서와 연결을 검사한다.
도구 응답의 `is_error`는 실제 관측된 생략/false만 허용한다. 알 수 없는 메타 입력,
중복 UUID·출력 호출, 잘못된 세션/역할/연결, 오류 응답은 거부한다. 감사 증명은 해당
수집 보고서와 입력에 결합된 메모리 객체이며 모델이나 일반 JSON으로 위조할 수 없다.

마지막 반례 검사에서 메타 이후 출력 호출의 부모 연결과 잘못된 `isMeta` 자료형을 놓치는
5개 실패를 재현해 수정했다. 첫 응답 앞의 native attachment는 관측 한계로 남기되,
이후 assistant 조각과 메타 응답의 실제 연결은 검사한다. 당시 15개 실제 부모 기록의
22개 후속 연결을 확인했으며 모두 연결돼 있었다. 전체 실제 부모 재생 결과는 최종 장부에
기록한다. 숨겨진 thinking 내용은 읽기 결과나 증거 파일로 내보내지 않는다.

## 중단 원인을 따라 보완한 자식 전달

긴 JSON을 coordinator가 그대로 복사하는 v3 경로에서 `prompt`만 불일치하고 나머지
호출 필드는 일치하는 실패를 관측했다. 필드별 참/거짓 진단을 추가했으며 거부된 원문은
저장하지 않는다. `verification-pinned-submit-v4`에서는 검토된 로컬 코드가 고정 packet과
앵커를 자식 정의에 직접 넣고, coordinator는 해당 packet 해시가 든 짧은 호출문을 전달한다.
자식에게 초안·형제 결과는 전달하지 않는다. 자식의 도구는 `verification_submit` 하나이며,
서버는 기존 고정 입력 해시·단일 제출·정확한 인용과 응답 해시를 검사한다.

v3는 과거 진단과 함께 유지한다. v4는 실제 사용자 입력의 짧은 호출문과 로컬에서 구성한
자식 정의를 결합한 경로다. native의 전체 system/developer 입력을 관측했다거나 OS 수준
격리를 검증했다고 주장하지 않는다. 기존 프로필·로그인·전역 설정은 수정하지 않았다.

Codex의 긴 복사문도 실제로 변형됐다. 새 설명 경로의 Codex 질문 검증은 새 독립 CLI
세션에 로컬 코드가 packet과 앵커를 직접 전달하는 `schema_version:5` 입력을 쓴다.
실제 사용자 입력과 고유 세션, 도구 미사용, 모델/effort, 인용, 결과를 감사한다.
이는 native 하위 에이전트 생성과 다르며 `independent_verifier_session`으로 기록한다.
원래 v2 native coordinator 진단은 보존한다. 기존 예산의 coordinator 수는 보수적인
기존 경로의 상한이며, 새 Codex 경로의 실제 실행 역할은 각 `audit.json`에 기록한다.

양쪽 생성 계약은 근거 범위를 넘어선 대안이나 비용 일반화를 금지하고, 모델의 범위 제한과
실제 미해결 질문을 구분한다. 제출 수신기는 `answered`와 비어 있지 않은 `uncertainties`의
모순을 거부한다. 미해결 내용을 삭제해서 통과시키지 않는다. Claude 최상위 조합 스키마
시험은 native 단계에서 실패해 평면 스키마 설명과 동등한 로컬 검사를 사용했다.
해당 실패의 원문 오류는 회수하지 못했으며, [Claude Code의 동일 API 제약 보고](https://github.com/anthropics/claude-code/issues/4886)와
조합 제거 후의 실제 통과가 이 진단을 뒷받침한다. Codex 직접 출력의 상수 필드는
명시적인 `type`을 요구하는 `invalid_json_schema` 오류를 실제 기록에서 확인하고 보완했다.

Claude 도구 선언에는 `strict: true`를 추가했다. [공식 strict tool 설명](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use),
[SDK의 속성 전달 문제 보고](https://github.com/anthropics/claude-agent-sdk-python/issues/1243),
고정 CLI 2.1.266의 해당 속성 처리 경로를 확인했다. 이 프로젝트는 속성을 누락하는 것으로
보고된 Python SDK를 쓰지 않고 stdio 도구 선언을 직접 제공한다. 실제 공급자 요청을
가로채 확인하지 않았으므로 “strict를 요청했다”가 검증 범위다. 로컬 수신 검사는 항상 실행한다.

Luna의 한 실행은 Q3에서 실제 `server_overloaded`로 끝났다. 이를 입력 스키마 오류와
구분하는 닫힌 진단 분류를 추가했다. 공급자 오류 원문은 저장하지 않으며 모델 교체나
자동 재시도는 하지 않는다. 이후 별도 실행에서 같은 모델의 응답이 관측돼 용량 장애의
일시성이 확인됐고, 실패한 이전 행은 그대로 남겼다.

## 증거 위치와 범위

`.superpowers/verification-contract-103/`에 사전 파일 해시, 개별 테스트 로그, 재생 검사,
시작 예약, 시도별 결과와 정산을 둔다. native 실행 기록은
`.superpowers/verification-worker-95/contract103-*`에 있다. 숨겨진 thinking·인증 값·원시
native stdout은 복사하지 않는다. 실패 뒤에도 선택된 출력과 사용량을 회수할 수 있도록
부모 감사 전 checkpoint를 기록한다.

102의 메타 이벤트는 새 감사로 연결을 확인했고, 같은 기록의 CL5 coverage 오류는 여전히
거부됨을 재현했다. 첫 새 초안의 인용 복사 실패도 통과로 바꾸지 않았다. 사전 백업의
동명 파일 충돌은 원본 소스 해시 `fb05995fbd94e7cb24efd50d99cb6b2ad5fc418d4add0b6cb85fa1cd604318ba`
와 정확히 일치하는 task 소스 snapshot으로 복구했으며, 복구 시 다른 세션 내용은 저장하지 않았다.

완성 답변의 판정은 고정된 known/normal/unseen 과제의 기존 H/Q를 사용한다. PostgreSQL
18의 [격리 수준](https://www.postgresql.org/docs/18/transaction-iso.html),
[명시적 잠금](https://www.postgresql.org/docs/18/explicit-locking.html),
[SSI 원본 설명](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/README-SSI)을
다시 확인했다. 구조·전달 통과를 의미 정확성이나 출하 승인으로 바꾸지 않는다.

제품은 rc.13 / No-Go다. 현재 시험 프로필은 Codex rc.1 활성·Claude plugin 없음이며,
정상 rc.13 plugin 품질 및 192 subjects / 516 requests 비교는 별도 출하 요건이다.
최종 실제 실행·완성 답변 검토와 파일 보존 결과는 아래에 기록한다.

## 실제 완성 흐름 검토

- `contract103-normal-codex-3`: 새 CLI 5회로 초안·독립 질문 3개·재작성을 완료했다.
  Root가 완성 답변과 모든 질문 결과를 검토해 H1–H3/Q1–Q2, 질문 누락·검증 오판·
  재작성 새 오류·정상 대조 회귀를 모두 PASS로 기록했다. 실제 native subagent 수는 0이며,
  독립 verifier 세션은 3개다. 관측 사용량은 69,482 tokens다. 이 판정은 독립 blind 평가가 아니다.

- `normal-claude-1`: 완성 답변 H/Q는 통과했으나, 독립 확인이 현재 실행 방식 자체를
  완화책으로 부르거나 serializability의 이유를 잘못 설명했고 부모가 수용해 흐름 판정 FAIL이다.
- `normal-claude-3`: 자식 답변의 범위는 개선됐으나 부모 결론에 근거 없는 일반 필요조건과
  모호한 이중 부정이 추가돼 Q1·재작성 새 오류 FAIL이다. 결과를 재사용한 rewrite 진단의
  본문은 개선됐지만 비교 이유의 라벨 오류가 있어 새 전체 흐름 통과로 계산하지 않는다.
- `known-claude-6`: 8단계를 완료했으나 초기 상태가 존재하지 않았다는 주장, 순서 있는 잠금이
  serialization failure·재시도 비용을 모두 없앤다는 주장 등이 남아 H1/Q1 FAIL이다.
  주장별 검토표를 추가한 rewrite 진단도 거짓 `supported`를 냈다. 초안을 제외한 별도
  재구성 진단도 잠금 순서 모순을 만들어 FAIL이며 제품 경로로 채택하지 않았다.
- `known-codex-2`: 8단계·119,333 관측 tokens. 역순 예제에서 T1이 B 대신 A를 읽는다고 쓴
  초안 오류를 `R0002`가 놓쳤고 재작성에 유지해 H1/Q1·부모 검토 FAIL이다.
- `unseen-codex-1`: 8단계·121,088 관측 tokens. 최종 H1–H3/Q1–Q2와 질문 누락·재작성 검토는
  PASS다. 부모는 Q2의 메커니즘 표현과 Q5의 구체화되지 않은 잠금 대안을 보수적으로
  제한하고 완성 답변에 근거 있는 Serializable 완화책만 남겼다. 마지막 계약 버전의 새 정상
  대조는 실행하지 않았으므로 전체 검토 상태는 `UNREVIEWED`다. 이 실행 전 해당 사례를
  이용한 조정은 없었지만, 사전 공개된 합성 사례이며 독립 blind 검증은 아니다.
- `unseen-claude-1`: 사용하지 않은 SSI 주제를 `unmapped_claims`에 넣어 첫 초안에서
  `explanation_uncovered_content`로 중단했다. 초안의 잠금 설명에도 오류가 있으므로
  완성 답변 통과로 계산하지 않는다. 후속 7단계는 이 시도의 UNRUN 기록으로 보존한다.
- `unseen-claude-2`: 필드 의미를 명확히 한 뒤 8단계·175,608 관측 tokens로 완성했다.
  미사용 대안의 잘못된 `unmapped_claims` 보고는 해소됐고, `R0006`이 SSI의 정확한 순환
  탐지라는 초안 오류를 찾아 재작성에서 고쳤다. H1–H3/Q2는 PASS지만 Q1은 FAIL이다.
  잘못된 쓰기 가시성 시점, commit 단계로 단정한 SSI abort, 잠금 후 반드시 최신 값을 읽는
  설명이 남았다. 초안의 올바른 snapshot 시점도 재작성에서 일반 concurrent-start 표현으로
  바뀌었다. 질문 누락보다 부모의 잘못된 수용·재작성 새 오류가 남은 실패 원인이다.

위 시도 이름은 모두 `contract103-` 접두사를 갖는다. 과거 성공을 최종 계약의 반복 성공으로
소급하지 않는다. 원래 102의 캠페인도 재개하거나 통과로 덮어쓰지 않았다.

## 최종 검증과 정산

- 최종 코드 관련 회귀: **22개 파일 / 252 PASS / fail 0 / skip 0**, 27,834 ms.
  `regression-final-contract.json`과 같은 이름의 로그에 기록했다. 제품 전체 회귀는 아니다.
- 메타 경계 추가 5개 반례는 수정 전 실패를 재현했고 수정 후 통과했다.
  Claude 부모 실제 기록 **18개**의 최종 재생도 모두 PASS다. 별도로 102의 실제 메타 이벤트는
  PASS, 그 출력의 CL5 잘못된 연결은 계속 거부했다. 재생으로 새 native 호출은 발생하지 않았다.
- 29개의 별도 실행·진단에서 새 상위 CLI **82회(Claude 51, Codex 31)**를 관측했다.
  질문 검증 예약은 **55회**이며, 이를 실제 native subagent 55개로 해석하지 않는다.
  기존 739회를 더한 누적은 **821회(Codex 328, Claude 493)**다.
- 이번 장부 상한 83회 중 **1회가 남았다**. 정상 전체 흐름 5회 또는 known/unseen 전체 흐름
  8회를 추가할 수 있는 잔여량은 아니다. 이전 중단 행과 원래 반복 시험의 UNRUN을 유지한다.
- 회수된 관측 사용량: 입력·캐시 **1,189,715**, 출력·추론 **153,762**, 합계 **1,343,477 tokens**.
  중단된 native의 일부 사용량이 회수되지 않았으므로 완전한 소비량·금액이 아니다.
  API 응답 수와 비용 완전성은 미검증이며, 유료 API로 전환하지 않았다.
- **82개 Windows Job** 모두 시작 전 프로세스 할당, 정리 완료, 종료 시 소유 process 0을 확인했다.
  Codex/Claude 바이너리 해시·버전 및 시험 프로필 검사를 통과했고 기존 설정을 유지했다.

정산은 `accounting.json`, 시도 목록은 `attempts-final.json`, 프로세스는
`processes-final.json`, 프로필·바이너리는 `environment-final.json`, 실제 부모 재생은
`parent-replays-final.json`에 있다. 파일 보존 검사는 `file-audit-final.json`과 `final.diff`로
기록한다. 위 파일들은 모두 `.superpowers/verification-contract-103/` 아래에 있다.

## 남은 실패와 출하 경계

세 계약의 구조·연결·수집 경계는 수정하고 반례와 실제 기록으로 검증했다. 그러나 부모가
정확한 근거를 받고도 일부 거짓 `supported`를 내거나 재작성에서 새 오류를 만드는 문제는
남았다. 주장별 검토표는 누락과 연결을 검사하고 실제 교정도 관측했지만, 의미 정확성을
기계적으로 보증하지 않는다. 같은 실패를 근거 없이 반복하거나 최종 Q1을 완화하지 않는다.

최종 계약의 양쪽 호스트 known/normal/unseen 반복 성공, 독립 blind 평가, 정상 rc.13 plugin
흐름, 제품 전체 회귀, **192 subjects / 516 requests**는 미충족 또는 UNRUN이다.
전체 입력의 OS 수준 격리와 공급자 API 소비량도 미검증이다. 제품 **rc.13 / No-Go**를
유지하며 이 기록을 출하 완료 또는 설명 정확성의 완벽한 증명으로 사용하지 않는다.
