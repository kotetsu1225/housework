package com.task.infra.database

import com.task.domain.tenant.TenantId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

/**
 * RLS を越える経路が許可リストの外に増えないことを検査する再発防止テスト(#65)。
 *
 * - `DatabaseWithoutRLS` をコード(コメントを除く)で使うファイルは [ALLOWED_FILES] だけ
 * - `databaseWithoutRLS.withTransaction` / `withSession` の呼び出しの直前には、RLS を越える理由のコメントがある
 * - [Database] にはテナントを指定しない(RLS を越える)メソッドが無い
 *
 * 新しく `DatabaseWithoutRLS` を使いたくなったら、実装の前に人間に確認し、承認されたら
 * [ALLOWED_FILES] と `DatabaseWithoutRLS` の KDoc の許可リストの両方に追加すること。
 */
class DatabaseWithoutRLSUsageTest {

    companion object {
        /** `src/main/kotlin/com/task/` からの相対パス → 許可した理由 */
        private val ALLOWED_FILES = mapOf(
            "infra/database/DatabaseWithoutRLS.kt" to "定義そのもの",
            "Config.kt" to "DI のバインド",
            "usecase/auth/LoginUseCaseImpl.kt" to "email ログイン(#43)",
            "usecase/auth/RegisterFamilyUseCaseImpl.kt" to "サインアップ = テナント作成(#44)",
            "usecase/batch/TenantBatchRunner.kt" to "バッチのための ACTIVE テナント列挙(#56)",
            "usecase/outbox/RelayOutboxEventsUseCaseImpl.kt" to "outbox リレー(#72)",
            "usecase/outbox/ProcessOutboxEventsUseCaseImpl.kt" to "pubsub 無効時の outbox ポーリング(#61)",
        )

        /** 呼び出しの直前、何行以内に理由コメントがあればよいか */
        private const val REASON_COMMENT_WINDOW = 8

        private val SOURCE_ROOT = File("src/main/kotlin/com/task")
    }

    private fun kotlinFiles(): List<File> {
        assertTrue(SOURCE_ROOT.isDirectory) { "ソースが見つからない: ${SOURCE_ROOT.absolutePath}" }
        return SOURCE_ROOT.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
    }

    private fun relativePath(file: File) = file.relativeTo(SOURCE_ROOT).invariantSeparatorsPath

    /** ブロックコメント(KDoc を含む)と行コメントを取り除いたコード */
    private fun codeWithoutComments(source: String): String =
        source
            .replace(Regex("/\\*.*?\\*/", RegexOption.DOT_MATCHES_ALL), "")
            .lines()
            .joinToString("\n") { line -> line.substringBefore("//") }

    @Test
    fun `DatabaseWithoutRLS をコードで使うファイルは許可リストの中だけ`() {
        val users = kotlinFiles()
            .filter { "DatabaseWithoutRLS" in codeWithoutComments(it.readText()) }
            .map { relativePath(it) }
            .toSet()

        val notAllowed = users - ALLOWED_FILES.keys
        assertTrue(notAllowed.isEmpty()) {
            "許可リスト外で DatabaseWithoutRLS が使われています: $notAllowed\n" +
                "RLS を越える必要があるなら、実装の前に人間に確認し、承認後にこのテストの ALLOWED_FILES と " +
                "DatabaseWithoutRLS の KDoc の許可リストに追加してください。"
        }
        // 許可リストが古くならないよう、使われなくなったファイルも検出する
        assertEquals(ALLOWED_FILES.keys, users) { "許可リストに、もう使っていないファイルがあります" }
    }

    @Test
    fun `DatabaseWithoutRLS の呼び出しの直前には RLS を越える理由のコメントがある`() {
        val callPattern = Regex("""databaseWithoutRLS\s*\.\s*(withTransaction|withSession)\b""")
        val missing = mutableListOf<String>()
        var callCount = 0

        for (file in kotlinFiles()) {
            val lines = file.readLines()
            lines.forEachIndexed { index, line ->
                if (callPattern.containsMatchIn(line.substringBefore("//"))) {
                    callCount++
                    val window = lines.subList(maxOf(0, index - REASON_COMMENT_WINDOW), index)
                    val hasReason = window.any { it.trimStart().startsWith("//") && "RLS" in it }
                    if (!hasReason) missing += "${relativePath(file)}:${index + 1}"
                }
            }
        }

        assertTrue(callCount > 0) { "呼び出しが 1 件も見つからない(検査の正規表現が壊れている可能性)" }
        assertTrue(missing.isEmpty()) {
            "理由コメント(直前 $REASON_COMMENT_WINDOW 行以内に「RLS」を含む // コメント)が無い呼び出し: $missing"
        }
    }

    @Test
    fun `Database にはテナントを指定しないメソッドが無い`() {
        val sessionMethods = Database::class.java.declaredMethods
            .filter { java.lang.reflect.Modifier.isPublic(it.modifiers) }
            .filter { it.name.startsWith("withTransaction") || it.name.startsWith("withSession") }

        // TenantId は value class なので、TenantId を受け取るメソッドは JVM 上で
        // `withTransaction-<ハッシュ>` に名前修飾され、引数は (UUID, block) になる。
        // 修飾されていない withTransaction / withSession(= tenant を受け取らない)は存在してはいけない。
        val names = sessionMethods.map { it.name }
        assertEquals(1, sessionMethods.size) { "公開メソッドは tenant スコープの withTransaction 1 つだけのはず: $names" }
        val method = sessionMethods.single()
        assertTrue(method.name.startsWith("withTransaction-")) { "tenantId を受け取らない形になっている: ${method.name}" }
        assertEquals(listOf(java.util.UUID::class.java, kotlin.jvm.functions.Function1::class.java), method.parameterTypes.toList())

        // ソース上の型としても TenantId を受け取ることをコンパイル時に固定する
        val call: (Database, TenantId) -> Unit = { db, tenantId -> db.withTransaction(tenantId) { } }
        assertTrue(call is Function2<*, *, *>)
    }
}
