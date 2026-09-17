# Native 최종 형식 검증과 보류 전달 실패 — 125

125 후보 `0.2.0-rc.13+codex.20260912154755`는 양 호스트 정상 대조에서 PASS했지만,
Haiku 보류 본문 전달에 실패했다. 전체 Go 목표는 active이며 원래 H/Q·192 subjects /
516 requests 비교를 대체하지 않는다. 근거는 `.superpowers/release-loop-125/`다.

## 관측과 원인

- Haiku 정상: 96,152ms, 중립 fact 1개와 final 2개. 첫 최종 검증자는 네 문장을
  요청된 두세 문장 제한 위반으로 withheld 처리했다. 부모가 세 문장으로 고친 뒤
  새 final 검증자가 complete를 반환했고, 실제 본문·Stop이 일치했다.
- Luna 정상: 83,152ms, 중립 fact 1개와 final 1개, 최종 두 문장 및 Stop PASS.
- Haiku 보류: 23,394ms, 유효한 `explanation_decide`를 호출했지만 반환 본문에
  필수 요구를 제거·대체하자는 안내를 덧붙였다. 실제 Stop 교정 사유는 이미 결정된
  상태에도 일반적인 처음 검증 절차였다. 모델은 정확한 본문 대신 확인 메시지를
  썼고, 두 번째 불일치가 unavailable로 보존됐다. guard가 이를 통과시키지는 않았다.

Haiku 정상 감사는 실제 revision 0/1의 packet·Agent ID·typed 제출·native 종료를
순서대로 고정 코드에 재생하여 보존된 attempt 전체와 일치함을 확인했다. 기존 감사의
단일 final 가정을 실제 근거에 맞춰 확장했으며 native를 재실행하지 않았다.

## 정산과 다음 수정

Node 45파일 / 527 PASS / 0 skip, Python 78 PASS, conformance PASS. Native 5/8,
관리 7/7(복원 2/2), 내부 Agent 5개, 응답 30개, 449,932 tokens를 관측했다.
후속 3행은 UNRUN이며 두 프로필 선택과 task-created ON 파일 부재를 복원했다.
누적 상위 native는 897회(Claude 535 / Codex 362)다. 캐시와 실패 근거는 보존했다.

후속 원본 대조에서 125의 Codex final 검증자에게 실제 JSON 반환 교정 1회가 있었음을
확인했다. 개별 completion 감사에는 1회였지만 batch-closed의 해당 필드만 0으로
잘못 고정돼 있었다. `accounting-correction-serialization.json`에 1회로 정정했고
원래 폐쇄 장부는 보존했다. 상위 호출·응답·tokens 합계는 바뀌지 않는다. 실제 blocked
SubagentStop의 정확한 교정문, 마지막 JSON과 completed Stop을 다시 대조했다.

126은 결정 전 검증 시작과 결정 후 정확한 본문 재전달을 다른 Stop continuation으로
분리한다. Codex의 교정용 새 prompt에서 초기 안내를 다시 주입하는 경로도 함께
수정한다. 원문 해시, 독립 완료 근거, 실패 보존과 단 한 번의 교정 한도는 유지한다.
기존 125 예약·실패·UNRUN과 126의 새 배정을 구분한다.
