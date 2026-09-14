# Native 단일 전달 114

목표는 **active / No-Go**다. `0.2.0-rc.13+codex.20260912113923`에서 Luna fact
verifier의 full packet 전달·결과 반환은 실제로 입증했지만 최종 검사 등록은 실패했다.
후속 5행은 UNRUN이며 두 시험 프로필을 복원했다.

부모의 조회·spawn 단일 코드가 실행됐고, 실제 자식 transcript의 사용자 입력에
정확한 packet이 한 번 존재했다. 부모가 준 draft나 다른 verifier 답은 fact packet에
없다. 자식은 같은 Luna/high로 답하고 native receipt에 정확히 결합됐다. 그러나 부모가
최종 검사에 답을 다시 입력하면서 **challenge만 변경**했다. 이 원본을 그대로 재현하면
`verification_unobserved_fact`로 거부되고, 실제 반환 객체를 넣으면 등록된다.
검증을 완화하지 않고 전사 경로를 없애는 근거다.

wait와 close의 인수 이름도 각각 한 번 잘못 입력했다. 올바른 `targets` / `target`
호출로 자식은 끝내 닫혔지만 부모 Job은 **120,013 ms**에 timeout됐다. 최종 verifier와
부모 최종 답변은 없다. 상위 정상 종료나 Go로 처리하지 않는다.

상위 native는 **배정 8 / 사용 3 / 상한 12**, 관리는 **7 / 상한 12**, 복원 몫 2회
모두 사용이다. 내부 native Agent 호출·실제 시작은 **1회**다. 재시도 코드에 spawn
문장이 있었지만 그 앞 dispatch가 거부돼 spawn까지 실행되지 않았다. 최초 감사의
코드 출현 수 2는 `accounting-correction.json`에서 실제 호출 1로 정정했다.

원본 사용량은 부모 **16응답 / 233,534 tokens**, 자식 **3응답 / 33,216 tokens**,
합계 **19응답 / 266,750 tokens**다. timeout 중 미회수 사용량 가능성을 남긴다.
누적 상위 native는 **852회(Claude 509, Codex 343)**다. 과거 실패·예약 및 원래
**192 subjects / 516 requests UNRUN**은 새 배정과 구분한다.

고정 후보의 로컬 검사는 Node **500**, Python **78**, conformance PASS, 집중 **95**,
수집기 **4** PASS다. 첫 설치 전 launcher가 2.1.269로 바뀐 사실을 해시 경계에서
감지해 호출 0회로 멈췄다. 로컬에 남은 **기존 2.1.266의 정확한 해시와 Anthropic
유효 서명**을 확인해 그 파일을 사용했다. 해시 guard·전역 런타임은 바꾸지 않았다.

115에서는 Codex 0.154.0의 기존 `store`/`load`와 실제 확인한 wait/close 인수를
사용한다. 조회·spawn·wait·close·결과 보관을 하나의 짧은 코드로 묶고 다음 packet 및
최종 검사에 동일한 객체를 전달한다. 모델이 만든 답으로 바꾸거나 원본 해시를 고치지 않는다.

근거: `.superpowers/release-loop-114/manifest-final.json`, `full-qualified/`,
`rows/03-codex-simple/failure-audit.json`, `accounting-correction.json`,
`batch-closed.json`, `runtime-pins.json`, `management/`, `own-state-restored.json`.
후보 ON 파일 두 개만 원래 부재로 복구했고 증거와 캐시는 보존했다. OFF 주입 제거
시험·숨겨진 reasoning 복사·게시·배포는 하지 않았다.
