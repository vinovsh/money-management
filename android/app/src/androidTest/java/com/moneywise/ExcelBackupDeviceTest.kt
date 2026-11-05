package com.moneywise

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

@RunWith(AndroidJUnit4::class)
class ExcelBackupDeviceTest {
    private val snapshot =
        """{"data":{"settings":{"currency":"INR"},"transactions":[{"date":"2026-11-05","type":"expense","amount":1250,"note":"=1+1 & தமிழ் 👋","deletedAt":null}]},"attachments":{"receipt":"${"aGk=".repeat(14000)}"}}"""

    private fun workbook(): ByteArray =
        ByteArrayOutputStream().apply { ExcelBackup.write(this, snapshot) }.toByteArray()

    private fun parts(bytes: ByteArray): MutableMap<String, String> = mutableMapOf<String, String>().apply {
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                put(entry.name, zip.readBytes().toString(Charsets.UTF_8))
            }
        }
    }

    private fun zip(parts: Map<String, String>): ByteArray {
        val output = ByteArrayOutputStream()
        ZipOutputStream(output).use { zip ->
            parts.forEach { (name, xml) ->
                zip.putNextEntry(ZipEntry(name)); zip.write(xml.toByteArray()); zip.closeEntry()
            }
        }
        return output.toByteArray()
    }

    @Test fun roundTripPreservesUnicodeAndLargeReceipts() {
        val file = workbook()
        assertEquals(snapshot, ExcelBackup.read(ByteArrayInputStream(file)))
        val transactions = parts(file).getValue("xl/worksheets/sheet2.xml")
        assertTrue(transactions.contains("<v>12.50</v>"))
        assertTrue(transactions.contains("=1+1 &amp; தமிழ் 👋"))
        assertFalse(transactions.contains("<f>"))
    }

    @Test fun readsSharedStringsUsedByExcel() {
        val parts = parts(workbook())
        val sheet = "xl/worksheets/sheet1.xml"
        val strings = mutableListOf<String>()
        parts[sheet] = Regex("""t="inlineStr"><is><t>([^<]*)</t></is>""").replace(parts.getValue(sheet)) {
            strings.add(it.groupValues[1])
            """t="s"><v>${strings.lastIndex}</v>"""
        }
        parts["xl/sharedStrings.xml"] = "<sst>" + strings.joinToString("") { "<si><t>$it</t></si>" } + "</sst>"
        assertEquals(snapshot, ExcelBackup.read(ByteArrayInputStream(zip(parts))))
    }

    @Test fun rejectsDamagedAndForeignWorkbooks() {
        val parts = parts(workbook())
        val sheet = "xl/worksheets/sheet1.xml"
        val original = parts.getValue(sheet)
        parts[sheet] = original.replace("Walletway Excel Backup v1", "Other workbook")
        assertThrows(IllegalArgumentException::class.java) { ExcelBackup.read(ByteArrayInputStream(zip(parts))) }
        parts[sheet] = Regex("""(<c r="A2" t="inlineStr"><is><t>)[^<]+""").replace(original) { it.groupValues[1] + "invalid" }
        assertThrows(IllegalArgumentException::class.java) { ExcelBackup.read(ByteArrayInputStream(zip(parts))) }
    }
}
