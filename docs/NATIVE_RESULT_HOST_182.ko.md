# host별 결과 조회182 — Claude 영수증 복사 실패

후보 `0.2.0-rc.13+codex.20260913210215` / `ttak-read182`, runtime33파일.
**CLOSED/RESTORED, 전체 Go 목표 active / No-Go**다.

Claude tools/list의 결과 조회에서 Codex 전용 include_next_step 필드만 제외했다.
나머지14개 Claude 도구와15개 Codex 도구 metadata는181과 동일하다.
모든 hook·실행 compiler·receipt·revision·실패/재시도 검사와 native recipe도
byte 동일하며, 잘못된 입력을 자동 보정하거나 검사를 생략하지 않았다.

집중33PASS/2FAIL →35PASS, **Node82files847PASS/0skip, Python81/conformance PASS**,
공식 generic plugin·skill/marketplace·helper12/27구문·local resume PASS다.
동일33파일의 양쪽 정상 설치/활성화와11hook 대조를 마쳤다.

## 정상 실행과 실패 원인

`03-claude-simple`은25180ms exit0이지만 FAIL이다. fact verifier가 실제로
정의·두 읽기7·보존되는7을 설명하고 정확한 JSON receipt를 반환했다.
부모는 결과 조회의 receipt_text에 그 영수증이 아니라 Agent 반환 배열의
두 번째 항목인 agentId 안내문을 넣었다. 이 값은 JSON이 아니므로 정상 Pre가 거부했다.
이번에는 include_next_step을 사용하지 않았다.

fact slot은 referenced/verdict:null, final:null이며 Stop/state/attempt는 unavailable,
final_sha256:null이다. 실제 부모 결과 조회·final verifier·승인된 전달은 UNRUN이다.
부모는 실패를 보고한 다음 미검증 직접 설명을 본문에 덧붙였다. read-only box라는
추가 성질도 사용했으므로 올바른 승인된 최종 설명으로 판정하지 않는다.
실제 fact는4문장으로 요청된 최종2–3문장에 맞춘 조정이 필요하지만 그 최종 검토는 없었다.

감사는 실제 original/packet/typed submission/Agent return과 native child를 대조하고,
거부 직전까지 재생한 상태에 Stop의 unavailable 전이만 적용하면 retained attempt와
일치함을 확인했다. 거부된 시도를 실행·재개하거나 원래 profile 상태를 수정하지 않았다.
감사 SHA `ba5cb6ae1578a66af09d426fa004cf778b89bef8dc4c89dcacf178f8004ea4f1`.

## 정산과 다음 수정

새 native4/관리8(원복2)/내부22 배정 중 실제 **native3/관리8(원복2)/내부1**.
완료 **7응답 =부모4+child3**, **163041tokens =160501입력+2540출력**이며
thinking1420은 출력의 부분집합이다. native 원장과 host usage가 일치한다.
후속 `04-codex-simple`은 UNRUN, 배정 미사용1·native12상한 중 처음부터 미배정8이다.
누적 **1085 =Claude641 +Codex444**. 원래192subjects/516requests와 별도다.

소유 process0·양쪽 원래 선택·후보 비활성·자체 ON2파일 원상부재와 현재/frozen33파일
일치를 확인했다. 근거는 `.superpowers/release-loop-182/`의 감사·review·batch-closed와
사용량·복원 기록이다. 다음은 Claude의 정상3필드 참조 조회에 필요 없는 수동 receipt
복사 입력과 Codex wait 안내를 공개 schema에서 분리하는 것이다. 실제 native 영수증과
원문·수정 예산·실패/재시도 거부는 유지한다. 실패 뒤 본문 보류와 client cache·
calibration·복잡/새 사례/반복·실패/취소/재개·네 기능/혼합·192/516은 OPEN이다.
