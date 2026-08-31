# Darkest Dungeon MCP

다키스트 던전 1 세이브를 읽기 전용으로 조회하는 TypeScript MCP 서버입니다.

## 실행

Node.js 20 이상과 Java가 필요합니다. 기본 실행은 저장소의 디코딩된 샘플을
사용합니다.

```powershell
npm install
npm run mcp
```

실제 세이브를 읽으려면 MCP 클라이언트의 서버 환경 변수에 프로필 경로를
설정합니다.

```text
DD_SAVE_DIR=C:\...\262060\remote\profile_0
```

`DDSaveEditor.jar`는 기본적으로 `tools/DDSaveEditor.jar`에서 찾으며 Git에는
포함되지 않습니다. 다른 위치에 두었다면 `DD_SAVE_EDITOR_JAR`를 설정합니다.
Java가 PATH 또는 `JAVA_HOME`으로 검색되지 않는 환경에서는
`DD_JAVA_EXECUTABLE`에 실행 파일을 지정할 수 있습니다.

서버는 원본 세이브 네 개를 임시 디렉터리로 복사한 뒤 디코딩하며 원본을
수정하지 않습니다.

## MCP 도구

- `get_game_state`: 로스터, 영지 자원, 마을, 퀘스트 요약
- `list_heroes`: 클래스, 로스터 상태, 최대 스트레스 기준 영웅 조회
- `get_hero`: 영웅 상세 정보와 마을 활동 정보 조회
- `list_quests`, `get_quest`: 조건별 퀘스트 목록과 상세 정보 조회
- `list_trinkets`, `get_trinket`: 보관함, 장착 영웅, 상점에 걸친 장신구 조회

## 검증

```powershell
npm run typecheck
npm test
```
