# current 원문181 — Luna 정상 통과, Haiku 결과 조회 실패

후보 `0.2.0-rc.13+codex.20260913203706` / `ttak-alias181`, runtime33파일.
**CLOSED/RESTORED, 전체 Go 목표 active / No-Go**다.

정상 Codex Pre가 current 요청+explicit fact 배열을 실제 native 원문으로 해석하고,
explicit final의 request/fact/revision 결합을 호출 전에 검사한다. Post 재검사와
direct legacy·양쪽 current 참조 라이브러리 계약은 그대로다. 바뀐 runtime은
manifest 두 버전과 hook 두 분기뿐이며181에서는 파일 추가/삭제가 없다.
hook SHA는 `3afb8936f40e0afb103d80a923af5dbfe5d379293563492d4654b495a3a1fa6d`다.

집중35PASS/3FAIL에서38PASS, delivery 통합49PASS.
첫 전체842PASS/1FAIL은 explicit 변조를 Post에서 거부할 것으로 기대한 검사다.
거부 시점을 Pre로 바꾸고 final/pending 영수증 부재도 검사했다. 원래 실패는 보존했다.
새 전체 **Node81files843PASS/0skip, Python81/conformance PASS**,
공식 generic plugin·skill/marketplace·helper12/30구문·local resume PASS다.

## 실제 정상 실행

양쪽 정상 설치·33파일/11hook 대조·활성화 후 원래 simple 입력을 사용했다.
Codex는82602ms에 실제 독립 fact/final, 모든 결과 조회, 정확한2문장 전달과 Stop을
통과했다. 정의·초기7·두 읽기7·최종7을 보존하며 금지한 부가 보장은 없다.
기계 감사와 별도 본문 판정이 모두 PASS다. 이번에는 store/load가 존재했고
양쪽 current 참조를 사용했으므로180의 client-cache 손실이나 새 혼합 입력 분기의
native 재현을 해결한 근거로 옮기지 않는다.
감사 SHA `2ad8be38b9a959702def4676f928accc1d6138ca0b1145de93e429d7fae036cc`.

Claude는49431ms에 exit0이지만 FAIL이다. 독립 fact는 정확한3문장을 만들었고,
fresh final verifier는 실제 원문/fact/final을 보고 모든 검사 pass로 승인했다.
그러나 부모가 마지막 explanation_result에 `include_next_step:true`를 넣고
receipt_text는 생략했다. 이 옵션은 Codex 전용인데 Claude tools/list에도 노출된다.
정상 Pre의 옵션/영수증 검사가 거부했으며 final native 결과의 부모 조회는 UNRUN이다.
최종 slot은 referenced/verdict:null, final_sha256:null이며 Stop/state/attempt는
unavailable를 유지했다. 부모는 실패를 알리면서 미검증 완성 설명도 덧붙였다.
따라서 모델의 final 승인과 CLI 성공을 정상 전달·보류 품질의 통과로 세지 않는다.
감사 SHA `29b3aae867ffa26acbd5449024624ec2981000b96f8284e079712d0e6df628e0`.

## 정산과 다음 수정

새 배정 native4/관리8(원복2)/내부22, 실제 **native4/관리8(원복2)/내부4**다.
Codex 완료 응답9/150647tokens, Claude13/309036tokens,
합계 **22응답/459683tokens =451611입력+8072출력**이다.
thinking3612는 출력의 부분집합이며 실제 과금액으로 환산하지 않는다.
관측 응답 원장과 host usage가 일치하고 in-flight 미완료 응답 근거는 없다.
배정4행 모두 실행, 미사용 배정0·native12상한 중 처음부터 미배정8이다.
누적 **1082 =Claude639 +Codex443**. 원래192subjects/516requests와 별도다.

소유 process0·양쪽 원래 선택·후보 비활성·자체 ON2파일 원상부재를 확인했다.
근거는 `.superpowers/release-loop-181/`의 각 감사·review·batch-closed·원복 기록이다.
다음은 Codex 전용 결과 조회 옵션을 Claude의 공개 schema에서 분리하는 것이다.
실행/receipt/호스트/재시도 거부는 유지하고 실패한181을 재개하지 않는다.
실패 뒤 본문 보류, Codex client-cache, 교정 calibration·복잡/새 사례/반복·
실패/취소/재개·네 기능/혼합·원래192/516은 계속 OPEN이다.
