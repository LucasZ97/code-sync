use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use chrono::Utc;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::domain::encoding::pipeline::normalise_patch;
use crate::domain::error::{AppError, AppResult};
use crate::domain::git::cmd::git_bin;
use crate::domain::git::status::{get_status, head_commit, head_commit_msg};
use crate::domain::syncignore::matcher::load_rules;
use crate::domain::types::{GeneratedPatch, PathWarning};

/// Windows reserved filenames (case-insensitive, any extension).
const WINDOWS_RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Characters illegal in Windows filenames.
const WINDOWS_ILLEGAL_CHARS: &[char] = &['<', '>', ':', '"', '|', '?', '*'];

/// Windows MAX_PATH limit.
const WINDOWS_MAX_PATH: usize = 260;

/// Check path compatibility and return any warnings.
pub fn check_path_compatibility(rel_path: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    let name = Path::new(rel_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(rel_path);

    // Windows reserved filenames
    let stem = name.split('.').next().unwrap_or(name).to_uppercase();
    if WINDOWS_RESERVED.contains(&stem.as_str()) {
        warnings.push(format!(
            "Windows reserved filename '{name}'. This file cannot be created on Windows."
        ));
    }

    // Windows illegal characters
    for component in rel_path.split('/') {
        if component
            .chars()
            .any(|c| WINDOWS_ILLEGAL_CHARS.contains(&c))
        {
            warnings.push(format!(
                "Path '{rel_path}' contains characters illegal on Windows (<>:\"|?*)."
            ));
            break;
        }
    }

    // Windows MAX_PATH
    if rel_path.len() > WINDOWS_MAX_PATH {
        warnings.push(format!(
            "Path length {} exceeds Windows MAX_PATH ({WINDOWS_MAX_PATH}).",
            rel_path.len()
        ));
    }

    warnings
}

/// Filter out diff chunks that only change file mode (old mode/new mode).
/// Windows has no execute bit, so filemode diffs are always noise.
pub fn filter_filemode_chunks(diff: &str) -> String {
    let lines: Vec<&str> = diff.lines().collect();
    let mut result = Vec::new();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        if line.starts_with("diff --git ") {
            // Look ahead: if the block only has "old mode/new mode" and no "--- a/" line, skip it
            let mut j = i + 1;
            let mut has_content = false;
            while j < lines.len() && !lines[j].starts_with("diff --git ") {
                if lines[j].starts_with("--- ") || lines[j].starts_with("+++ ") {
                    has_content = true;
                    break;
                }
                j += 1;
            }
            if !has_content {
                i = j;
                continue;
            }
        }
        result.push(line);
        i += 1;
    }

    result.join("\n")
}

/// Inject the CODESYNC-META header into the patch content.
pub fn inject_sync_meta(
    diff: &str,
    project_id: &str,
    base_commit: &str,
    base_commit_msg: &str,
    file_count: usize,
    encoding: &str,
) -> String {
    let now_utc = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "unknown".to_string());

    let meta_header = format!(
        "#!sync-meta-begin\n\
         # version: 1\n\
         # generated_at: {now_utc}\n\
         # source_host: {hostname}\n\
         # project: {project_id}\n\
         # base_commit: {base_commit}\n\
         # base_commit_msg: {base_commit_msg}\n\
         # files_changed: {file_count}\n\
         # source_encoding: {encoding}\n\
         # normalized_by: codesync/2.0\n\
         #!sync-meta-end\n"
    );

    format!("{meta_header}{diff}")
}

/// Parse the sync-meta header from a patch file.
pub fn parse_meta_header(content: &str) -> HashMap<String, String> {
    let mut meta = HashMap::new();
    let mut in_meta = false;

    for line in content.lines() {
        if line == "#!sync-meta-begin" {
            in_meta = true;
            continue;
        }
        if line == "#!sync-meta-end" {
            break;
        }
        if in_meta && line.starts_with("# ") {
            if let Some((key, value)) = line[2..].split_once(": ") {
                meta.insert(key.trim().to_string(), value.trim().to_string());
            }
        }
    }

    meta
}

/// Generate a normalised patch file from the current working tree.
pub fn generate_patch(
    repo_path: &str,
    project_id: &str,
    project_name: &str,
    output_dir: &str,
    files: Option<&[String]>,
    syncignore_path: Option<&str>,
    encoding_hint: Option<&str>,
) -> AppResult<GeneratedPatch> {
    let matcher = load_rules(syncignore_path, repo_path);

    // Get working tree status
    let status_entries = get_status(repo_path)?;
    let all_changed: Vec<String> = status_entries.iter().map(|s| s.rel_path.clone()).collect();

    // Filter by file selection
    let diff_files: Vec<String> = if let Some(selected) = files {
        all_changed
            .iter()
            .filter(|f| selected.contains(f))
            .cloned()
            .collect()
    } else {
        all_changed.clone()
    };

    // Apply .syncignore exclusions
    let exclusions = matcher.explain_exclusions(&diff_files);
    let included_files: Vec<String> = diff_files
        .iter()
        .filter(|f| !exclusions.contains_key(*f))
        .cloned()
        .collect();

    // Separate tracked from untracked
    let untracked: std::collections::HashSet<String> = status_entries
        .iter()
        .filter(|s| s.status == "untracked")
        .map(|s| s.rel_path.clone())
        .collect();

    let tracked_included: Vec<&str> = included_files
        .iter()
        .filter(|f| !untracked.contains(*f))
        .map(|s| s.as_str())
        .collect();

    let untracked_included: Vec<&str> = included_files
        .iter()
        .filter(|f| untracked.contains(*f))
        .map(|s| s.as_str())
        .collect();

    if tracked_included.is_empty() && untracked_included.is_empty() {
        return Err(AppError::Git(
            "No files to include in patch after applying exclusion rules.".to_string(),
        ));
    }

    // Build git diff command
    let cmd_args = vec![
        "diff",
        "--no-color",
        "--ignore-submodules",
        "-p",
        "--binary",
        "HEAD",
    ];

    let mut raw_diff = String::new();

    if !tracked_included.is_empty() {
        let mut full_args = cmd_args.clone();
        full_args.push("--");
        full_args.extend(tracked_included.iter().copied());

        let output = Command::new(git_bin())
            .args(&full_args)
            .current_dir(repo_path)
            .output()
            .map_err(|e| AppError::Git(format!("Failed to run git diff: {e}")))?;

        // git diff exits 1 when there are differences — that's normal
        if output.status.code() != Some(0) && output.status.code() != Some(1) {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Git(format!("git diff failed: {}", stderr.trim())));
        }

        raw_diff = String::from_utf8_lossy(&output.stdout).into_owned();
    }

    // For untracked new files, generate a simple "new file" diff
    for uf in &untracked_included {
        let uf_path = Path::new(repo_path).join(uf);
        if uf_path.exists() && uf_path.is_file() {
            match std::fs::read_to_string(&uf_path) {
                Ok(content) => {
                    let lines: Vec<&str> = content.lines().collect();
                    let hunk: String = lines.iter().map(|l| format!("+{l}\n")).collect();
                    raw_diff.push_str(&format!(
                        "diff --git a/{uf} b/{uf}\nnew file mode 100644\n--- /dev/null\n+++ b/{uf}\n@@ -0,0 +1,{} @@\n{hunk}",
                        lines.len()
                    ));
                }
                Err(e) => {
                    tracing::warn!("Cannot read untracked file {uf}: {e}");
                }
            }
        }
    }

    // Filter filemode-only chunks
    let raw_diff = filter_filemode_chunks(&raw_diff);

    if raw_diff.trim().is_empty() {
        return Err(AppError::Git(
            "Generated diff is empty. Nothing to sync.".to_string(),
        ));
    }

    // Normalise encoding
    let norm = normalise_patch(raw_diff.as_bytes(), "", encoding_hint)?;
    let normalised_diff = norm.text;

    // Count changed files
    let file_count = {
        let mut count = normalised_diff.matches("\ndiff --git ").count();
        if normalised_diff.starts_with("diff --git ") {
            count += 1;
        }
        count
    };

    // Resolve metadata
    let head = head_commit(repo_path);
    let head_msg = head_commit_msg(repo_path);

    // Path compatibility checks
    let path_warnings: Vec<PathWarning> = included_files
        .iter()
        .flat_map(|f| {
            check_path_compatibility(f)
                .into_iter()
                .map(|w| PathWarning {
                    rel_path: f.clone(),
                    warning: w,
                })
        })
        .collect();

    // Build patch with sync-meta header
    let final_content = inject_sync_meta(
        &normalised_diff,
        project_id,
        &head,
        &head_msg,
        file_count,
        &norm.detected_encoding,
    );

    // Write patch file
    std::fs::create_dir_all(output_dir).map_err(AppError::Io)?;

    let now_date = Utc::now().format("%Y-%m-%d").to_string();
    let uuid8 = Uuid::new_v4().to_string()[..8].to_string();
    let safe_name: String = project_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let patch_name = format!(
        "{uuid8}-{now_date}-{safe_name}-{}.codesync",
        &head[..7.min(head.len())]
    );
    let patch_path = Path::new(output_dir).join(&patch_name);

    std::fs::write(&patch_path, &final_content).map_err(AppError::Io)?;

    let sha256 = {
        let mut hasher = Sha256::new();
        hasher.update(final_content.as_bytes());
        hex::encode(hasher.finalize())
    };

    tracing::info!(
        "Patch generated: {} (sha256={})",
        patch_path.display(),
        &sha256[..12]
    );

    Ok(GeneratedPatch {
        patch_path: patch_path.to_string_lossy().into_owned(),
        patch_name,
        project_id: project_id.to_string(),
        base_commit: head.clone(),
        base_commit_msg: head_msg,
        files_changed: file_count,
        sha256,
        path_warnings,
        excluded_files: exclusions,
    })
}
