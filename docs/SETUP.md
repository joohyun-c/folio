# 로컬 실행과 외부 서비스 설정

## 먼저 화면 열기

Node.js가 있는 컴퓨터에서 저장소 폴더를 열고 아래 순서로 실행합니다. `.env`는 프로그램이 실행될 때 참고하는 설정값을 담는 파일이며, 자동으로 비밀을 보호하는 금고는 아닙니다. Git에서 제외하고 본인 컴퓨터에서 관리합니다.

```powershell
Copy-Item .env.example .env
node --env-file=.env server.cjs
```

브라우저에서 `http://localhost:8768`을 엽니다. `dist/index.html`을 파일로 직접 열지 않습니다. 키가 비어 있으면 편집 예시 책과 일부 화면은 볼 수 있지만, 해당 외부 서비스 검색·AI 추천은 제한됩니다.

## 외부 데이터

| 설정 이름 | 용도 | 없을 때 |
| --- | --- | --- |
| `FOLIO_DATA4LIBRARY_AUTH_KEY` | [도서관 정보나루](https://www.data4library.kr/apiUtilization)의 국내 책 검색 | 국내 검색 공급원 하나를 사용하지 못함 |
| `FOLIO_GOOGLE_BOOKS_API_KEY` | [Google Books API](https://developers.google.com/books/docs/v1/using)의 책 검색 | Google Books 검색을 사용하지 못함 |
| `GEMINI_API_KEY` | [Gemini API](https://ai.google.dev/gemini-api/docs/api-key)의 한국어 추천 이유 | AI 추천 이유를 사용하지 못함 |
| `PORT` | 로컬 서버 주소의 포트 번호 | 코드 기본값으로 실행 |

API 키는 외부 서비스를 이용할 때 제시하는 비밀 인증값입니다. 실제 값은 `.env`에만 두고 채팅·README·GitHub에 올리지 않습니다. `.env.example`은 비어 있는 설정 양식입니다. 이전 카카오 연동용 칸도 남아 있지만 현재 화면에서는 사용하지 않습니다.

## Google 로그인

Google 로그인은 위의 도서 API 키와 별개입니다. `dist/auth-config.js`에는 연결에 필요한 공개 프로젝트 주소와 공개용 키가 있으며, 실제 사용에는 해당 Supabase 프로젝트의 Google 로그인 제공자·복귀 주소·접근 제한 설정이 필요합니다. 현재 구성은 folio 전용 프로젝트에서 한 계정의 로그인과 책장 불러오기를 확인한 상태입니다. 다른 사람이 저장소를 복제해 **자기 계정 데이터로 운영**하려면 별도의 [Supabase 프로젝트와 Google OAuth 설정](https://supabase.com/docs/guides/auth/social-login/auth-google)을 만들고 연결값을 교체해야 합니다. 비밀 Client Secret과 관리자 키를 `dist/`에 넣지 않습니다.

## 시험 실행

```powershell
node --test server.test.cjs lib/*.test.cjs
```

서버의 도서 검색·키 누락·AI 근거 확인 등의 시험을 실행합니다. 시험 통과와 실제 사용자의 만족도는 다른 문제이므로 [검증 기록](VALIDATION.md)을 함께 확인합니다.
