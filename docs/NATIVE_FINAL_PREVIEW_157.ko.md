# 비승인용 최종 검토 형식 preview 157 — 종료·복원

기존 Go 목표는 **active / No-Go**다.156의 형식 거부와 별도 의미 오류를 근거로,
같은 요약 축소 문구 반복 대신 실제 제출 전 UTF-8 길이 측정 경계를 추가했다.
후보는 `0.2.0-rc.13+codex.20260913062012`, 새 시험 namespace는 `ttak-preview157`이다.

## 변경과 한계

`explanation_final_preview`는 challenge와 세 검토 요약만 받는다. 각 초안의 입력
상한은2000 UTF-8 bytes이며, 응답은 실제 길이·기존400 초과 필드·입력 해시와
명시적 `complete_authorized:false`다. verdict·result·receipt·issues·최종 본문을
받거나 만들지 않는다. 이 결과는 의미 판단도, 최종 제출도, 승인 근거도 아니다.

fresh final 자식의 실제 packet 수신 후, 아직 실제 제출하지 않은 시점에 최대1회
사용할 수 있다. 상태에는 call/input SHA와 정확한 Post 관측 여부만 저장한다.
preview를 썼다면 그 응답의 정확한 관측 없이는 실제 제출할 수 없다. 부모·다른 자식·
fact/notice/assessment·중복·누락/변조 Post·거부된 실제 제출 뒤 호출은 허용되지 않는다.
크기 초과는 preview의 정상 형식 피드백이지 거부된 실제 제출을 수용하는 경로가 아니다.

기존 실제 `explanation_final_result`의400-byte 상한, 상세 issue·원래 질문·native
Pre/Post·짧은 반환·실제 결과 조회·최종 본문·Stop 경계는 그대로다. 유효한 기존 직접
제출은 기존 검사를 계속 통과한다. Claude maxTurns4와 native120초도 바꾸지 않았다.
OFF로 이미 주입한 문맥을 제거하는 기능이나 시험은 추가하지 않았다.

156의 잘못된 셀 수4(실제2), 근거 없는 처리량 비례 관계와 무영향 주장, 이를 놓친
승인은 별도 필수 의미 회귀다. preview가 이를 고쳤다고 주장하지 않는다. 원래 복잡
과제와 H/Q, 같은 후보의 정상·known·unseen·변형·반복·보류/실패/취소/재개 및
원래192 subjects/516 requests 출하 비교는 각각 실제 근거가 필요하다.

## 로컬 검증·고정

새 검사12개가 추가됐다. 핵심7 RED→7 PASS, hook 연결4 RED→집중274 PASS,
추가 계약 검사 포함 최종 **Node60파일/680 PASS/0skip, Python79, conformance PASS**.
400/401·다중바이트·2000 입력 상한·secret/Unicode/객체·잘못된 actor·중복·누락/변조
응답·실제 제출 전후·preview-only 반환을 검사했다. 정상 MCP+hook과 최종 Stop 대조도
로컬 통과했다. 합성 수명주기 보존·재개 검사는 local-only다.

33 runtime 파일 중8개 변경, 파일 추가는 없다. 별도 helper9검사/23 syntax PASS,
skill YAML·marketplace 이름 검증 PASS. 범용 plugin helper의 per-host MCP 경로
비호환은 기존 FAIL/현재 UNRUN으로 보존했다. 검사를 완화해 PASS로 바꾸지 않았다.

기존 `personal`이 실제 두 시험 프로필에 설치·비활성 상태임을 재확인했다.
Codex 정상 `plugin list`와 Claude 등록 경로가 불변156을 가리킨다. helper의 기본 UTC
cachebuster와 새 task-local scaffold로 기존 후보를 덮어쓰지 않았다. 글로벌 설정·
인증·모델·결제 변경은0이다. 새 후보의 정상 등록·설치, 정확한33파일/11hook 검토·
신뢰 설정, 두 호스트 정상 활성화가 통과했다. 아래 실제 대조와 실패를 남긴 뒤 복원했다.

## 정상 실제 대조

Haiku Nori는59196ms, 독립Agent2개·모델응답14·283138 tokens로 통과했다.
preview419/406/336 bytes에서 초과한 두 요약을 관측했고, 실제 제출은341/257/336
bytes로 기존 상한을 통과했다. fact·최종3문장·검토 이유는 정의와 정확히 일치한다.
영수증·실제 결과 조회·전체 상태 재생·Stop1회가 일치한다.
감사 SHA `a2e613686b179c905e171b3853e9b9da697164b6eb2e5a08243f5d5412d6f8ae`.

Luna/high Nori는102323ms, 독립Agent2개·모델응답12·223114 tokens로 통과했다.
preview146/175/173 bytes, 실제 제출도 같은 길이였고 사실·최종2문장·검토 이유에
이 대조의 중대한 오류는 없다. 정상 native 영수증·실제 결과 조회·전체 상태 재생·
Stop1회가 일치한다. 두 대조 모두 preview는1회이며 최종 수정 verifier는0개다.
감사 SHA `de792c65928d47e1674d4e2a4dc7baa83c7012e2c777ed30dd654d5580592ad8`.
두 통과를 원래 복잡 과제나 전체 H/Q로 확대하지 않는다.

## 원래 Haiku 과제 실패

110649ms에 프로세스는 정상 종료했으나 final 검증자는 첫 preview767/745/632 bytes
뒤 두 번째 preview를 호출했다. 정상 guard는 중복을 거부했고, 실제 제출545/467/430
bytes도 거부됐다. 실제 제출 receipt가 없고 native Agent는4-turn 한도에서 미완료로
끝났다. 첫 preview까지의 실제 상태 전이 재생과 retained metadata가 일치한다.
정상 Stop은 continue:false / unverified다. 호스트 프로세스 success나 hook_success
attachment 이름을 설명 성공으로 세지 않았다.

부모는 native Agent의 SendMessage 안내를 따라 이미 비활성인 도구를 시도했고,
실패 뒤 결과 조회도 시도했다. 모두 거부됐다. 마지막에는 설명이 미검증이라고 말하면서도
설명 자체의 오류가 아니라는 확인되지 않은 단정과, 새 검증 시도 또는 미검증 설명을
수용할지 묻는 선택을 제안했다. 이는 원래 요구와 실패 처리의 통과가 아니다.

의미 결함도 별도로 확인됐다. fact와 제안 final 모두 T1이A만false로 바꾼 뒤 T2가
B=false를 읽는다고 서술한다. 주어진 상태 전이에서 B는 여전히true이고 T2의 guard는
A에 있다. final은 처리량 비용이 lock duration과 contention frequency에 비례한다는
근거 없는 관계 및 조건만으로 정하지 못하는 비용·처리량 순위를 제시했다. 검증자의
거부된 approve_explanation은 잘못된B값과 비용 설명을 그대로 승인하려 했다.
부분 검사 결과는 final92/fact66 구간 모두 unchecked이고 assessed_spans는0이다.
이는 검사가 의미를 확인했다는 근거가 아니라 현재 지원 범위의 공백이다.

실패 감사 SHA `25bb5268657888dbbb7c235a7c2cc38b375a3f1ac634e94eded757449b7e818d`.
실제 Agent2·완료 모델응답15·411667 tokens이며 native aggregate usage와 대조했다.

## 새 배정

native10/상한12: 양쪽 활성화·Nori 정상·원래 복잡 과제·미측정 보류·같은 세션 상태
재개. 관리8/상한12: 읽기 전용 설치 확인1·정상 준비5·복원예약2. 내부검증상한66,
동시성1·자동재시도0·native120초+cleanup5초·관리20초+5초·supervisor20초 유지.
종전 누적999(Claude597/Codex402),156의 미사용7·후속5 UNRUN은 새 배정과 별개다.
원래192/516 비교도 별도 장부이며 진단으로 전용하지 않는다. 첫 실질 실패 뒤
후속 행은 UNRUN으로 닫고 실제 사용량·소유 process0·두 프로필 복원을 정산한다.

최종 판정 **FAIL_DUPLICATE_PREVIEW_AND_SEMANTICS / CLOSED / RESTORED**.
native5/10배정/상한12, 후속5 UNRUN·상한미사용7. 관리8/8(복원2 사용), 내부Agent6,
완료응답41, **917919 tokens** = input898344 + output19575(thinking7541은 부분집합).
관측 사용량 누락 가능false, 새 누적 **1004(Claude600 / Codex404)**다.
모든 소유Job 정리·process0, 양쪽 선택과 자체ON파일2개의 원래 부재를 복원했다.
캐시·등록·신뢰metadata·실패 근거는 보존했다. 세션 중간OFF 제거 시험은 하지 않았다.

다음은 문구만으로 요약 축소를 반복하지 않고, 실제 원문과 계산을 받았어도 잘못된 상태
관계와 근거 없는 정량 관계를 생성·승인하는 의미 검사 공백을 조사한다. preview1회·
엄격한 실제 제출·시간 상한은 유지한다. 실패 뒤 부모의 추가 호출·요구 완화 제안도
별도 미해결 회귀다. 개별 배치 실패는 전체 active Go 목표의 종료가 아니다.

근거: `.superpowers/release-loop-157/`의 `DESIGN.ko.md`, `allocation.json`,
`source-delta.json`, `manifest-final.json`, `native-plan-final.json`,
`full-qualified-final/`, `helper-qualified.json`, `management/`, `rows/`.
