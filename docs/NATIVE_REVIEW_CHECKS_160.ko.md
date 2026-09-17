# 항목별 최종 검토 160 — 종료 및 평가 정정

후보 `0.2.0-rc.13+codex.20260913080307`, marketplace `ttak-checks160`은
**CLOSED/RESTORED / FAIL_TIMEOUT_BEFORE_FINAL_SUBMISSION**이다. 기존 전체
출하 목표는 active이며, 이 배치의 종료는 목표 완료가 아니다.

세 필수 검토를 아홉 항목의 객체로 받고 pass 또는 구체적인 issue index를
기록하도록 바꿨다. compiler는 이를 기존400-byte 필드에 손실 없이 인코딩한다.
누락·혼합·자유문장·연결되지 않은 issue를 정상 MCP에서 거부하며, 기존 결과
영수증·실제 조회·후보 결합·최종 본문·Stop 검사는 유지했다. 형식 검증은 의미
인증이 아니며, 현재 후보에서 객체형 최종 제출의 native 성공은 아직 미검증이다.

## 관측 결과

- 로컬 최종 검증: Node62파일/696PASS/0skip, Python79PASS, conformance PASS.
  집중136PASS/0skip, helper9검사와22개 syntax 검사 PASS. 후보 runtime34파일 고정.
- 양 호스트 정상 등록·설치·11hook 파일/명령/해시 검토·활성화 PASS.
- 원래 Haiku complex:120008ms timeout, exit_code0. Windows Job 사전 할당,
  cleanup_verified=true, 잔여 process0. exit_code0을 작업 성공으로 해석하지 않는다.
- 실제 fact 제출·native 영수증·부모 결과 조회·최종 제안·새 검토 schema 전달 확인.
  final verifier는 packet을 읽었으나 최종 제출·반환은 관측되지 않았다.
  부모 최종 본문·Stop·native cancel은 UNRUN이다. Job 정리는 native 취소 증거가 아니다.
- 회수1회와 정확한 상태 재생 완료. retained state는 final pending이며 submitted=false다.
  이후 응답이나 API 오류 기록이 없어 지연 원인을 확정할 수 없다.

## 의미 평가 정정

최초 `rows/03-claude-complex/review.json`은 보존한다. 새
`review-correction.json`이 다음 두 항목의 해석을 좁힌다.

1. SSI의 “추가 검사 불필요”는 이미 주어진 업무 guard 이외의 SSI 전용 검사를
   뜻할 수도 있다. 업무 guard 제거를 주장했다고 단정한 세 번째 항목은 근거 불충분으로
   철회한다. 이를 새 결함·수정·출하 실패 수의 근거로 사용하지 않는다.
2. 모델의 `guard_false`는 쓰지 않음을 나타내며 `write_conflict_abort`와 다르다.
   다만 실제 표현의 “aborts without writing”은 애플리케이션의 작업 중단일 수도 있다.
   DB abort 발생을 입증한 것으로 읽어서는 안 되지만, 이 문구만으로 독립된 DB 동작
   오류를 확정하지 않는다. 계산 결과와 애플리케이션/DB 결과를 구분할 필요가 남는다.

행 잠금이 concurrent snapshot 자체를 막는다는 fact와 제안 본문의 주장은 명확히
과도하다. PostgreSQL18의 행 잠금은 같은 행에 대한 충돌 쓰기·잠금 요청을 제한하며
일반적인 MVCC 읽기를 막지 않는다. 별도의 전체 트랜잭션 조정과 SQL 행 잠금은
같지 않다. 이는 공식 문서 대조이며 실제 DB 실행 검증은 아니다.
[PostgreSQL18 Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)

배치 FAIL은 최종 제출 전 timeout만으로도 유지된다. 위 정정은 실패를 성공으로
바꾸거나 H/Q를 완화하지 않고, 다음 수정이 실제로 입증된 결함을 겨냥하게 한다.

## 정산과 복원

native10 배정/3시작, 상한12 중9미사용, 후속7행 UNRUN. 관리8 배정/8시작,
그중 복원2. 내부 verifier66 상한 중2시작. 완료된 모델 응답9에서
input224488 + output4881 = **229369 tokens**를 관측했다. thinking1724는
output에 포함되며 중복 합산하지 않는다. 미보고 in-flight 사용량 가능성이 있다.
누적 상위 native는 **1013 = Claude606 + Codex407**이다. 과거 예약을 재사용하지 않았다.

두 프로필 선택을 복원하고 후보를 비활성화했다. 이 배치가 만든 ON 파일2개만
기존의 부재 상태로 되돌렸다. retained 증거와 설치 cache는 보존했다.
세션 중간 OFF 제거 시험은 수행하지 않았다.

근거 루트: `.superpowers/release-loop-160/`의 `batch-closed.json`,
`full-qualified-final/result.json`, `config-restored.json`, `own-state-restored.json`,
`rows/03-claude-complex/`의 `process.json`, `recovered.json`, `timing.json`,
`failure-audit.json`, `review.json`, `review-correction.json`.
실패 감사 SHA256은 `670ad2a10eeac8d682209f3a6c87baea4bbd46cbd6f3df7b610e8d866e68b8f9`다.

다음은 정확한 계산과 원문이 자유문장 fact·최종 제안으로 변환되는 구간의 조사다.
새 검토 형식의 native 성공, 정상·보류·재개·실제 취소, H/Q와 원래192/516 비교는
해당 최종 후보에서 따로 입증해야 한다.
