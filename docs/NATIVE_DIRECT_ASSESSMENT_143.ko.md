# 독립 평가의 직접 전달 143

## 가설과 변경

140의 불충분한 지표 추가와 142의 무조건 쓰기 주장은 부모가 정확했던 선행 평가를
보류문용 입력으로 다시 작성하면서 생겼다. 해당 실패 원본은 그대로 보존한다.

143은 선행 평가의 `essential_gaps`와 `corrections`를 기존 보류 formatter와 같은
구조로 받는다. 새 `explanation_notice_from_assessment`는 binding·실제 결과·언어만
받고, 같은 bounded stdio 연결의 원문과 실제 평가 필드를 그대로 사용한다. 부모가
추가한 보류 문구·gap 삭제·정정을 입력으로 받지 않는다. 이는 사실성 인증이 아니다.
별도의 fresh native 보류 검토, 기존 한 번 수정, 정확한 최종 전달 조건을 유지한다.

정상 Post hook은 반환된 원문·실제 평가로 전체 payload를 재계산하고 관측된 native
receipt hash와 대조한다. 새 raw durable 저장·서비스·IPC는 없다. 누락된 Pre/Post,
다른 결과·요청·후보, 중복 첫 제안과 활성 verifier 폐기를 차단한다. 기존 수동 보류
수정 경로와 정상 draft/fact/final 경로는 유지한다.

Codex 수집기에 누락됐던 최근 평가·보류 도구명도 명시적으로 추가했다. 알 수 없는
도구와 다른 서버는 계속 거부한다. 과거 Codex 후속 UNRUN을 성공으로 바꾸지 않는다.

## 후보와 로컬 근거

- 후보: `0.2.0-rc.13+codex.20260912222958`, namespace `ttak-direct143`.
- `.superpowers/release-loop-143/manifest-final.json`: runtime 30파일 고정.
- `direct-assessment-red`: 기존 185 PASS / 신규 4 FAIL. 새 입력 계약 미구현을 재현했다.
- `direct-assessment-initial`: 188 PASS / 1 FAIL. 추가된 도구명을 반영하지 않은 기존
  전달 안내 assertion을 확인했고, 원래 copy-only 조건을 유지하며 갱신했다.
- `direct-assessment-qualified`: 집중 198 PASS / 0 FAIL / 0 skip.
- `full-qualified`: Node 47파일 / 603 PASS / 0 skip, Python 78 PASS, conformance PASS.
- 고정 후보 lifecycle, skill, marketplace, 수집기 6검사, runner 2검사 PASS.
- 일반 plugin validator의 기존 per-host MCP 경로 비호환은 UNRUN으로 보존한다.
  호스트별 패키지 검사·정상 설치와 구분하며, 기존 실패를 PASS로 바꾸지 않는다.

`writing-for-agents`와 `skill-creator`에 따라 공통 skill은 분기 원칙을 설명하고
호스트별 전달 형식은 adapter가 제공한다. `plugin-creator`의 기본 UTC cachebuster와
정상 로컬 등록·설치 절차를 사용했다.

## 실제 결과와 정산

새 배정은 native 8 / 관리 7(복원 2 포함), 각 상한 12, 동시성 1이다. 내부 verifier
상한 40, native 120초+정리 5초, 관리 20초+정리 5초, 자동 재시도 0을 유지한다.
과거 누적 950회(Claude 569 / Codex 381), 과거 FAIL·UNRUN·미사용량과 별도다.

두 프로필 정상 등록·설치·활성화는 관측했다. Codex hook 11개는 설치 파일 30개와
정확한 source path·명령·matcher·timeout·해시 대조 후 정상 신뢰 설정을 적용했다.

Haiku는 원래 6,491자 요청의 독립 평가 → 직접 전달 → 별도 보류 검토를 실제 실행했다.
내용과 receipt 재생은 PASS다. 필요한 실측 근거와 정확한 T1 읽기 정정을 유지했고,
142의 모든 schedule에 대한 쓰기 주장을 추가하지 않았다. 첫 최종문 형식 변경은 Stop이
거부했고 한 번의 복사 교정 뒤 정확한 본문을 전달했다. 99,408ms / 완료 응답12 /
289,183 tokens다. 보류만의 통과이며 정상 완성 설명 H/Q의 통과는 아니다.

Luna는 첫 `explanation_assess_request`에 원문 대신 14,520자를 보냈다. 로드된
`<skill>`을 포함했고, 원문의 처음 5,878자가 일치한 뒤 S4 version·targets·필수
실측 요구 꼬리를 변경·누락했다. 원래 6,491자 전체가 제출 문자열 안에 없으므로
단순한 앞부분 제거로 복구할 수 없다. 제한된 literal parser로 실행 없이 인수를
복원해 원문 binding 실패를 재현했다. 실제 Pre는 차단했고 Stop은 stopped,
retained attempt는 unavailable다. 독립 평가·보류 검토는 0회다. 마지막 문장의
그럴듯한 내용으로 이 실패를 대체하지 않는다. 86,430ms / 완료 응답3 /
59,939 tokens다.

배치는 Luna FAIL로 닫았다. 후속 재개·정상 대조 네 행은 UNRUN이다. native4 /
관리7(복원2) / 실제 내부 verifier2, 완료 응답15 / 349,122 tokens를 관측했다.
누적 native는 954회(Claude571 / Codex383)다. 모든 소유 Job 정리·process0과
두 프로필의 실제 선택 복원을 확인했다. 시험이 만든 ON 상태 파일2개를 원래의
부재 상태로 되돌렸고 캐시·등록·실패 근거는 보존했다. 세션 중간 OFF 시험이 아니다.

전체 목표는 active / No-Go다. 다음 조사 계층은 첫 요청의 native 전달 경계다.
원래 입력을 정확히 전달하는 경로를 확인하며, 변경된 원문을 정규화해 승인하거나
실패한 시도를 재실행하지 않는다. 정상 완료 H/Q, 재개·실패·취소, 같은 최종 후보의
known/unseen/반복 및 원래 192 subjects / 516 requests 등 미검증 기준은 남아 있다.
