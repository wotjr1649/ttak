# Native 보류 검토 실행·수정과 요구 해석 오류 — 128

후보 `0.2.0-rc.13+codex.20260912165556`는 정확한 Agent 호출 객체를 직접 발급해
실제 독립 보류 검토 2회를 실행했다. 첫 검토자는 빠진 T1 평가를 정확히 찾았고
부모는 해당 정정을 추가했다. 두 번째 검토자는 원문의 필수 실측 요구를 정성적
비용 설명으로 대체해도 된다고 잘못 판단했다. 이후 부모가 120초 한도에 도달했다.
전체 배치 FAIL이며 Go 목표는 active다.

## 변경·검증

각 fact·next·final·withholding packet 응답은 현재 challenge에 맞는 완성된
`Agent` 객체를 제공한다. 정확한 launch binding과 XML/잘못된 packet 거부는
유지했다. 수정 중 변수명 중복 문법 오류와, 모든 packet의 adapter가 같다고
가정하던 기존 테스트를 바로잡았다. 집중 140 PASS, 전체 Node 45파일 / 545 PASS /
0 skip, Python 78 PASS, conformance PASS. 실제 설치 hook 11개와 후보 30개 파일을
검토했고 두 정상 활성화를 확인했다.

## 회수한 실제 기록

`.superpowers/release-loop-128/rows/03-claude-unresolved/failure-audit.json`은 예약된
native 세션 `628a241e-02e3-40fe-b381-3dc56273b26d`와 자식 2개의 원본에서 필요한
자료만 회수했다. supervisor는 timeout의 부분 stdout을 제공하지 않으므로 빈
collected 보고서를 사용량 0으로 계산하지 않았다. 숨겨진 thinking은 복사하지 않았다.

- Revision 0: T1이 B를 읽는다는 요청된 평가가 누락됐다고 정확히 지적했다.
  다만 대체 근거를 허용해 달라는 원래 보류문의 문구는 놓쳤다.
- Revision 1: 부모는 T1의 실제 읽기 대상과 S1 근거를 추가했다. 검토자는 O5의
  일반 비용 조건만으로 판단하여, 그 밖의 명시적인 필수 실측 요구를 사실상
  취소했다. “측정 자료가 없다”는 사실이 필수 요구를 충족하거나 없애지는 않는다.
- 실제 packet·native ID·typed 결과·종료 receipt를 고정 코드로 재생해 남은
  attempt와 완전히 일치함을 확인했다. 두 검토 모두 withheld였고 완성 설명이나
  승인된 보류문은 전달되지 않았다. 한도가 끝난 뒤 pending / revision1 상태는
  보존됐으며 프로세스는 모두 정리됐다.

## 정산과 다음 조사

상위 native 3/8, 관리 7/7(복원 2/2), 실제 내부 Agent 2개, 관측 완료 응답 10개 /
166,993 tokens다. 종료 전 진행 중 소비의 미보고 가능성이 있어 완전한 사용량으로
주장하지 않는다. 후속 5행은 UNRUN이다. 두 프로필 선택과 task-created ON 파일
부재를 복원했고 캐시·원본 근거는 보존했다. 누적은 906회(Claude541 / Codex365)다.

129는 보류 항목을 원문의 정확한 요구 문장에 결합하고, 검토 packet에서 그 인용과
원래 전체 문맥을 함께 대조하게 한다. 인용 일치는 의미 인증이 아니며, 실제 native
검토 품질이 다시 필요하다. 시간 한도를 늘리거나 거짓 판정을 통과시키지 않는다.
원래 H/Q·검사 실패·취소·정상/새 사례/반복 및 192 subjects / 516 requests는 남아 있다.
