# 실제 fact에 연결된 최종 구성165

후보 `0.2.0-rc.13+codex.20260913112509` / `ttak-compose165`.
164 CLOSED/RESTORED·누적1029를 기준으로 새 배정했다. 기존 실패·예약·UNRUN과
원래192 subjects/516 requests를 재사용하지 않았다. 전체 목표는 active / No-Go다.

## 변경과 로컬 근거

기존 `explanation_check_final.final_text`에 `{"fact_answers":"current"}` 선택지를 추가했다.
실제 fact가 이미 요청 언어·독자·형식·전체 요구에 맞을 때, 모든 답변 본문을 원래
순서대로 `\n\n`로 연결해 최초 최종 제안으로 사용한다. 일부 선택·정규화·재작성은 없다.
맞춤 작성과 revision1은 기존 literal 경로다. 독립 최종 검토와 정확한 Stop은 유지했다.

Claude는 기존 source_facts, Codex는 보존된 실제 fact 객체를 운반한다. Post에서
현재 native 결과 전체 SHA와 참조 경로의 순서를 대조한다. 소비된 native result reader를
재실행하거나 slot을 이전 단계로 바꾸지 않는다. 원문·본문은 새 retained 필드에 저장하지 않는다.
입력의 명시 selector는 registerFinal의 순서 검사를 위해 유지하고, 컴파일된 정확한 본문은
최종 packet에서 가져온다. hook/MCP 파일·도구 수·시간/크기/교정 한도는 바꾸지 않았다.

명시 참조 RED6FAIL → GREEN6PASS, 양 호스트 native-file 결과 조회·Pre/MCP/Post·Stop과
위조·미조회·다른 caller·다른 후보·pending 입력 변경을 포함한 집중206PASS/0skip.
신규 child 반례의 잘못된 부모 상태 기대1FAIL은 보존하고 기존 caller 격리를 확인해 수정했다.
전체 Node68파일/740·Python79·conformance PASS, version 고정 후 전체 재검사도 PASS.
helper9검사/24syntax, skill·marketplace PASS. generic plugin helper는 기존 per-host
MCP 경로 비호환으로 UNRUN이며 과거107/108 실패를 보존한다.

## 정상 plugin 관측

두 승인 프로필에서 정상 등록·설치·11hook 파일/명령/해시 검토·신뢰 설정·활성화 PASS.
원래 복합 Haiku 행03은120016ms에 timeout; Job 사전 할당·정리·소유 process0 확인.
감독 stdout은 보류되므로 예약된 세션과 연결된 child의 허용 필드만 한 번 회수했다.
숨겨진 reasoning이나 transcript 전체를 새 artifact로 복사하지 않았다.

실제 fact·최종 검증자2개, typed 제출2개, 짧은 native receipt와 부모 결과 조회2개를
현재 후보 코드로 대조했다. 관측된 순서 재구성은 retained attempt와 정확히 일치한다.
부모는 새 selector를 쓰지 않고 literal 최종을 작성했다. 9개 check 모두 pass/0issues로
승인된 그 본문을 정확히 전달했고, Stop은1회 `hook_success`/`{}`였다. 교정은0회다.
이 성공은 상위 프로세스 timeout과 의미 품질 실패를 상쇄하지 않는다.

최종의 “only at commit does SSI step in.”은 잘못된 배타적 시점 주장이다. 앞 문단의
정확한 설명과도 모순된다. PostgreSQL18의 읽기·쓰기 conflict 함수는 그 단계에서도
serialization failure를 발생시킬 수 있다. [공식 predicate.c](https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/predicate.c)
원래 S3에도 이 경계가 이미 있었다. H1/H2/H3와 Q2의 충족은 보존하되 Q1은 FAIL이다.
추가 정밀성 문제는 같은 초기 상태를 disjoint snapshots라고 부른 점과 첫
non-transaction-control statement라는 snapshot 취득 경계를 생략한 점이다.
[공식 격리 문서](https://www.postgresql.org/docs/18/transaction-iso.html)
guard-false의 abort라는 표현, CPU-side 문구, 양쪽 later-committing 표현만으로 별도
확정 결함을 늘리지 않았다. 실제 PostgreSQL 시험은 하지 않았다.

첫 SessionStart hook 기준 최종 결과 조회106126ms, 부모 최종118845ms, Stop119083ms.
이는 hook timestamp 차이이며 backend 지연이나 정확한 deadline 잔여 시간의 측정이 아니다.
새 본문 참조는 사용되지 않았으므로 정상 plugin에서의 효과를 PASS로 옮기지 않는다.

## 정산·다음 조사

native3/배정10/한도12, 후속7UNRUN, 한도 미사용9. 관리8/배정8/한도12(복원2 소비).
내부2/최대66, 관측 완료 응답13. input367010 + output9402 =376412 tokens;
thinking4511은 output의 부분집합이다. terminal CLI 합계가 없어 미관측 in-flight 사용량은
가능 상태로 남긴다. 누적1032 = Claude618 + Codex414.

두 프로필의 기존 선택을 대조·복원하고 후보를 비활성화했다. 이번 ON 파일2개만
기존 absent로 복원했으며 retained evidence와 설치 cache는 보존했다. 세션 중간 OFF 시험이 아니다.
원래192/516, 같은 후보 정상 대조·Codex 복합·보류·재개와 실제 cancel은 여전히 UNRUN이다.

165는 구성 기능의 선택지를 제공했지만 adapter 예제는 여전히 literal 작성을 기본으로
제시했고, fact verifier에는 evidence notes를 요구했다. 다음 수정은 이 실제 결정 지점의
불일치를 다룬다. reader 적합성·literal 조정·독립 검토를 없애거나 timeout을 늘리지 않는다.

근거: `.superpowers/release-loop-165/rows/03-claude-complex/{recovered,failure-audit,review}.json`,
`batch-closed.json`, `config-restored.json`, `own-state-restored.json`, 전체/집중 검사 로그.
