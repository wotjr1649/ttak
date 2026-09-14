# Claude3필드 조회183 — Haiku 정상 통과, Luna 전달 실패

후보 `0.2.0-rc.13+codex.20260913211542` / `ttak-receipt183`, runtime33파일.
**CLOSED/RESTORED, 전체 Go 목표 active / No-Go**다.

Claude의 공개 결과 조회 schema를 기존 native_dispatch의3필드에 맞췄다.
수동 receipt_text 복사 옵션과 Codex wait 안내 한 문장만 Claude에서 제외했다.
정확한 legacy receipt 입력은 내부 계약대로 검사한다. Codex15개 metadata와
나머지14개 Claude 도구, 모든 hook/실행/source/receipt/실패/재시도 검사와 native
recipe는182와 같다. writing-for-agents에 따라 분기별 안내를 분리했다.

집중35PASS/1FAIL →36PASS, **Node82files848PASS/0skip, Python81/conformance PASS**,
공식 generic plugin·skill/marketplace·helper12/28구문·local resume PASS다.
새 후보의 정상 양쪽 설치/활성화와33파일/11hook 해시 대조를 마쳤다.

## 실제 결과

Claude simple은61802ms에3필드 결과 조회를2회 사용했고, 실제 fact/final·원문/영수증
결합·정확한2문장 전달·Stop을 통과했다. 본문도 정의·두 읽기7·보존되는7을 충족한다.
관측된 정상 흐름 한 건이며 실패 시 보류나 반복 안정성까지 입증한 것은 아니다.
감사 SHA `1299a415ed9a4d50b28de71c9b0ac201d9a6e5926ad1006152c0ec066a05be33`.

Codex simple은78530ms에 exit0이지만 FAIL이다. 두 fresh native verifier와 결과 조회,
승인된 delivery payload까지 실제 관측했다. 승인된 설명은 첫 구절
`Assuming the fictional definition given,`을 포함했다. 부모는 이 구절을 지우고
이어지는 a를 A로 바꾼 본문을 냈다. 첫 Stop 뒤에도 같은 변경 본문을 반복했다.
승인 SHA는 `38e88bbaa242db62d147ffe0e5a899ef1c9db88b2e192605bb89ce2ce3f0ef85`다.

첫 Stop은 check_final의 final_text 입력을 복사하라는 예전 안내를 냈지만,
실제 입력은 `{"fact_answers":"current"}` 참조 객체였다. 이미 조회한
explanation_result.delivery.final_text가 승인된 원문이다. 정확한 본문 비교는
변경된 전달을 올바르게 거부했다.1회 교정을 소진해 blocked→stopped/unavailable,
저장 상태는 승인 SHA와 FINAL0 returned/complete를 보존하며 attempt는 unavailable다.

부모는 진입 recipe의 store와 여러 검사를 생략하고 다음 호출에서 client storage를
수동 재구성했다. 마지막 코드는 실제 MCP read 전체를 출력했지만 final-delivery
비교를 생략했다. 따라서 전달 본문이 없어서 생긴 문제는 아니다.
실제 독립 검증/조회부터 두 Stop 전이까지 새 로컬 fixture로 재생하면 retained attempt와
일치한다. 정상 profile을 재실행하거나 수정하지 않았다.
감사 SHA `32554317659554409570de86c26384a11e6dc663ed99fa96d3d8459808eda197`.
첫 감사의 부모 도구 수8 기대는 오류였으며, 부모6개+child2개로 구분한 별도 감사기가
통과했다. 원래 실패와 수정 근거는 보존했다.

## 정산과 다음 수정

새 배정 native4/관리8(원복2)/내부22, 실제 **native4/관리8(원복2)/내부4**다.
Claude13응답/309253tokens, Codex9응답/138734tokens,
합계 **22응답/447987tokens =440327입력+7660출력**, thinking3630은 출력 부분집합이다.
native 원장과 host usage가 일치하며 관측된 미완료 응답은 없다.
배정 미사용0·처음부터 미배정8, 누적 **1089 =Claude643 +Codex446**다.

소유 process0·양쪽 원래 선택·후보 비활성·자체 ON2파일 원상부재와 현재/frozen33파일
일치를 확인했다. 근거는 `.superpowers/release-loop-183/`의 감사·review·batch-closed 및
복원/사용량 기록이다. 다음은 완료된 설명의 Stop 안내 출처를 실제 승인된
explanation_result.delivery.final_text로 바로잡는 것이다. 정확한 비교·1회 교정 한도는
유지하며183을 재개하지 않는다. 실패 뒤 본문 보류·recipe/cache·calibration·복잡/새 사례/
반복·실패/취소/재개·네 기능/혼합·원래192subjects/516requests는 계속 OPEN이다.
