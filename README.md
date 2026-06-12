# 세금영수증 (tax-receipt) — 부동산 세금 계산기 2026

서버 0, 순수 클라이언트 사이드 세금 계산기 모음 + 정보 글. 브랜드: **세금영수증**. 레트로 영수증 테마.
Cloudflare Pages에 **무료**로 그대로 배포된다. 배포 주소: **tax-receipt.kr**.

수록 페이지:
- **홈(허브)** (`index.html`) — 계산기 카드 + "부동산세금계산기" 키워드 + 내부링크 허브
- **취득세** (`chwideuk.html`) — 생애최초 감면·다주택 중과·농특세
- **양도소득세** (`yangdo.html`) — 1세대1주택 비과세·고가주택 안분·장기보유특별공제·다주택 중과
- **재산세** (`jaesan.html`) — 1주택 특례세율·공정시장가액비율·도시지역분·7월/9월 분납
- **세금꿀팁** (`tips.html` + `tips/*.html`) — 정보 글 5편 (1키워드=1페이지, 애드센스 승인용 콘텐츠)

## 폴더 구조
```
tax-calculator/
├─ index.html             # 허브 홈 (계산기 카드 + 내부링크)
├─ chwideuk.html          # 취득세 계산기 + 해설
├─ yangdo.html            # 양도소득세 계산기 + 해설
├─ jaesan.html            # 재산세 계산기 + 해설
├─ tips.html              # 세금꿀팁 글 목록(인덱스)
├─ tips/
│  ├─ first-home-docs.html    # 생애최초 취득세 감면 조건·서류
│  ├─ dajutaek-timing.html    # 다주택 양도세 중과 매도 체크포인트
│  ├─ ilsijeok-2jutaek.html   # 일시적 2주택 요건 (양도세+취득세)
│  ├─ jaesan-savings.html     # 재산세 6월 1일 잔금 규칙·납부 팁
│  └─ stress-dsr.html         # 스트레스 DSR 3단계 정리
├─ tests.html             # 취득세 골든테스트 (noindex) — 36 PASS
├─ tests-yangdo.html      # 양도세 골든테스트 (noindex) — 37 PASS (국세청 공식사례 포함)
├─ tests-jaesan.html      # 재산세 골든테스트 (noindex) — 40 PASS
├─ sitemap.xml / robots.txt
├─ assets/style.css       # 공통 영수증 테마 (.calc-nav 탭, 글 페이지, 허브 카드)
└─ js/
   ├─ rules-2026.js          # 취득세 세율·감면 데이터 (연도별 분리)
   ├─ acquisition-tax.js     # 취득세 순수 엔진
   ├─ app.js                 # 취득세 UI + localStorage
   ├─ rules-yangdo-2026.js   # 양도세 세율·공제 데이터
   ├─ yangdo-tax.js          # 양도세 순수 엔진
   ├─ app-yangdo.js          # 양도세 UI + localStorage
   ├─ rules-jaesan-2026.js   # 재산세 세율·비율 데이터
   ├─ jaesan-tax.js          # 재산세 순수 엔진
   └─ app-jaesan.js          # 재산세 UI + localStorage
```

## 검증 상태
- **취득세** (2026-06-09): 위택스 미리계산 대조 + 생애최초 감면 지특법 제36조의3 원문 대조 완료. `tests.html` **36 PASS**.
- **양도세** (2026-06-09): 국세청 세율표·세액계산요령 공식사례 대조 완료(고가주택 안분+장특공제 표2 일치). `tests-yangdo.html` **37 PASS**.
- **재산세** (2026-06-11): 지방세법 제111조·제111조의2 세율표(행안부·구청 안내) 대조, 공정시장가액비율 2026년 유지 확인. `tests-jaesan.html` **40 PASS**. 과세표준상한제·지역자원시설세는 v1 미반영(화면 명시).
- canonical/og URL = `tax-receipt.kr`로 설정 완료. 취득세는 `/chwideuk.html`로 이동(배포 전이라 SEO 비용 0).
- ⚠️ 데이터는 연 1회(연초) 세율 개정 반영 필요. 조정대상지역 목록도 국토부 공고로 주기적 갱신.

## 로컬에서 보기
브라우저 보안상 `file://`로 열면 일부 동작이 제한된다. 정적 서버로 띄울 것.
```
python -m http.server 8787      # 또는  npx serve .
```
→ `http://localhost:8787/`, `/chwideuk.html`, `/yangdo.html`, `/jaesan.html`, `/tips.html`.
테스트는 `/tests.html`, `/tests-yangdo.html`, `/tests-jaesan.html`.

## Cloudflare Pages 배포 (무료)

### 방법 A — 대시보드 직접 업로드 (가장 빠름, git 불필요)
1. [dash.cloudflare.com](https://dash.cloudflare.com) 로그인 → 좌측 **Workers & Pages**.
2. **Create application → Pages → Upload assets**.
3. 프로젝트 이름 `tax-receipt` 입력 → `tax-calculator` 폴더의 *내용물*을 드래그&드롭(폴더째 X, `index.html`이 최상단에 오도록).
4. **Deploy** → `*.pages.dev` 주소 발급. 수정 후 재배포는 같은 화면에서 다시 업로드.
5. 커스텀 도메인: 프로젝트 → **Custom domains**에 `tax-receipt.kr` 연결(가비아 구매, 네임서버 = Cloudflare).

### 방법 B — GitHub 연동 (자동 배포, 권장)
1. 이 폴더를 GitHub 저장소로 push.
2. Cloudflare Pages → **Connect to Git** → 저장소 선택.
3. 빌드 설정: **Framework preset = None**, **Build command = (비움)**, **Output directory = `/`**(이 폴더가 저장소 루트인 경우).
4. Save and Deploy → 이후 git push마다 자동 재배포.

## 배포 직후 할 일
1. 네이버 서치어드바이저(searchadvisor.naver.com)·구글 서치콘솔 등록 + `sitemap.xml` 제출.
2. 애드센스 신청 (콘텐츠 5편 + 계산기 3개 상태).
3. 커뮤니티 홍보 (메모리의 채널 등급·maker 톤 원칙 따라).

## 다음 단계 (기획서 기준)
- 다음 계산기: **증여세**(검색량 18,300·경쟁 최저) → 상속세 (시장조사 메모리 참고)
- 단계 6: 연도별 데이터(`rules-2027.js`) 추가 시 기준연도 선택 기능
- 구조화 데이터(FAQ schema) 추가 검토
