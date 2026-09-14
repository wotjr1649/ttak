# inline MCP180 — 패키지 검증 통과, 정상 설명의 참조 결합 실패

후보 `0.2.0-rc.13+codex.20260913193620` / `ttak-inline180`, runtime33파일.
**CLOSED/RESTORED, 전체 Go 목표 active / No-Go**다.

## 패키지 변경과 관측

Codex manifest의 `mcpServers`를 공식 inline 객체 형식으로 바꿨다.
기존 command/args/cwd/빈 인증 env 값을 정확히 보존했다. 사용하지 않는
`.codex-plugin/mcp.json`은 현재 bundle에서 제거했지만179 frozen에 남아 복구 가능하다.
hook의 후보 파일 목록에서 그 경로만 빼고, 모든 inline 설정이 들어 있는 manifest
자체의 해시 결합은 유지했다. 나머지 검증 script/recipe/check는179와 byte 동일하다.
비교 freeze와 설치 검토도 새 선언 경로를 사용하며, 실행 필드 변경이나 중복 companion을
거부하는 반례를 추가했다. 전역 validator·설정·인증은 변경하지 않았다.

공식 generic plugin validator가 로컬 복제본·현재 소스·frozen 후보에서 PASS했다.
집중 Node89/Python14, **전체 Node80files837PASS/0skip, Python81/conformance PASS**,
helper12검사/32구문·skill/marketplace·local resume도 PASS다.
실제 두 호스트 설치/활성화와33파일/11hook 대조가 끝났다.
Codex에서 normal MCP의 준비·독립 fact 제출/반환·결과 조회를 실제 관측했다.
이 범위는 inline 설정의 정상 로드 근거이며 전체 설명 완료를 뜻하지 않는다.

## 정상 설명 실패

`03-codex-simple`은89156ms에 exit0으로 끝났지만 설명은 실패했다.
부모는 첫 recipe를 재작성하면서 `store("ttak-verification",...)`를 생략했다.
다음 code-mode 호출은 저장값을 읽지 못해 MCP 호출 전에 실패했다.
그 뒤 부모는 실제 fact를 정확히 복사해 `request:"current"`와 fact 배열을 함께 제출했다.

현재 `usesFinalReferences`는 `facts:"current"`만 참조 분기로 인식한다.
따라서 그 혼합 입력은 legacy 컴파일러에서 문자 `"current"`를 요청으로 사용했다.
원래 요청 SHA는
`f5d6d4a9e27bffb1883300322f698c2d32bfb8484ec50b3031c64409acfed879`,
잘못 컴파일된 요청 SHA는
`97b0560280ed60a5a1eaa1bc45492543c8a986ad5a25b468c427eb83c3e88191`다.
정상 Post의 `registerFinal`이 요청 결합 불일치를 거부했고, 이어진 dispatch Pre도
거부했다. 최종 native verifier는 시작하지 않았다.

Stop은 stopped/unavailable이며 부모는 검증 실패를 보고했다.
저장 state/attempt는 unavailable, final:null, final_sha256:null이고 실패한
check_final의 정확한 pending_tool 영수증을 보존한다. 부모의 client-cache 실패 뒤
재구성은 정상 recipe 준수로 보지 않는다. 실제 final 검증/검토된 전달은 UNRUN이다.
한 fact child만 완료·조회·wait/close했으며 실패를 우회하거나 같은 행을 다시 실행하지 않았다.

## 정산과 다음 작업

이번 별도 배정은 native4/관리8(원복2)/내부22였다.
실제 **native3/관리8(원복2)/내부1**, 완료 응답8(부모6+child2),
**141889 tokens =138247입력+3642출력**, thinking1408은 출력 부분집합이다.
부모 원장119349와 checkpoint가 일치하고 관측된 turn은 모두 종료됐다.
`04-claude-simple` 한 행은 실패 후 UNRUN, native12상한의 다른8회는 처음부터 미배정이다.
179의9UNRUN이나 원래192subjects/516requests 배정을 재사용하지 않았다.

누적 **1078 =Claude637 +Codex441**. 모든 소유 process0, 양쪽 원래 선택 복원,
후보 비활성·자체 ON2파일 원상부재, 현재/frozen33파일 해시 일치를 확인했다.
근거는 `.superpowers/release-loop-180/batch-closed.json`과
`rows/03-codex-simple/failure-audit.json` 및 수집/사용량/원복 기록이다.
감사 SHA `040a3053fe48fbbc4ef5e944da8d21d3439bb231404064e5df260d176b635322`.
감사기 첫 시도는 pending_tool이 없다고 가정해 실패했으며, 원본을 보존하고 실제
실패한 호출의 name/call/input 해시와 일치하는 영수증 보존을 검사한 새 감사기가 통과했다.
실제 통과한 package validator helper는 `validate-inline.cjs`다.

다음은 혼합 current 참조와 부모 code-mode 저장값 의존성을 재현하는 일이다.
이미 원래 요청/실제 fact에 결합된 저장소를 일관되게 사용하되 정상 source/native/실패
경계를 완화하지 않는다.179의 교정 timeout·검토 전 commentary·검사 생략, 복잡/새 사례/
반복·실패/취소/재개·네 기능/혼합·192/516은 계속 OPEN이다. 패키지 PASS는 Go가 아니다.
