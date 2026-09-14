# 원문 기반 계산과 최종 검토 실패 152

목표 **active / No-Go**. 후보 `0.2.0-rc.13+codex.20260913032437`의 정상 Haiku가
116,425 ms 안에 독립 fact와 final, 정확한 최종 본문 전달 및 정상 Stop을 완료했다.
그러나 의미 오류를 final 검증자가 승인했으므로 **FAIL_SEMANTIC_FALSE_COMPLETE**다.

## 구현과 로컬 근거

새 `explanation-source-model.cjs`가 원문의 완전한 JSON 문서/문자열에서 기존 Boolean
정의를 찾고, 정확한 범위·문서 SHA·JSON 경로·모델 SHA를 남긴다. 제공된 결과 표가
아니라 원래 정의를 기존 엔진으로 다시 계산한다. 모델 적합성·출처 권한·DB 관측을
인증하지 않는다. 원문의 prose 요구와 실제 독립 검증을 유지한다.

계산 결과를 부모 prepare 응답과 fact/final packet에 결합했다. 정확한 final에는
기존 부분 prose 검사를 자동 적용한다. 저장 모델은 기존 ordinal 이름으로 익명화하고,
Stop에서 지원되는 계산상 모순은 독립 `complete` 주장으로 우회할 수 없게 했다.
이미 계산한 모델에서는 별도 scenario_review용 초안 재작성 호출이 필요하지 않다.
자동 계산이 없는 예제는 기존 명시 경로를 유지한다.

새 parser의 입력·깊이·방문·중첩 decode·모델 수·출력 상한, 중복 key, unsafe data,
정의/결과 변조와 보통·변형·guard_false·serial도 실패하는 모델을 검사했다.
저장 시 익명화 누락 결함은 테스트에서 발견해 기존 canonicalScenario를 사용하도록
수정했다. 첫 집중 242 PASS/1 FAIL, 수정 후243 PASS. 후속 Stop 거짓승인 반례를 포함한
전체 **Node54파일/649 PASS/0skip, Python79, conformance PASS**다.

32파일 freeze, 정상 설치·11hook 파일/해시/신뢰, skill·marketplace helper, 수집기7,
인수2 및 로컬 보류/재개 검사 PASS. 새 모듈을 원래 비교 입력/설치 목록에 추가해 변조
검사도 했다. 범용 plugin helper의 기존 경로 비호환은 과거 FAIL과 현재 UNRUN을 유지한다.
기존151 대비 runtime 변경은 manifest2·verification·evidence hook·shared skill·새
모듈의 정확한6파일이며, 나머지와 이전 근거는 보존했다.

## 실제 결과를 구분한 판정

원래 입력 SHA는 `414f92ef155cdac2f0fdf37cddcf80562828bb1ad198e803110b661933ea5544`다.
원문350..6240 UTF-16 범위의 `bundle.sources[0].text`를 JSON으로 해석한 `scenario`와
그 계산이 실제 부모·fact·final 경로에 결합됐다. 모델 SHA는
`d152c546851d3f02fb893ea6cd584aef78f15016a401902c7829723d6b93a7ae`다.

최종 본문의 H1/H2와 명시적인 전체 트랜잭션 조정 완화책 H3는 맞았다. 읽기/쓰기
역할과 guard_false 무갱신이 정리됐지만 전체 흐름의 의미 품질은 실패했다.

- fact가 T2 snapshot을 두 transaction의 snapshot보다 먼저 얻었다고 서술했다.
- fact의 선형 latency와 final의 high/medium 비용 비교에는 필요한 조건이 없다.
- final이 SSI monitoring/predicate lock의 비차단을 모든 lock·충돌로 넓혔다.
  PostgreSQL18은 Repeatable Read에 있는 차단 위에 monitoring이 추가 차단을 만들지
  않는다고 구분한다. 직렬 동등성의 대상도 committed 결과다.
  [PostgreSQL18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- 한 완화책 요청에 추가 구현 비교를 만들고, SSI 설명의 commit-order 조건을 누락했다.
- final 검증자는 정확한 제안 본문을 `answer`에 통째로 복사하고 `complete`/issues0을
  반환했다. 검토 결과를 작성하는 역할과 설명을 작성하는 역할이 분리되지 않았다.

최종 partial report 역시 평가0·미검사58·semantic_certification=false다.
기계 감사 SHA `05737516bbda33e3ea1e250e750716bc8b7e7b758fa0e3c0727294c42a33bd8b`는
전달/결합/Stop 근거이며 위 오류를 승인하는 인증서가 아니다.

## 정산·복원과 다음 단계

새 native8배정/3실제/상한12, 후속5 UNRUN, 상한미사용9. 관리7/상한12,
복원예약/사용2. 내부상한44/Agent2, 완결응답11, **259,718 tokens**
(input248,702 + output11,016; thinking3,088은 output 일부).
실제 전체 model usage와 대조했으며 이번 행에 미보고 실행 중 사용량은 표시하지 않았다.
새 누적 **986(Claude590 / Codex396)**다.

모든 소유 Job 정리와 process0, 두 프로필 기존 선택 복원, 시험 ON 파일2개의 원래 부재
복구를 확인했다. 근거·캐시는 보존했고 세션 중간 OFF 제거는 하지 않았다.
원래 **192 subjects / 516 requests**, 실패/취소/재개, 같은 최종 후보의 나머지
과제·변형·반복·기능 비교는 아직 미완료다.

다음153은 final 검증을 요구 충족·제안 주장·독립 fact 이유에 대한 전용 구조화 검토로
만든다. 원래 계산·fact 독립성·receipt·본문 SHA·보류·재개·단일 수정 상한은 유지한다.
152를 재실행하거나 이 부분 완료를 Go로 계산하지 않는다.

근거는 `.superpowers/release-loop-152/`의 DESIGN, original-source-probe, source-delta,
manifest-final, full-qualified, rows/03-claude-complex/{completion-audit,source-model-audit,
review}, management, own-state-restored, batch-closed다.
