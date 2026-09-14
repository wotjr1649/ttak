# 요청 평가 회복과 충분하지 않은 성능 근거 요청 — 140

후보 `0.2.0-rc.13+codex.20260912212016`은 요청 평가 전용 typed 결과를 도입했다.
원래 요구의 `essential_gaps`와 평가 자체의 실패를 분리하며, 일반 fact와 전용
평가 결과의 상호 대체를 거부한다. 집중183, 전체 Node46파일 / 588 PASS / 0 skip,
Python78, conformance, 고정 후보 상태 수명주기와 정상 설치·11개 hook 검토는 PASS다.

Haiku의 실제 선행 평가가 `assessed`를 제출했고 canonical `answered`로 정확히
반환됐다. 필수 실측 자료 부족과 T1 reads B / writes A라는 정정을 분리했다.
부모 보류안, 다른 fresh 검증자의 전용 보류 결과, 실제 Stop의 한 번 전달 교정,
정확한 최종 본문과 retained withheld 상태도 모두 기계적으로 일치했다.

그러나 부모가 `evidence_needed`에 throughput·latency 외에 **transaction-abort
rates를 대안으로 추가**했고, 최종 검토자는 이를 승인했다. 중단 비율만으로는
정확한 slowdown을 계산할 수 없다. 같은 중단 비율에서도 monitoring 비용과 재실행
작업량·시간이 다르면 처리 시간과 처리량이 달라진다. 이는 S2가 monitoring overhead와
반복 작업 비용을 구분한 조건과도 맞는다. 원래 평가 결과의 성능 근거 요청에는 이
부정확한 대안이 없었으며 부모 재작성에서 추가됐다.

`review-semantics.cjs`는 같은 중단 비율0.1에서 기준 시간100 대비110과150이라는
서로 다른 시간 배정을 비교해 slowdown10%와50%가 모두 가능함을 확인한다.
이는 정보 부족을 보이는 논리적 반례이며 실측 workload나 성능 개선 결과가 아니다.
최종 본문의 근거 요청이 원래 필수 값을 결정하기에 충분하지 않으므로 의미 FAIL이다.

## 근거와 정산

`.superpowers/release-loop-140/rows/03-claude-unresolved/withholding-audit.json`의
기계 PASS와 `review.json`의 의미 FAIL을 분리했다. Native3/8(상한12), 관리7/7
(복원2), 실제Agent2, 완료응답12개 / **279,326 tokens**, 109,870ms 정상 종료다.
후속5행 UNRUN, 두 프로필 선택 복원, task-created ON파일2개 원래 부재 상태 복원,
모든 Job 정리·process0을 확인했다. 증거와 캐시는 보존했다. 누적 **944회
(Claude565 / Codex379)**, 전체 active / No-Go, 원래192 subjects / 516 requests
비교는 여전히 UNRUN이다.

141은 필수 자료가 없다는 판단과, 제안한 자료를 받으면 실제로 그 요구를 해결할
수 있는지의 판단을 분리한다. 보류문 전용 native 결과에 근거 충분성 검토를 요구해
부모가 추가한 불충분한 대체 지표도 명시적으로 대조한다. 특정 단어의 금지나
정규식으로 의미 검증을 대신하지 않으며, 같은 원래 과제로 실제 동작을 다시 검증한다.
