# 최종 검토 대상 배치167: fact의 잘못된 장애 분류

후보 `0.2.0-rc.13+codex.20260913121102` / `ttak-target167`은 CLOSED/RESTORED다.
Go가 아니며 전체 개발 목표는 active다. 원래 H/Q·192 subjects/516 requests는 그대로다.

## 변경과 로컬 근거

normal final packet의 JSON 값·필드·schema·지시·한도를 보존하면서 submission을 앞에,
원문과 모든 근거 다음 마지막 data field에 정확한 final_text를 배치했다. challenge는
동일 canonical data, prompt SHA는 실제 새 bytes를 검증한다. fact·assessment·notice는
기존 canonical 배치다. 모델 내부 원인을 입증한 변경이 아니라 판별할 가설이다.

배치 검사 RED2PASS/2FAIL →4PASS, 집중215PASS, Node70파일/749PASS/0skip,
Python79 및 conformance PASS. helper9검사/24syntax, skill·marketplace·local resume PASS.
runtime34파일 고정·정상 설치·11hook의 정확한 파일/명령/해시 검토·양쪽 활성화 PASS.
generic plugin validator는 기존 host MCP 경로 비호환 때문에 UNRUN이며 과거 FAIL은 보존한다.

## 실제 실패

공개 가상 Nori calibration은 두 번 읽기와 저장값7을 설명하되, 제공된 오류안을
수정 없이 최초 final 검토에 넣고 실제 독립 판정 후에만 허용된 교정을 하도록 한다.
이는 원래 출하 비교를 대체하지 않는 별도 진단이다. prompt SHA는
`618695971de468dd23657abc411dc9d2bf5e4c24439878a1aba50b419d700426`이다.

Haiku의 실제 독립 fact는 **7,7,7**을 정확히 도출했다. 그러나 오류가 있는 인용 초안과
정의의 차이를 `verdict: conflict`로 제출하고, 명시된 “읽기는 값을 바꾸지 않는다”가
두 읽기에 적용되는지 다시 확인하라고 했다. 사실 확정에 필요한 입력은 이미 있다.
이것은 해결된 정정을 미해결 사실로 취급한 실패다. issue quote도 원문 `to0`/`remains0`에
없는 공백을 추가했으며 정확한 인용으로 인정하지 않는다.

부모는 해당 결과를 실제로 조회하고 제공된 오류안을 변경 없이 final 도구에 넣었다.
normal Pre hook은 answered가 아닌 fact를 올바르게 거부했다. **최종 packet 발급·
독립 final 검증자는 없다.** 따라서 새 final 배치의 native 효능과 calibration의
final 거절·교정은 모두 UNRUN이다. 이를 최종 검토의 거절 PASS로 계산하지 않는다.
부모는 완료 대신 사용자에게 맞는 초안을 다시 달라고 했다. CLI success/exit0이어도
권한 거부1, retained unavailable, 논리 Stop1의 `continue:false`는 완료가 아니다.

frozen compiler로 실제 준비·child packet·제출·native receipt·결과 조회를 재생하고
retained attempt와 대조했다. 감사 SHA:
`d123f7ffa8b5120fa7a5783daf674d0f8c331a3632dc5e05e499a71bf07a4d60`.

## 실행 장부와 다음 조사

새 배정 native12/관리8(원복2)/내부 최대88, 실제 native3/관리8(원복2)/내부1이다.
후속9 UNRUN. 동시성1,120초+cleanup5초·관리20초를 유지했다.
Haiku 행42206ms/exit0, 모든 Job cleanup 확인·active process0이다.
부모5+child3=완료 응답8, input189117/output3676=**192793 tokens**이며
thinking2044는 output의 부분집합이다. native terminal 합계와 일치하며 in-flight 불확실성은 없다.
누적 **1038(Claude622/Codex416)**. 두 프로필의 기존 선택을 정상 복원하고 후보는
비활성화했다. 배치 소유 ON 파일2만 이전 부재 상태로 돌리고 기록·cache는 보존했다.
세션 중간 OFF 제거 시험과 native interrupt/cancel 시험은 수행하지 않았다.

다음 조사 대상은 fact schema와 packet이 말하는 판정의 의미다. 현재 answered guard는
유지하며, 확정 가능한 인용 오류의 정정과 실제 필요한 전제/관측의 부재를 구별해야 한다.
배치167의 final 배치 수정은 아직 native 효과를 주장할 수 없다. 원래 복합 양 host,
정상·보류·재개·취소와 원래192/516을 포함한 필수 Go 조건도 미완료다.
