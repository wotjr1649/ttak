# Native 자식 수명주기 111

목표는 **active / No-Go**다. 후보 `0.2.0-rc.13+codex.20260912102445`의 정상 설치와
활성화는 통과했지만 Codex 단순 완료는 packet 전달 실패로 FAIL이다. Haiku 설명 행은
UNRUN으로 보존하고 두 프로필을 복원했다. 전체 출하 비교는 아직 시작하지 않았다.

## 수정과 검증

실제 110의 이벤트 순서를 따라 SubagentStart에서 verifier 초기 안내를 제공하고,
spawn 결과의 실제 Agent ID와 nonce로 자식 UserPromptSubmit을 식별해 부모 시도를
보존했다. 자식 turn을 해시로 결합하고 부모·다른 turn·다른 Agent의 packet 수신은
계속 거부한다. 실패한 자식 요청도 부모 실패 상태를 새 작업으로 지울 수 없다.
원래 긴 packet·초안·답변을 디스크에 저장하지 않는 경계를 유지했다.

수집기는 메시지·훅·사용량·종료를 thread ID로 구분하며 부모 종료만 완료로 처리한다.
Codex 실행별로 `features.apps=false`를 명시했다. 전역 설정이나 인증은 변경하지 않았다.
최종 후보는 Node **487 PASS**, Python **78 PASS**, conformance PASS, 수집기 별도
**4 PASS**다. skill·marketplace 검사도 PASS다. 변경 없는 범용 plugin 검사기 비호환은
이전 FAIL을 유지하고 같은 재실행은 UNRUN으로 기록했다.

버전 helper가 만든 CRLF 때문에 중간 전체 검사는 485 PASS / 1 FAIL이었다. 원본 bytes와
manifest를 보존하고 LF로 정규화했다. 이후 486 PASS를 거쳐 실패 상태 보존 검사까지
반영한 최종 487 PASS를 확인했다. 모두 설치·native 실행 전 준비였으며 호출을 중복 소비하지 않았다.

## 실제 Codex 결과

부트스트랩 context가 실제 자식에 전달됐고 부모 시도와 자식 turn이 유지됐다. 수집기도
자식 종료 후 부모를 계속 기다렸다. 자식은 정확한 challenge로 explanation_packet을
호출했으며 PreToolUse가 실제 수신자 결합을 허용했다. 그러나 MCP가
`explanation_verification_input_rejected`를 반환했다. 실제 packet 수신은 0개다.

같은 인수를 새 dispatcher 연결에 넣으면 동일 오류가 재현된다. 준비된 부모 packet,
정확한 인수, 30분 TTL 이내 실행, 서버 코드와 이 재현을 종합하면 **Codex 자식의 MCP
연결은 부모의 connection-local cache를 공유하지 않는다**는 진단이다. 연결별 process
ID를 별도로 관측한 것은 아니므로 이 부분은 근거를 바탕으로 한 추론으로 구분한다.

부모는 추가 verifier를 한 번 요청했지만 실패 상태의 훅이 거부했다. 이후 완성 설명을
보류하고 실패한 검사와 복구 조건을 알렸다. 보류 본문은 decide 결과와 일치했지만 Stop은
`stopped`이며 완료된 설명의 품질 PASS는 아니다. 정상 대조가 완료되지 않았으므로 FAIL이다.

## 장부와 복원

상위 native **배정 4 / 사용 3 / 상한 12**, 계획 UNRUN 1, 상한 미사용 9다. 내부 Agent는
**실제 1개 / 요청 2건 / 거부 1건**, 모델 요청 **13회**, 전체 **197,891 tokens**다.
부모 166,382와 자식 31,509를 원본 token_usage_record로 확인했다. 캐시와 thinking은
각각 입력·출력의 부분이며 중복 합산하지 않는다. 누적 상위 native는 **843회(Claude 506,
Codex 337)**다. 원래 **192 subjects / 516 requests UNRUN**과 닫힌 과거 배정은 별도다.

관리는 최초 배정 7에서 **8 / 상한 12**로 갱신했다. Claude marketplace manifest 누락으로
첫 등록 1회가 실패했고, host별 manifest를 추가한 새 예약으로 등록했다. 실패 예약을
재사용하지 않았다. 총 1 FAIL / 7 완료이며 복원 예약 2회를 모두 소비했다.

모든 Job 정리와 소유 프로세스 0을 확인했다. 프로필 선택과 후보 ON 상태를 복원했으며,
이번 후보의 ON 파일 두 개만 삭제하고 결과·실패 준비본·캐시는 보존했다. OFF 주입 제거
시험·유료 API·새 모델·전역 변경·guard 우회·게시·배포는 하지 않았다.

다음 112는 Codex의 정상 code-mode 호출에서 부모 MCP가 준비한 packet을 native spawn
인수로 직접 전달하는 경로를 검토한다. 모델이 긴 본문을 복사하거나 자식 MCP의 공유
cache에 의존하지 않고, host가 받은 실제 packet bytes·Agent ID·최종 결과를 결합해야 한다.
Claude의 실제 검증된 직접 조회 경로는 보존하며 양쪽 정상 plugin으로 다시 입증한다.

근거: `.superpowers/release-loop-111/native-plan-final.json`, `manifest-final.json`,
`full-qualified/`, `rows/03-codex-simple/failure-audit.json`, `batch-closed.json`,
`management-preparation-repair.json`, `management/`, `own-state-restored.json`.
