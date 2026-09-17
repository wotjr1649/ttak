# Luna 보류 통과와 Haiku 실제 정정 적용 뒤 timeout — 134

후보 `0.2.0-rc.13+codex.20260912185537`은 원문을 사용자 과제 본문으로 정의하고,
자동 host metadata와 구분했다. 원문 문자열을 잘라내거나 해시 검사를 완화하지 않았다.
사용자가 인용한 metadata 예시는 보존된다. 집중161, 전체 Node45파일 / 566 PASS /
0 skip, Python78, conformance를 통과했다. 30파일 고정과 정상 설치·11개 hook 검토도
완료했다. 실제 실행은 활성화 뒤 Luna, Haiku 순서였다.

## Luna 보류 PASS

첫 호출부터 정확한 6,491자 사용자 과제를 전달했다. 요청된 실측 자료만 미해결로
남기고 T1의 B 읽기/A 쓰기를 별도 corrections로 설명했다. Native 검토자1개,
정확한 packet·결과·본문·Stop·보존 상태가 일치했다. 실패 도구·문구 교정·JSON
재전달 교정은 없었다. 완성 설명 H/Q 통과로 세지 않았으며, 초기 정정이 이미 맞아
전용 수리 호출은 이 행에서 UNRUN이다.

## Haiku: 실제 수리 적용 PASS, 전체 행 FAIL

초기 proposal은 실측 요구를 보류했으나 corrections 필드를 생략하고 T1 평가를
빠뜨렸다. 부모는 검토 전 완성되지 않은 보류문과 요구 삭제 선택지를 내보냈고,
Stop이 검토를 요구하는 1회 continuation을 냈다. 첫 native 검토자가 누락을 정확히
찾아 typed correction을 반환했다. `explanation_repair_notice`는 그 실제 결과를
동일 연결에서 읽고, 원문·기존 요구를 유지한 채 정정을 추가했다. 전체 native receipt
재생이 revision1의 planned 상태와 일치한다. 이 실제 적용은 최초 관측이다.

그러나 120,003ms timeout에 도달해 새 검토와 최종 전달은 UNRUN이다. 첫 Agent는
19:00:44.395–19:01:56.547 UTC, **72,152ms** 실행됐다. packet 조회 다음 모델 응답에서
관측 thinking은 **6,895 tokens**였다. 숨겨진 내용은 출력·복사하지 않았다. 조회와
typed 제출 사이 65.233초에는 추론·출력·호스트 지연이 포함되므로 전부 추론 시간으로
단정하지 않는다. 8192 요청 설정을 변경하거나 한도를 늘리지 않았다.

현재 남은 문제는 첫 안내의 요청된 평가 누락과 그로 인해 필요한 두 번째 검토다.
135는 첫 proposal에서 corrections를 명시하도록 하고, 주어진 근거로 판정되는 초안
평가와 충족 불가능한 필수 요구를 구분한다. 이 변화로 모델의 누락이 없어졌다고
단정하지 않으며, 실제 정상 plugin의 첫 proposal과 최종 결과로 판별한다.

## 근거와 정산

`.superpowers/release-loop-134/rows/04-codex-unresolved/withholding-audit.json`과
`review.json`, `rows/03-claude-unresolved/failure-audit.json`에 각각 기록됐다.
Native4/8(상한12), 관리7/7(상한12, 복원2/2), 내부Agent2개, 완료응답13개 /
262,596 tokens다. timeout에서 미보고 진행 중 사용량 가능성이 남는다. 후속4행 UNRUN,
두 프로필 선택·후보 비활성화·task-created ON파일2개 부재 복원, 모든 Job 정리·
process0을 확인했다. 캐시·원본은 보존됐다. 누적 native926회(Claude553 / Codex373),
전체 active / No-Go, 원래192 subjects / 516 requests 비교는 여전히 UNRUN이다.
