# 동일 후보 Luna 호스트 범위 155

목표 **active / No-Go**. 제품 변경 없이154 후보
`0.2.0-rc.13+codex.20260913040904`를 정상 설치에서 재사용했다.
Haiku의 거부된 요약 호출을 다시 실행하지 않았으며400-byte 상한도 그대로다.
새 Luna 배치는 **FAIL_TIMEOUT_BEFORE_FINAL_REVIEW**로 종료·복원했다.

## 근거와 원인 범위

32파일의 현재 소스·154 동결본·Codex 설치본 hash가 모두 일치했다.
11hook의 실제 경로·명령·event·matcher·timeout·hash 검토 뒤 정상 신뢰/활성화를
확인했다. 전체 Node653/Python79/conformance는154에서 관측한 동일 후보 근거를
hash로 연결해 재사용한 것이며 새로 실행했다고 주장하지 않는다. 새 helper9검사는
PASS다. 초기 helper 감사의 reporter/개수 가정 오류와 원래9-pass 로그를 보존했다.

Luna/high의 정상 fact 제출·정확한5093-character native JSON 반환과 부모의 원문/
실제 fact 객체 재사용, 정확한 final 준비·새 검증자에 전체 packet 전달을 확인했다.
전체 관측된 상태 전이 재생이 retained state와 일치했다. 그러나 **120014ms**에
timeout이 났고 final 제출·반환·부모 final·Stop은 없었다. 상태는 pending이다.
Job 종료를 native 취소/보류 성공으로 해석하지 않는다. 완료된 H/Q PASS는 없다.

- 부모 첫 기록: 04:43:10.412Z.
- fact 검증자 첫 기록: 04:43:36.100Z.
- fact result 도구 호출: 04:44:01.603Z.
- 같은 전체 JSON의 native final 반환: 04:44:22.646Z — 호출 뒤21043ms.
- 최종 검증자 첫 기록: 04:45:05.642Z — 부모 첫 기록 뒤115230ms.

이는 결과 재출력 비용의 실제 근거다. 이 비용만 없애면120초 안에 모든 검토가 끝난다는
증거는 아니다. 요약 문구/상한 조정보다 결과 전달 구조와 불필요한 부모 왕복을 조사한다.
새 경로도 실제 typed 제출·독립 자식 완료·결과 hash·최종 본문 대조를 보존해야 한다.
154에서 거부된 결과를 새 경로로 수용하거나 제한을 올리지 않는다.

감사 SHA `9adc80df2048c3e126e2c4635181bf918e78094befb5810bf9e0a0e1e87810ba`.
초기 감사는 UserPromptSubmit hook 하나를 가정했으나 실제 정의/ID5·6은 같은 turn의
두 hook이다. 두 개의 completed/empty를 정확히 확인했다. timeout checkpoint의
사용량은 부모 완료 응답 마지막32969 tokens의 갱신 전이었다. 실제 native 기록의
누적 prefix와 모든 live 값을 대조해 누락분을 회수했다. 모델을 재실행하지 않았다.

## 정산·복원

새 native4배정/2실제/상한12, 후속 unresolved/resume2 UNRUN, 상한미사용10.
관리2/상한12, 복원예약/사용1. 내부상한22/실제Agent2, 완료응답8,
**175654 tokens** = input170602 + output5052; thinking1335는 output 일부다.
최종 검증자는 완료 사용량 기록이 없어 미보고 in-flight 사용량 가능성을 남겼다.
새 누적 **994(Claude594 / Codex400)**다. 과거 실패·예약·UNRUN과 별도 배정이다.

모든 소유 Job 정리·process0, 정상 Codex 선택 복원, 자체 ON 파일1개를 원래 부재로
복원했다. Claude 프로필은 변경하지 않았다. 캐시와 미검증 상태·감사 근거는 보존했고
세션 중간 OFF 주입 제거는 하지 않았다. 원래192 subjects/516 requests와 필수 출하
조건은 미완료다. 이 실패는 전체 개발 목표의 종료가 아니다.

근거: `.superpowers/release-loop-155/`의 DESIGN, preflight, manifest-final,
native-plan-final, helper-validation, rows/02-codex-complex/{timeout-audit,review},
management, own-state-restored, batch-closed.
