# 기본 최종 구성 recipe166

후보 `0.2.0-rc.13+codex.20260913114319` / `ttak-recipe166`.
165 CLOSED/RESTORED·누적1032를 기준으로 새 배정했다. 전체 목표는 active / No-Go다.

요청-wide fact가 사용자 언어·독자·명시 형식을 따르도록 바꾸고, 양쪽 adapter 최종
recipe의 기본값을165의 `{"fact_answers":"current"}`로 맞췄다. 필요하면 literal로
조정할 수 있고 revision1도 literal을 유지한다. 원문·실제 fact·독립 final의 역할과
해시/순서/조회/Stop·모델·시간·교정/크기 한도는 바꾸지 않았다.
165 대비 runtime 변경은 두 manifest·verification·skill4개, 전체34개 파일을 고정했다.

실행형 recipe 검사 RED3FAIL/2PASS →5PASS; 기본 참조 및 literal 조정을 실제
in-process MCP에 통과시켜 원문·결과 객체·최종 hash를 대조했다. 집중211PASS/0skip,
고정 버전 전체 Node69파일/745·Python79·conformance PASS. helper9검사/24syntax·
skill·marketplace PASS. 기존 generic plugin helper 비호환은 UNRUN과 과거 실패를 보존했다.

## 정상 plugin 결과

승인된 두 프로필에서 정상 등록·설치·11hook의 파일/명령/해시 검토·신뢰·활성화 PASS.
원래 Haiku03은120초 timeout, Job 사전 할당·정리·소유 process0 확인.
예약한 세션의 허용 필드를1회 회수했으며 전체 transcript·숨겨진 reasoning은 복사하지 않았다.

fact는 원문 모델 `d152c546…`을 정확히 제출하고 추가 prose 없이 기존 계산기 본문만
반환했다. 부모는 실제 결과를 읽었으나, senior database engineer와 doctor analogy에
맞추겠다며 기본 참조 대신 literal 초안을 썼다. 새 참조의 native 효과는 여전히 UNRUN이다.

초안에는 두 transaction을 세 doctor decision으로 부른 오류와, Repeatable Read의
명시 잠금에서는 deadlock만 재시도를 요구한다는 잘못된 제외가 있었다.
PostgreSQL18은 snapshot 뒤 실제 변경된 행을 잠그거나 갱신하려 할 때도 serialization
failure가 가능하며 전체 transaction 재시도가 필요하다. 일관된 lock order만으로 그
조건은 사라지지 않는다. [공식 격리 문서](https://www.postgresql.org/docs/18/transaction-iso.html)
원래 S2/S4에도 그 경계가 있었다. 실제 DB나 SQL snippet 실행은 하지 않았다.

독립 final verifier는9개 check 모두 pass/0issues로 오승인했다. 그러나 native receipt를
반환한 뒤 부모의 `explanation_result` 조회는 없었다. 부모 최종 본문·Stop도 없다.
실제 관측 순서를 현재 후보로 재구성한 결과 retained attempt와 정확히 일치했다:
fact returned/answered, final referenced/verdict null, attempt pending/final hash null.
따라서 잘못된 독립 승인을 부모가 완료로 소비했다고 주장하지 않는다. 전달 H/Q는 UNRUN,
제안 Q1과 상위 실행은 FAIL이다. guard-false abort 표현만으로 별도 결함을 늘리지 않았다.
후속 대조에서는 `A=false (now true)`도 값과 진술의 진위를 구분할 수 없는 모호한
표현으로 재판정해 독립 확정 실패 사유에서 제외했다. 원본 review는 보존하고
같은 행의 `review-correction.json`에 정정을 기록했다. RR 재시도 오류·timeout 판정은 같다.

첫 SessionStart hook 기준 fact 조회37119ms, final native 반환116914ms.
이는 hook timestamp 차이이며 backend 지연이나 정확한 deadline 잔여 시간은 아니다.

## 정산·다음 조사

native3/배정10/한도12, 후속7UNRUN, 한도 미사용9. 관리8/배정8/한도12(복원2).
내부2/최대66, 관측 완료 응답11. input279219 + output9090 =288309 tokens,
thinking4742는 output의 부분집합이다. terminal 합계가 없어 미관측 in-flight 사용량은
가능 상태로 남긴다. 누적1035 = Claude620 + Codex415.

두 프로필의 이전 선택을 대조·복원하고 후보를 비활성화했다. 이번 ON 파일2개만
기존 absent로 되돌렸고 retained evidence·설치 cache는 보존했다. 중간 OFF 시험이 아니다.
원래192/516과 같은 후보 정상·Codex 복합·보류·재개·실제 cancel 조건은 아직 미완료다.

다음에는 참조 default/안내를 반복하지 않는다. 현재 최종 packet은 canonical JSON의
키 정렬 때문에 실제 final_text 뒤에 계산·부분 보고서·원문·schema가 온다. 원문과 실제
fact가 모두 전달됐는데도 명백한 잘못된 최종안을 승인한 문제를 대상으로, 검토 대상의
배치와 짧은 native 판별 과제를 조사한다. 데이터·검사·한도를 제거하거나 늘리지 않는다.

근거: `.superpowers/release-loop-166/rows/03-claude-complex/{recovered,failure-audit,review}.json`,
`batch-closed.json`, 복원 기록과 전체/집중 검사 로그.
