# Fallen House — 테스트 서버 (GitHub + Vercel + Supabase)

기존 계정 그대로, **새 프로젝트만 하나씩 추가**합니다. 기존 저장소·프로젝트·테이블은 건드리지 않아요.

## 0. 폴더 구성

| 파일 | 하는 일 |
|---|---|
| `index.html` | 게임 본체 |
| `config.js` | Supabase 주소와 공개 키 (여기만 직접 고침) |
| `claude-shim.js` | 게임의 저장·채팅·동행 기능을 Supabase로 연결 |
| `supabase.sql` | Supabase에 붙여 넣을 테이블 설정 |
| `sfx/` | 효과음 |

## 1. Supabase — 새 프로젝트 추가

1. supabase.com 로그인 → 대시보드 왼쪽 위 조직 이름 → **New project**
   - 이미 이 게임용으로 만든 프로젝트(`bnpjtujnyulbkbbqgmka`)가 있으면 그걸 쓰면 돼요. 그럼 이 단계는 건너뛰세요.
   - 무료 요금제는 동시에 켜 둘 수 있는 프로젝트가 2개예요. 꽉 찼으면 기존 프로젝트에 넣어도 됩니다 (모든 테이블이 `fh_`로 시작해서 섞이지 않아요).
2. 프로젝트 안에서 왼쪽 **SQL Editor → New query** → `supabase.sql` 내용을 통째로 붙여 넣고 **Run**
   - 맨 아래 주석 처리된 `insert into public.fh_admins ...` 줄은 아직 실행하지 마세요 (5번에서 씀).
3. 왼쪽 **Authentication → Sign In / Providers → Allow anonymous sign-ins** 켜기
4. **Project Settings → API Keys**에서 `anon` `public` 키(또는 Publishable key)를 복사
   - **service_role / secret 키는 절대 쓰지 마세요.**

## 2. config.js 채우기

```js
window.FH_CONFIG = {
  SUPABASE_URL: 'https://프로젝트ID.supabase.co',
  SUPABASE_ANON_KEY: '복사한 anon 키'
};
```

## 3. GitHub — 새 저장소 추가

1. github.com 오른쪽 위 **+ → New repository**
2. 이름 예: `fallen-house` · Private 추천 · 나머지는 그대로 두고 **Create repository**
3. 새 저장소 화면의 **uploading an existing file** → 이 폴더 안의 파일과 `sfx` 폴더를 전부 끌어다 놓기 → **Commit changes**

## 4. Vercel — 새 프로젝트 추가

1. vercel.com → **Add New… → Project**
2. GitHub 저장소 목록에서 `fallen-house` 옆 **Import**
   - 목록에 안 보이면 **Adjust GitHub App Permissions**에서 이 저장소 접근을 허용하세요.
3. Framework Preset: **Other** · Build Command·Output Directory는 비워 두기 → **Deploy**
4. 끝나면 나오는 `https://fallen-house-xxxx.vercel.app` 주소가 테스트 서버예요.

## 5. 관리자(이벤트 편집기) 등록

1. 배포된 주소로 게임에 들어가서 캐릭터를 만든 뒤 **설정 → 맨 아래 '내 계정 ID' → 복사**
2. Supabase **SQL Editor**에서 아래 한 줄을 실행 (따옴표 안에 복사한 ID):
   ```sql
   insert into public.fh_admins (uid) values ('복사한-ID') on conflict do nothing;
   ```
3. 게임을 새로고침하면 설정 맨 위에 **이벤트 편집기 (관리자)**가 생겨요. 이 버튼과 저장 권한은 등록된 계정에만 있어요 (서버에서도 막혀 있음).

## 업데이트할 때

GitHub 저장소에서 `index.html`(바뀐 파일만)을 **Add file → Upload files**로 다시 올리면 Vercel이 자동으로 다시 배포해요.

- 플레이어 저장(레벨·아이템·대원)과 관리자가 만든 이벤트는 **Supabase에 있어서 업데이트해도 그대로**예요.
- 같은 브라우저에서 접속하는 한 같은 생존자로 이어져요. 브라우저 데이터를 지우거나 다른 기기·시크릿 창으로 들어오면 새 생존자로 시작해요 (지금은 회원가입 없이 익명 계정을 쓰기 때문).
- `supabase.sql`이 바뀐 경우에만 SQL Editor에서 다시 Run 하세요. 여러 번 실행해도 안전해요.
