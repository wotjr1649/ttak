# 정상 보류 진입 122

후보 `0.2.0-rc.13+codex.20260912145622`은 **기계적 보류 PASS / 의미 항목 FAIL**이다.
전체 출하 목표는 active / No-Go다. 기준을 보류 기능 하나로 줄이지 않는다.

## 관측

진입 안내에서 전체 요청의 필수 근거 확인을 초안 준비보다 앞에 두었다. 양 호스트
정상 ON 이후 Haiku는 처음부터 유효한 `explanation_decide`를 호출했고, 실제
도구 응답과 동일한 보류 본문을 전달했다. 측정값이나 완성 설명을 만들어내지 않았다.
실제 Stop은 `{}`였고 저장된 attempt는 withheld였다. 새 내부 Agent는 0회다.

그러나 요청 끝의 “T1이 A를 읽는다는 초안을 평가하라”를 답하지 않았다. S1에서
T1의 guard는 B를 읽고 A를 쓴다. [기존 gate 105](NATIVE_WITHHOLDING_PLAN_105.ko.md)는
이 오류 정정과 보류를 모두 요구한다. 기계 감사 PASS로 이 누락을 덮지 않았다.
`.superpowers/release-loop-122/rows/03-claude-unresolved/withholding-audit.json`과
`review.json`이 각각 기계 관측과 의미 판정이다.

현재 결정 도구는 unresolved 항목만 받는다. 이미 제공된 근거로 해결된 오류 정정은
별도로 담을 수 없다. 이를 근거 부족으로 잘못 분류하거나 도구 본문 밖에 붙이는
방식은 적절하지 않다. 다음 변경은 보류 본문 계약에 짧은 정정을 별도로 표현하되,
완성 설명의 독립 검증·정확한 본문 결합·실패 상태 보존을 유지하는 것이다.

## 검증과 정산

집중 **118 PASS**, 최종 전체 Node **45파일 / 523 PASS / 0 skip**, Python **78**,
conformance PASS, 수집기5·세션 인수2·skill·marketplace PASS다. 새 반례는
PreToolUse의 외부 status와 Stop 이후 attempt.status를 구분하도록 fixture를
바로잡은 뒤 통과했다. 이 과정에서 runtime guard는 변경하지 않았다.

native 새 배정8 중 **3**, 관리 **7/7**, 원복 **2/2**, 양쪽 상한12·동시성1이다.
완료 모델 응답 **2**, 입력·캐시 **46,658** + 출력 **1,124** = **47,782 tokens**다.
thinking690은 출력의 부분집합이며 유료 API 과금액을 관측한 것이 아니다.
후속 **5행 UNRUN**, 모든 Job 정리·잔여 process0, 두 프로필 선택 및 새 ON 파일2의
원래 부재를 복원했다. 캐시·원본 증거는 보존했고 세션 중간 OFF 시험은 하지 않았다.

닫힌 누적 상위 native **882회(Claude526 / Codex356)**다. 원래 **192 subjects /
516 requests 비교는 별도 UNRUN**이며 과거 예약과 새 배정은 구분한다.
