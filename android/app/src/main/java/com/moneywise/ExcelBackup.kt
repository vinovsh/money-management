package com.moneywise

import android.util.Base64
import android.util.Xml
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

internal object ExcelBackup {
    const val MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    private const val LIMIT = 25 * 1024 * 1024
    private const val CHUNK = 24000
    private const val MAX_ROWS = 1500
    private const val MARKER = "Walletway Excel Backup v1"
    private const val NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    private fun digest(bytes: ByteArray) = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(bytes), Base64.NO_WRAP)
    private fun escaped(text: String) = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").filter { it >= ' ' || it == '\n' || it == '\r' || it == '\t' }
    private fun cell(text: String) = "<c t=\"inlineStr\"><is><t xml:space=\"preserve\">${escaped(text)}</t></is></c>"
    private fun ZipOutputStream.part(name: String, value: String) {
        putNextEntry(ZipEntry(name)); write(value.toByteArray(Charsets.UTF_8)); closeEntry()
    }
    fun write(output: OutputStream, snapshot: String) {
        val bytes = snapshot.toByteArray(Charsets.UTF_8)
        require(bytes.size <= LIMIT) { "Backup exceeds the 25 MB limit." }
        val data = JSONObject(snapshot).getJSONObject("data")
        val currency = data.getJSONObject("settings").getString("currency")
        val transactions = data.getJSONArray("transactions")
        ZipOutputStream(output).use { zip ->
            zip.part("[Content_Types].xml", """<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>""")
            val rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            val rels = "http://schemas.openxmlformats.org/package/2006/relationships"
            zip.part("_rels/.rels", """<Relationships xmlns="$rels"><Relationship Id="rId1" Type="$rel/officeDocument" Target="xl/workbook.xml"/></Relationships>""")
            zip.part("xl/workbook.xml", """<workbook xmlns="$NS" xmlns:r="$rel"><sheets><sheet name="Walletway Backup" sheetId="1" r:id="rId1"/><sheet name="Transactions" sheetId="2" r:id="rId2"/></sheets></workbook>""")
            zip.part("xl/_rels/workbook.xml.rels", """<Relationships xmlns="$rels"><Relationship Id="rId1" Type="$rel/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="$rel/worksheet" Target="worksheets/sheet2.xml"/></Relationships>""")
            zip.putNextEntry(ZipEntry("xl/worksheets/sheet1.xml"))
            fun emit(value: String) { zip.write(value.toByteArray(Charsets.UTF_8)) }
            emit("""<worksheet xmlns="$NS"><sheetData>""")
            (sequenceOf(MARKER, digest(bytes)) + Base64.encodeToString(bytes, Base64.NO_WRAP).chunkedSequence(CHUNK).map { it.toString() }).forEachIndexed { i, value ->
                val row = i + 1
                emit("<row r=\"$row\"><c r=\"A$row\" t=\"inlineStr\"><is><t>$value</t></is></c></row>")
            }
            emit("</sheetData></worksheet>"); zip.closeEntry()
            zip.putNextEntry(ZipEntry("xl/worksheets/sheet2.xml"))
            emit("""<worksheet xmlns="$NS"><sheetData><row>""")
            listOf("Date", "Time", "Type", "Amount", "Currency", "Note", "Tags").forEach { emit(cell(it)) }
            emit("</row>")
            for (i in 0 until transactions.length()) {
                val item = transactions.getJSONObject(i)
                if (!item.isNull("deletedAt")) continue
                emit("<row>")
                listOf("date", "time", "type").forEach { emit(cell(item.optString(it, ""))) }
                val amount = java.math.BigDecimal.valueOf(item.getLong("amount"), 2).toPlainString()
                emit("<c><v>$amount</v></c>")
                listOf(currency, item.optString("note", ""), item.optString("tags", "")).forEach { emit(cell(it)) }
                emit("</row>")
            }
            emit("</sheetData></worksheet>"); zip.closeEntry()
        }
    }
    fun read(input: InputStream): String {
        var sheet: ByteArray? = null
        var shared: ByteArray? = null
        var total = 0
        var entries = 0
        ZipInputStream(input).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                require(++entries <= 128) { "Workbook has too many files." }
                val wanted = entry.name == "xl/worksheets/sheet1.xml" || entry.name == "xl/sharedStrings.xml"
                val output = if (wanted) ByteArrayOutputStream() else null
                val buffer = ByteArray(8192)
                while (true) {
                    val n = zip.read(buffer)
                    if (n < 0) break
                    total += n
                    require(total <= 96 * 1024 * 1024 && (output?.size() ?: 0) + n <= 36 * 1024 * 1024) { "Workbook exceeds the import size limit." }
                    output?.write(buffer, 0, n)
                }
                if (entry.name == "xl/worksheets/sheet1.xml") { require(sheet == null); sheet = output!!.toByteArray() }
                if (entry.name == "xl/sharedStrings.xml") { require(shared == null); shared = output!!.toByteArray() }
                zip.closeEntry()
            }
        }
        val strings = shared?.let { cells(it, true) } ?: emptyList()
        val values = cells(requireNotNull(sheet) { "Choose an Excel backup exported by Walletway." }, false).map { (kind, value) ->
            if (kind == "s") strings.getOrNull(value.toIntOrNull() ?: -1)?.second ?: error("Invalid Excel string index.") else value
        }
        require(values.size >= 3 && values[0] == MARKER) { "Choose an Excel backup exported by Walletway." }
        val chunks = values.drop(2)
        require(chunks.all { it.isNotEmpty() && it.length <= CHUNK } && chunks.sumOf { it.length } <= ((LIMIT + 2) / 3) * 4) { "Backup exceeds the import size limit." }
        val bytes = Base64.decode(chunks.joinToString(""), Base64.NO_WRAP)
        require(bytes.size <= LIMIT && digest(bytes) == values[1]) { "The backup sheet was changed or damaged. Use the original export." }
        return String(bytes, Charsets.UTF_8)
    }
    private fun cells(xml: ByteArray, shared: Boolean): List<Pair<String, String>> {
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_DOCDECL, false)
        parser.setInput(ByteArrayInputStream(xml), null)
        val values = mutableListOf<Pair<String, String>>()
        val element = if (shared) "si" else "c"
        var depth = 0
        var type = ""
        var textDepth = 0
        var value = StringBuilder()
        while (parser.eventType != XmlPullParser.END_DOCUMENT) {
            when (parser.eventType) {
                XmlPullParser.DOCDECL -> error("Unsupported workbook XML.")
                XmlPullParser.START_TAG -> when {
                    parser.name == element && depth == 0 -> {
                        depth = parser.depth
                        type = if (shared) "" else parser.getAttributeValue(null, "t") ?: ""
                        if (!shared) {
                            require(parser.getAttributeValue(null, "r") == "A${values.size + 1}")
                            require(type == "inlineStr" || type == "s")
                        }
                        value = StringBuilder()
                    }
                    depth > 0 && parser.name == "f" -> error("Backup cells cannot contain formulas.")
                    depth > 0 && (parser.name == "t" || parser.name == "v") -> textDepth = parser.depth
                }
                XmlPullParser.TEXT, XmlPullParser.CDSECT, XmlPullParser.ENTITY_REF -> if (textDepth > 0) {
                    value.append(parser.text ?: "")
                    require(value.length <= 32767) { "Backup cell is too large." }
                }
                XmlPullParser.END_TAG -> {
                    if (parser.depth == textDepth) textDepth = 0
                    if (parser.depth == depth) {
                        values.add(type to value.toString())
                        require(values.size <= if (shared) 250000 else MAX_ROWS) { "Workbook has too many cells." }
                        depth = 0
                    }
                }
            }
            parser.nextToken()
        }
        return values
    }
}
