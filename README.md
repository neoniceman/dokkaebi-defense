# 도깨비 수문장 — 무한 디펜스

한국 전통 도깨비 테마의 무한 타워디펜스. 순수 HTML/CSS/JS(Canvas 2D)로 외부 라이브러리·이미지·사운드 파일 없이 동작합니다. (사운드는 Web Audio API로 실시간 합성)

## 구조

```
index.html        진입점 (게임 화면)
css/style.css     게임 UI 스타일
js/game.js        게임 로직 전체 (IIFE)
pages/
  maps.html       맵 일람
  monsters.html   몬스터 도감
  towers.html     수문장 도감
```

> 원본 단일파일 백업은 배포 트리 밖 `../도깨비디펜스-원본백업/` 에 보관됨.

도감 3종은 게임 안에서 iframe(`pages/*.html`)으로 열립니다.

## 실행 / 배포

정적 파일만으로 동작합니다. 로컬 확인:

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

배포는 정적 호스팅 어디든 그대로 업로드하면 됩니다 (GitHub Pages, Netlify, Vercel, S3 등).
루트의 `index.html`이 진입점입니다. 폴더 전체를 그대로 올리면 됩니다.

> ⚠️ 도감(maps/monsters/towers)은 iframe으로 불러오므로 **반드시 http(s)로 서빙**해야 합니다.
> `index.html`을 파일로 직접 더블클릭(`file://`)하면 브라우저 보안 정책상 도감이 안 열립니다.

## 저장 데이터 (localStorage)

- `dokkaebi_best` — 최고 물결 기록
- `dokkaebi_meta` — 사당 영구 업그레이드 / 도깨비 동전
- `dokkaebi_sfx` — 소리 on/off
