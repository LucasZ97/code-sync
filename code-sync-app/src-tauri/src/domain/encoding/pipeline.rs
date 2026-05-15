use crate::domain::error::{AppError, AppResult};

/// File extensions treated as binary — skip normalisation entirely.
const BINARY_EXTENSIONS: &[&str] = &[
    ".class", ".jar", ".war", ".ear", ".zip", ".tar", ".gz", ".rar", ".7z", ".exe", ".dll", ".so",
    ".dylib", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".woff", ".woff2", ".ttf",
    ".eot", ".mp3", ".mp4", ".avi", ".mov",
];

/// Extensions where whitespace is semantically significant — skip blank-line cleanup.
const WHITESPACE_SENSITIVE_EXTENSIONS: &[&str] = &[".py", ".mk", ".makefile", ".yaml", ".yml"];

/// CJK encodings that may be misidentified — route to GBK for mainland-China codebases.
const CHINESE_PREFER_GBK: &[&str] = &[
    "big5",
    "big5-hkscs",
    "big5hkscs",
    "gb2312",
    "hz",
    "hz-gb-2312",
    "hzgb2312",
    "cp949",
    "euc-kr",
    "euckr",
    "euc-jp",
    "eucjp",
    "shift-jis",
    "shiftjis",
    "shift_jis",
];

pub struct NormaliseResult {
    pub text: String,
    pub detected_encoding: String,
    pub bom_stripped: bool,
    pub crlf_fixed: bool,
    pub blank_lines_cleaned: usize,
    pub is_binary: bool,
}

fn is_binary_extension(filename: &str) -> bool {
    let lower = filename.to_lowercase();
    BINARY_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

fn is_whitespace_sensitive(filename: &str) -> bool {
    let lower = filename.to_lowercase();
    WHITESPACE_SENSITIVE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(ext))
}

fn normalise_encoding_name(s: &str) -> String {
    s.to_lowercase().replace(['-', '_', ' '], "")
}

fn is_chinese_ambiguous(encoding: &str) -> bool {
    let norm = normalise_encoding_name(encoding);
    CHINESE_PREFER_GBK
        .iter()
        .any(|e| normalise_encoding_name(e) == norm)
}

/// 7-step encoding normalisation pipeline.
///
/// Steps:
/// 1. BOM detection & stripping (UTF-32 LE/BE → UTF-16 LE/BE → UTF-8, longest first)
/// 2. Binary extension guard
/// 3. User `source_encoding_hint` priority attempt
/// 4. `chardetng` auto-detection
/// 5. Chinese priority: ambiguous CJK → GBK
/// 6. Fallback chain: primary → GB18030 → Windows-1252 (latin-1, never fails)
/// 7. CRLF→LF + blank-line whitespace cleanup (skip .py/.yaml/.yml)
pub fn normalise_patch(
    raw_bytes: &[u8],
    filename: &str,
    encoding_hint: Option<&str>,
) -> AppResult<NormaliseResult> {
    // ── Step 2: Binary extension guard ───────────────────────────────────
    if !filename.is_empty() && is_binary_extension(filename) {
        let text = encoding_rs::WINDOWS_1252.decode(raw_bytes).0.into_owned();
        return Ok(NormaliseResult {
            text,
            detected_encoding: "binary".to_string(),
            bom_stripped: false,
            crlf_fixed: false,
            blank_lines_cleaned: 0,
            is_binary: true,
        });
    }

    // ── Step 1: BOM detection & stripping ────────────────────────────────
    let mut bom_stripped = false;
    let mut text: Option<String> = None;
    let mut detected_encoding = "unknown".to_string();

    if raw_bytes.starts_with(b"\xff\xfe\x00\x00") {
        // UTF-32 LE BOM — encoding_rs doesn't support UTF-32; decode as UTF-16 LE (best effort)
        let (decoded, _, _) = encoding_rs::UTF_16LE.decode(&raw_bytes[4..]);
        text = Some(decoded.into_owned());
        detected_encoding = "utf-32-le-bom".to_string();
        bom_stripped = true;
    } else if raw_bytes.starts_with(b"\x00\x00\xfe\xff") {
        // UTF-32 BE BOM — encoding_rs doesn't support UTF-32; decode as UTF-16 BE (best effort)
        let (decoded, _, _) = encoding_rs::UTF_16BE.decode(&raw_bytes[4..]);
        text = Some(decoded.into_owned());
        detected_encoding = "utf-32-be-bom".to_string();
        bom_stripped = true;
    } else if raw_bytes.starts_with(b"\xff\xfe") {
        // UTF-16 LE BOM
        let (decoded, _, _) = encoding_rs::UTF_16LE.decode(raw_bytes);
        text = Some(decoded.into_owned());
        detected_encoding = "utf-16-le-bom".to_string();
        bom_stripped = true;
    } else if raw_bytes.starts_with(b"\xfe\xff") {
        // UTF-16 BE BOM
        let (decoded, _, _) = encoding_rs::UTF_16BE.decode(raw_bytes);
        text = Some(decoded.into_owned());
        detected_encoding = "utf-16-be-bom".to_string();
        bom_stripped = true;
    } else if raw_bytes.starts_with(b"\xef\xbb\xbf") {
        // UTF-8 BOM
        text = Some(String::from_utf8_lossy(&raw_bytes[3..]).into_owned());
        detected_encoding = "utf-8-bom".to_string();
        bom_stripped = true;
    }

    // ── Step 3: User encoding hint ───────────────────────────────────────
    if text.is_none() {
        if let Some(hint) = encoding_hint {
            if let Some(enc) = encoding_rs::Encoding::for_label(hint.as_bytes()) {
                let (decoded, _, had_errors) = enc.decode(raw_bytes);
                if !had_errors {
                    text = Some(decoded.into_owned());
                    detected_encoding = hint.to_string();
                    tracing::debug!("Decoded using user hint: {hint}");
                } else {
                    tracing::warn!("User encoding hint '{hint}' had decode errors, falling back");
                }
            }
        }
    }

    // ── Step 4 & 5: chardetng auto-detection + Chinese routing ──────────
    if text.is_none() {
        let mut det = chardetng::EncodingDetector::new();
        det.feed(raw_bytes, true);
        let (enc, confident) = det.guess_assess(None, true);
        let enc_name = enc.name();

        tracing::debug!("chardetng detected: {enc_name} (confident={confident})");

        if confident && !is_chinese_ambiguous(enc_name) {
            let (decoded, _, _) = enc.decode(raw_bytes);
            text = Some(decoded.into_owned());
            detected_encoding = enc_name.to_string();
        } else {
            // ── Step 6: Fallback chain ────────────────────────────────
            // GBK first for mainland-China Java/XML source files
            for enc_label in &["gbk", "gb18030", "windows-1252"] {
                if let Some(enc) = encoding_rs::Encoding::for_label(enc_label.as_bytes()) {
                    let (decoded, _, had_errors) = enc.decode(raw_bytes);
                    if !had_errors {
                        text = Some(decoded.into_owned());
                        detected_encoding = enc_label.to_string();
                        tracing::info!("Fell back to encoding: {enc_label}");
                        break;
                    }
                }
            }
            // windows-1252 (latin-1) never fails — ensure we always have text
            if text.is_none() {
                let (decoded, _, _) = encoding_rs::WINDOWS_1252.decode(raw_bytes);
                text = Some(decoded.into_owned());
                detected_encoding = "windows-1252".to_string();
            }
        }
    }

    let mut text = text.ok_or_else(|| {
        AppError::Encoding(format!(
            "Cannot reliably detect encoding for '{filename}'. \
             Please specify source_encoding_hint in the project configuration."
        ))
    })?;

    // ── Step 7a: CRLF → LF ───────────────────────────────────────────────
    let crlf_count = text.matches("\r\n").count();
    if crlf_count > 0 {
        text = text.replace("\r\n", "\n");
    }
    // Lone CR → LF
    text = text.replace('\r', "\n");
    let crlf_fixed = crlf_count > 0;

    // ── Step 7b: Blank-line whitespace cleanup ────────────────────────────
    // Lines that are ONLY whitespace → empty string.
    // Skip whitespace-sensitive files (.py, .yaml, .yml).
    let mut blank_lines_cleaned = 0usize;
    if !filename.is_empty() && !is_whitespace_sensitive(filename) {
        let lines: Vec<&str> = text.split('\n').collect();
        let mut cleaned = Vec::with_capacity(lines.len());
        for line in &lines {
            if !line.is_empty() && line.trim().is_empty() {
                cleaned.push("");
                blank_lines_cleaned += 1;
            } else {
                cleaned.push(line);
            }
        }
        text = cleaned.join("\n");
    }

    tracing::debug!(
        "Normalised file={filename:?} encoding={detected_encoding} \
         bom={bom_stripped} crlf_fixed={crlf_fixed} blank_cleaned={blank_lines_cleaned}"
    );

    Ok(NormaliseResult {
        text,
        detected_encoding,
        bom_stripped,
        crlf_fixed,
        blank_lines_cleaned,
        is_binary: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_utf8_bom() {
        let input = b"\xef\xbb\xbfhello world";
        let result = normalise_patch(input, "test.txt", None).unwrap();
        assert!(result.bom_stripped);
        assert_eq!(result.text, "hello world");
        assert_eq!(result.detected_encoding, "utf-8-bom");
    }

    #[test]
    fn converts_crlf_to_lf() {
        let input = b"line1\r\nline2\r\nline3";
        let result = normalise_patch(input, "test.txt", None).unwrap();
        assert!(result.crlf_fixed);
        assert_eq!(result.text, "line1\nline2\nline3");
    }

    #[test]
    fn skips_binary_extension() {
        let input = b"\x00\x01\x02\x03";
        let result = normalise_patch(input, "App.class", None).unwrap();
        assert!(result.is_binary);
        assert_eq!(result.detected_encoding, "binary");
    }

    #[test]
    fn cleans_blank_lines_with_whitespace() {
        let input = b"line1\n   \nline3";
        let result = normalise_patch(input, "test.java", None).unwrap();
        assert_eq!(result.blank_lines_cleaned, 1);
        assert_eq!(result.text, "line1\n\nline3");
    }

    #[test]
    fn preserves_whitespace_in_python_files() {
        let input = b"def foo():\n    pass\n   \n    return None";
        let result = normalise_patch(input, "test.py", None).unwrap();
        assert_eq!(result.blank_lines_cleaned, 0);
    }
}
