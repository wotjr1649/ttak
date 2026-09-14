# 초기 metadata 탐색179 — 네 항목 조회, 교정 등록 전 timeout

후보 `0.2.0-rc.13+codex.20260913191321` / `ttak-discovery179`, runtime34파일.
**CLOSED/RESTORED, Go 목표 active / No-Go**. 후속9행은 UNRUN이다.

## 변경과 로컬 대조

공통 skill의 code-mode 초기 탐색에 선택 entry 한 개를 찾는 코드를 추가했다.
178 actual metadata에 이 고정 코드를 로컬 적용하면15개/35615바이트 대신
prepare 한 개/5740바이트를 그대로 반환했다. 과거 모델 코드를 실행한 것이 아니다.
모든 script/hook·도구 schema·native recipe·아홉 검사·시간 한도는178과 byte 동일하다.

집중50PASS. 첫 집중49PASS/1FAIL은 native 호스트 선언부를 포함한 크기 기준을
선언부 없는 제품 설명에 적용한 시험 오류였다. 제품에서는 제외 항목의 정확한 bytes
합계를 검사하고,4배 감소 기준은 실제 native envelope 대조에서 유지·통과했다.
전체 첫835PASS/1FAIL은 추가 지시의 공급자 이름 표기였다. 기존 공급자 중립성 검사를
유지하고 적용 조건을 code-mode host로 수정했다.
새 전체 **Node80files836PASS/0skip**, Python79/conformance,
helper12검사/29구문·skill/marketplace·local resume PASS다.
generic plugin validator의 per-host MCP 경로 비호환은 아직 UNRUN이다.

## 실제 native 결과

첫 탐색은 한 번이지만 prepare/next/check_final/result **네 개,10951바이트**를
가져왔다. 선택 entry 한 개 지시를 정확히 따른 것은 아니다. metadata→entry는
18210ms로178의17052ms보다 짧지 않았다. 원래 task와 최초 잘못된 제안은 정확했다.
독립 fact는7/7/최종7을 반환했고, 최초 final은 final-only 오류를 올바른 source에
연결했다. 빈 fact_issues·fact 세 검사 pass와 정상 native 결과 조회를 다시 관측했다.
두 child 모두 실제 제출/반환/조회·wait/close를 완료했다.

최초 final call은48377ms 동안 실행됐다. 첫 줄 yield60000 설정 아래 별도 code-mode
yield/wait 없이 실제30초를 넘겨 완료한 사례다. 전체 deadline 개선의 증거는 아니다.
부모는 final recipe의 delivery 비교와 next_step 존재 검사를 생략했다.

부모가 correction 예정 literal을 commentary에 출력한 뒤 **120006ms timeout**이다.
수정본 등록/dispatch/검증·정확한 최종 전달·Stop은 모두 UNRUN이다.
retained attempt pending, FINAL0 returned/withheld, revision0, parent final_sha256:null.
수정 literal은 아직 등록·검토되지 않았으며, draft를 대화 밖에 유지하지 못했다.
이를 검토된 최종 전달로 인정하지 않는다. 무조건 보류나 초기 스트림 삭제로 고치지 않는다.

## 정산과 다음 작업

새 배정 native12/관리8(원복2)/내부88 중 실제 **native3/관리8(원복2)/내부2**,
완료 응답7(부모3+child2+2), **100065 tokens =95523입력+4542출력**,
thinking2270은 출력 부분집합이다. 부모 완료 원장47871과 checkpoint가 일치한다.
마지막 commentary는 마지막 완료 응답 이후 출력됐고 이후 token_usage_record가 없어
in-flight 사용량 불확실성을 유지한다. 더 적은 완료 토큰은 지연 개선이나 총 소모 절감의
증거로 삼지 않는다.

누적 **1075 =Claude636 +Codex439**. 모든 소유 process0, 양쪽 선택 복원/후보 비활성,
원래 없던 자체 ON2파일 제거 및 현재/frozen34파일 해시 일치를 확인했다.
원본/cache·기존 실패·예약·9UNRUN과192subjects/516requests 장부는 보존했다.
근거: `.superpowers/release-loop-179/batch-closed.json`,
`rows/03-codex-calibration/failure-audit.json` 및 원래 수집/사용량/정리 기록.
실패 감사 SHA:
`bfecb97e794bf3e5f8efd955c1b7ab20e7eceabaf1883f4e692e2492735aa4e0`.

탐색 문구를 같은 방식으로 다시 조정하지 않는다. 이 품질/완료 실패를 OPEN으로 유지하고,
독립적으로 해결 가능한 generic plugin validator 비호환을 공식 inline mcpServers 계약으로
조사한다. 전역 validator 수정이나 검증 완화는 하지 않는다.
최종 후보의 전체 H/Q·정상/새 사례/반복·실제 실패·취소·재개·네 기능/혼합 및192/516은
계속 필요하다. 패키지 검증 통과 역시 Go가 아니다.
