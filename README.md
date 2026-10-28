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
3. 왼쪽 **Authentication → Sign In / Providers**
   - **Email** 켜기 (기본으로 켜져 있어요)
   - **Confirm email**은 테스트 동안 **끄기** 추천 (켜 두면 가입할 때마다 인증 메일을 눌러야 하고, 무료 메일 발송은 시간당 몇 통으로 제한돼요)
   - **Allow anonymous sign-ins**는 꺼 두세요 (이제 계정으로만 들어와요)
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
5. Supabase **Authentication → URL Configuration → Site URL**에 이 주소를 넣어 주세요 (비밀번호 재설정·인증 메일 링크가 여기로 돌아와요).

## 5. 관리자 가입

관리자도 처음엔 다른 사람과 똑같이 가입하고, 그다음 Supabase에서 한 줄로 관리자 표시를 붙입니다.

1. 배포된 주소 첫 화면에서 **처음 시작하기** → 내 이메일과 비밀번호로 계정 만들기 → 캐릭터 만들기
2. Supabase **SQL Editor**에서 아래 한 줄을 이메일만 바꿔서 실행:
   ```sql
   insert into public.fh_admins (uid) select id from auth.users where email = '내-이메일@example.com' on conflict do nothing;
   ```
3. 게임을 새로고침하면 설정 맨 위에 **이벤트 편집기 (관리자)**가 생겨요.
   이 버튼과 이벤트 저장 권한은 등록된 계정에만 있어요 (서버에서도 막혀 있음).

관리자에서 빼려면: `delete from public.fh_admins where uid = (select id from auth.users where email = '그-이메일');`

## 첫 화면이 안 뜨고 바로 게임이 나올 때

`config.js`에 주소나 anon 키가 비어 있으면 계정 없이 '이 기기에서만 해 보기'만 나와요. 키를 넣고 GitHub에 `config.js`를 다시 올려 주세요.

## 업데이트할 때

GitHub 저장소에서 `index.html`(바뀐 파일만)을 **Add file → Upload files**로 다시 올리면 Vercel이 자동으로 다시 배포해요.

- 플레이어 저장(레벨·아이템·대원)과 관리자가 만든 이벤트는 **Supabase에 있어서 업데이트해도 그대로**예요.
- 이메일 계정으로 들어오니 **어느 기기·브라우저에서 로그인해도 같은 생존자**예요. 로그아웃은 화면 위 설정(톱니바퀴) 옆 문 모양 버튼이에요.
- `supabase.sql`이 바뀐 경우에만 SQL Editor에서 다시 Run 하세요. 여러 번 실행해도 안전해요.
