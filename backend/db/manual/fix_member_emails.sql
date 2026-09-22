-- ============================================================
-- メンバーの email を一括修正する手動バッチ(Flyway の対象外)
--
-- 背景:
--   V11 は当時の既存メンバーの email を 'dummy-<id>@example.com' で埋めた。
--   マルチテナント化でログインが email + password に変わるため、
--   ダミーのままのメンバーはログインできなくなる。移行前に正しい email へ直す。
--
-- 使い方:
--   1. 下の「★ ここを編集」の VALUES を、対象メンバーの (名前, 新しい email) に書き換える
--   2. まず確認だけ行う(何も変更しない。最後に ROLLBACK される)
--        psql "$DATABASE_URL" -f backend/db/manual/fix_member_emails.sql
--   3. 表示された before / after が意図どおりなら、apply=1 を付けて確定する
--        psql "$DATABASE_URL" -v apply=1 -f backend/db/manual/fix_member_emails.sql
--
--   本番(Railway)に対して流す場合:
--        railway run sh -c 'psql "$DATABASE_PUBLIC_URL" -v apply=1 -f backend/db/manual/fix_member_emails.sql'
--
-- 安全策:
--   - 1 トランザクションで実行し、チェックに 1 つでも失敗したら全体がロールバックされる
--   - apply=1 を付けない限り必ず ROLLBACK する
--   - 名前が members にちょうど 1 件一致しない行、形式が不正な email、
--     対象外のメンバーが既に使っている email があれば中断する
--
-- 前提:
--   名前でメンバーを特定する。マルチテナント化の前(名前がグローバル一意)か、
--   テナントが 1 つだけの間に流すこと。
-- ============================================================

\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif

BEGIN;

CREATE TEMP TABLE email_fix (
    member_name TEXT PRIMARY KEY,
    new_email   TEXT NOT NULL UNIQUE
) ON COMMIT DROP;

-- ★ ここを編集 ------------------------------------------------
INSERT INTO email_fix (member_name, new_email) VALUES
    ('メンバー名1', 'member1@example.com'),
    ('メンバー名2', 'member2@example.com'),
    ('メンバー名3', 'member3@example.com'),
    ('メンバー名4', 'member4@example.com');
-- ★ ここまで --------------------------------------------------

-- 入力チェック(1 つでも違反があれば例外で中断 → 全体ロールバック)
DO $$
DECLARE
    problems TEXT;
BEGIN
    -- 名前が members にちょうど 1 件一致すること
    SELECT string_agg(format('%s (一致 %s 件)', f.member_name, c.cnt), ', ')
      INTO problems
      FROM email_fix f
      CROSS JOIN LATERAL (SELECT count(*) AS cnt FROM members m WHERE m.name = f.member_name) c
     WHERE c.cnt <> 1;
    IF problems IS NOT NULL THEN
        RAISE EXCEPTION '名前が members にちょうど 1 件一致しません: %', problems;
    END IF;

    -- email の形式(フロントの登録画面と同じ「@ の後ろにドットを含む」水準)
    SELECT string_agg(f.new_email, ', ')
      INTO problems
      FROM email_fix f
     WHERE f.new_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$';
    IF problems IS NOT NULL THEN
        RAISE EXCEPTION 'email の形式が不正です: %', problems;
    END IF;

    -- 今回の対象外のメンバーが既に使っている email でないこと
    SELECT string_agg(format('%s (使用中: %s)', f.new_email, m.name), ', ')
      INTO problems
      FROM email_fix f
      JOIN members m ON lower(m.email) = lower(f.new_email)
     WHERE m.name NOT IN (SELECT member_name FROM email_fix);
    IF problems IS NOT NULL THEN
        RAISE EXCEPTION '他のメンバーが既に使っている email です: %', problems;
    END IF;
END $$;

\echo
\echo '--- before ---'
SELECT m.name, m.email AS current_email, f.new_email,
       (m.email LIKE 'dummy-%@example.com') AS is_dummy
  FROM members m
  JOIN email_fix f ON f.member_name = m.name
 ORDER BY m.created_at;

-- email は UNIQUE。メンバー同士で email を入れ替えるケースでも衝突しないよう、
-- 対象行をいったん一意な仮の値に退避してから本来の値を入れる
UPDATE members m
   SET email = 'tmp-' || m.id || '@invalid.example'
  FROM email_fix f
 WHERE m.name = f.member_name;

UPDATE members m
   SET email = f.new_email,
       updated_at = CURRENT_TIMESTAMP
  FROM email_fix f
 WHERE m.name = f.member_name;

\echo
\echo '--- after ---'
SELECT m.name, m.email
  FROM members m
  JOIN email_fix f ON f.member_name = m.name
 ORDER BY m.created_at;

\echo
\echo '--- ダミー email のまま残っているメンバー(0 件になっていれば完了) ---'
SELECT name, email
  FROM members
 WHERE email LIKE 'dummy-%@example.com'
 ORDER BY created_at;

\if :apply
  COMMIT;
  \echo
  \echo '==> COMMIT しました'
\else
  ROLLBACK;
  \echo
  \echo '==> 確認のみ(ROLLBACK しました)。確定するには -v apply=1 を付けて再実行してください'
\endif
