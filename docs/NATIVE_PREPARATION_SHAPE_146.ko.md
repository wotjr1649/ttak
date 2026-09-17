# 146 — 원래 복잡한 설명의 준비 인자 형식 실패

145와 같은 `0.2.0-rc.13+codex.20260912233010`을 제품 변경 없이 재활성화해,
원래 6,240자 explain-expert 조건과 H1–H3/Q1–Q2를 시험했다. 첫 Haiku 행이
FAIL하여 Luna 행은 UNRUN으로 닫았다. 전체 목표는 **active / No-Go**다.

독립 요청 평가는 모든 필수 요구가 제공 자료로 충족 가능하다고 올바르게 반환했다.
뒤이은 `explanation_prepare`는 원문과 두 `current` 식별자가 정상이었지만,
`blocks`를 배열 대신 8,203자 문자열로 보냈고 필수 `questions`와 `sources`를 누락했다.
실제 입력을 고정 후보에 재생하면 `verification_invalid_fields`다. 부모 응답의
stop_reason은 `tool_use`, 출력은 4,386 tokens였다. 원문 변형이나 timeout으로
추정했던 문제가 아니라 정상 준비 입력의 구조 오류다. 잘못된 문자열을 추출·수선해
받아들이지 않았으며 guard를 약화하지 않았다.

정상 fact/final 검증은 시작되지 않았다. 부모는 실패를 인정한 뒤 검증되지 않은
완성 설명을 직접 출력했다. 실제 Stop은 `continue:false`와 미검증 이유를 남겼고
retained attempt도 unavailable다. CLI의 success 종료는 본문 승인 근거가 아니다.

본문에는 FOR UPDATE와 FOR SHARE가 공존한다는 오류, A→B 순서라고 하면서
T1은 B·T2는 A부터 잠그는 모순, RR의 변경된 행 잠금 오류를 빠뜨린 최신값 읽기
설명이 있다. Q1과 전체 흐름 FAIL이다. [PostgreSQL 18 잠금 문서](https://www.postgresql.org/docs/18/explicit-locking.html)를 대조했다.
snapshot의 첫 non-transaction-control statement 시점과 감시 비용도
[격리 문서](https://www.postgresql.org/docs/18/transaction-iso.html)에서 재확인했다.
SSI의 dangerous structure와 false positive는 [README-SSI](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/README-SSI),
읽기·쓰기·commit 검사 경계는 [predicate.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/predicate.c)를 확인했다.
이 자료를 새 native 입력에 추가하거나 기존 조건을 바꾸지는 않았다.

## 원인 계층 조사

준비 도구에는 `strict` 요청이 없지만, 플래그 추가만으로 다음 native를 시작하지 않았다.
[Anthropic strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use)는 API 도구 수준의 schema 제약을 설명한다.
MCP·SDK 전달에서 속성이 사라지는 보고는 [CLI issue 41827](https://github.com/anthropics/claude-code/issues/41827)과
[SDK issue 1243](https://github.com/anthropics/claude-agent-sdk-python/issues/1243)에 있으나, 보고된 버전을 현재 버전 증거로 옮기지 않았다.

실제 pinned 2.1.266 binary hash를 재확인하고 코드 문자열을 읽기 전용으로 조사했다.
내부 API builder에는 strict-compatible schema 처리 경로가 있다. 반면 조사한
MCP mapping은 기본 tool template와 지정 필드로 다시 구성하며 서버의 `strict`
속성을 전달하지 않는다. API 요청을 가로채거나 인증·호스트를 수정하지 않았다.
이전 result 도구의 `strict:true`는 요청 metadata였지 공급자 강제 관측이 아니었다.

다음은 이 optional host 경로를 우회하지 않고 Claude의 준비 인코딩을 명시적인
단일 JSON 문서로 바꾸는 프로젝트-local 경로다. 원래 blocks/questions/sources의
필수 필드·타입·내용·한계·원문과 native binding 검사는 그대로 적용한다.
기존 실패 인자의 묵시적 변환이나 실패 후 재시작을 허용하지 않는다. 아직 구현·native
효과는 미검증이다.

## 정산과 복원

새 배정 native4 / 관리5(도움말1·설정2·복원2), 각 ceiling12, 동시성1.
실제 native3 / 관리5 / 내부 평가1 / 모델 응답7 / **178,934 tokens**.
Haiku 설명 행은 108,924ms에 종료했다. 후속 Luna1행 UNRUN, ceiling 미사용9회는
다음 배정에 합산하지 않는다. 누적 **968(Claude578 / Codex390)**다.

모든 소유 Job의 process 0, 두 프로필 선택 복원, 이번 ON 파일 2개만 원래 부재로
복원, source/frozen runtime31 hash 일치를 확인했다. 캐시·신뢰·근거는 보존했다.
세션 중간 OFF 제거 시험은 하지 않았다. 로컬 기준은 **Node615 / Python79 /
conformance PASS**이며 이번 같은 후보 재실행이 새 회귀 실행은 아니다.

근거: `.superpowers/release-loop-146/batch-closed.json`, `rows/03-claude-complex/`의
failure-audit·review·process·원본 collected, 관리·신뢰·복원 기록. 원래
**192 subjects / 516 requests** 비교와 남은 출하 조건은 실제 UNRUN이다.
