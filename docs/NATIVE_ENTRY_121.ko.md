# Native 진입 절차 121

후보 `0.2.0-rc.13+codex.20260912141247`은 **FAIL / 전체 목표 active / No-Go**다.
평문 보류 입력 수정은 실제 유효한 입력을 만들었지만, 먼저 호출한 잘못된 준비가
시도를 unavailable로 만들었다. 정상 보류·재개·복잡한 설명·원래 출하 비교를 통과한
것으로 계산하지 않는다.

## 관측과 원인

양 호스트 활성화는 PASS다. Haiku 보류 행은 87,534ms에 종료됐지만 첫 prepare의
필드가 `attempt_id,candidate_sha256,request,blocks`뿐이었다. `blocks` 문자열에
배열 뒤의 `questions`와 `sources`까지 합쳐 들어갔다. 전체 요청 6,491자 중
마지막 필수 요구 251자도 빠졌다. 동결된 코드로 `verification_invalid_fields`를
재현했고 원본 요청 hash 불일치도 별도로 확인했다. 이를 파싱·보충하여 승인하지 않았다.

이후 decide 입력은 같은 로컬 평문 검사에 통과한다. 그러나 실패한 시도라 실제
호출은 거부됐다. 마지막 답은 실측 부재와 T1이 B를 읽는다는 점을 찾았지만 결합된
보류 본문이 아니며 요구를 제거하는 선택지를 제시했다. 실제 Stop은 `continue:false`,
`not verified`였다. CLI의 success 표시를 제품의 PASS로 대체하지 않았다.

원본 근거는 `.superpowers/release-loop-121/rows/03-claude-unresolved/`의
`collected.json`, `process.json`, `failure-audit.json`, `review.json`이다.
전체 transcript나 숨겨진 thinking은 복사하지 않았다.

## 연결 계층 조사와 다음 변경

SHA256 `d2c5f7b3b6a12819097ceb6efbce2a390157166003fcaee32dbde0e6d7b45ef7`인
고정 Claude 2.1.266 실행 파일을 읽기 전용으로 조사했다. MCP 도구 구성은
`inputSchema`를 `inputJSONSchema`로 옮기지만 raw MCP `strict` 전달은 확인되지
않았다. 별도 API schema 변환은 unsupported keyword가 있으면 non-strict로
돌아간다. 모델 API의 strict 지원과 현재 native MCP 적용은 같은 증거가 아니다.
실행 파일·전역 설정·guard는 변경하지 않았다.

122에서는 초안 준비보다 먼저 필수 근거 부족을 판단하도록 시작 분기를 명확히
한다. 기존의 두 동등한 첫 선택을 바꾸고, 보류 분기에서는 준비를 시작하지 않게
한다. 이 지침 수정은 아직 native 성공 증거가 아니며, 잘못된 준비·실패 후 재시도·
원본 요청 생략 거부는 그대로 유지한다. 정상 보류부터 새 후보에서 검사한다.

## 검증과 정산

로컬은 Node **45파일 / 522 PASS / 0 skip**, Python **78 PASS**, conformance
PASS, 집중 검사 **117 PASS**다. 수집기 5건·세션 인수 2건·skill 및 marketplace
검사도 PASS다. 일반 plugin validator의 기존 호스트별 MCP 경로 비호환은
UNRUN-known-incompatibility로 유지했으며 성공으로 바꾸지 않았다.

새 배정 native 8회 중 **3회**, 관리 **7/7회**, 원복 예약 **2/2회**를 사용했다.
native와 관리 상한은 각각 12, 동시성 1이다. 실제 내부 Agent **0회**, 완료 모델
응답 **3회**, 입력·캐시 **81,003** + 출력 **7,649** = **88,652 tokens**다.
thinking 2,758은 출력의 부분집합이다. 유료 API 과금액으로 해석하지 않는다.

후속 5행은 UNRUN이다. 모든 소유 Job은 정리·잔여 process 0이고 두 프로필의
선택을 복원했다. 새 ON 파일 2개만 원래의 부재 상태로 복원했으며 증거와 캐시는
보존했다. 이는 세션 중간 OFF 시험이 아니다. 닫힌 누적 상위 native는
**879회(Claude 524 / Codex 355)**다. 원래 **192 subjects / 516 requests는
별도 UNRUN**이며 과거 실패·미사용 예약을 새 배정으로 재사용하지 않았다.
