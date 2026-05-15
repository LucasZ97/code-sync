use std::path::Path;
use std::process::Command;

use crate::domain::error::{AppError, AppResult};
use crate::domain::git::cmd::patch_bin;
use crate::domain::git::patch::parse_meta_header;
use crate::domain::git::status::run_git_raw;
use crate::domain::types::ApplyResult;

/// Apply strategies in order.
#[derive(Debug, Clone, Copy)]
enum Strategy {
    ThreeWay,
    Standard,
    IgnoreWhitespace,
    PatchCmd,
    Reject,
}

impl Strategy {
    fn name(&self) -> &'static str {
        match self {
            Strategy::ThreeWay => "git_apply_3way",
            Strategy::Standard => "git_apply",
            Strategy::IgnoreWhitespace => "git_apply_ignore_ws",
            Strategy::PatchCmd => "patch_p1",
            Strategy::Reject => "git_apply_reject",
        }
    }
}

/// Check if a commit exists in the local git history.
fn commit_exists(repo_path: &str, commit: &str) -> bool {
    let (ok, _, _) = run_git_raw(
        &["cat-file", "-e", &format!("{commit}^{{commit}}")],
        repo_path,
    );
    ok
}

/// Check if the working tree is clean.
fn working_tree_clean(repo_path: &str) -> bool {
    let (ok, stdout, _) = run_git_raw(&["status", "--porcelain"], repo_path);
    ok && stdout.trim().is_empty()
}

/// Check if the patch has already been applied (reversed patch detection).
fn is_reversed_patch(patch_path: &str, repo_path: &str) -> bool {
    let (ok, _, _) = run_git_raw(&["apply", "--check", "--reverse", patch_path], repo_path);
    ok
}

/// Stash working tree changes. Returns stash ref or None if nothing stashed.
fn stash_push(repo_path: &str) -> AppResult<Option<String>> {
    let (ok, stdout, stderr) = run_git_raw(
        &[
            "stash",
            "push",
            "-u",
            "-m",
            "codesync: auto-stash before apply",
        ],
        repo_path,
    );
    if !ok {
        return Err(AppError::Git(format!("git stash push failed: {stderr}")));
    }
    if stdout.contains("No local changes to save") {
        return Ok(None);
    }
    // Extract stash ref from output like "Saved working directory ... stash@{0}"
    let stash_ref = stdout
        .lines()
        .find_map(|line| {
            line.find("stash@{").map(|pos| {
                line[pos..]
                    .split_whitespace()
                    .next()
                    .unwrap_or("stash@{0}")
                    .to_string()
            })
        })
        .unwrap_or_else(|| "stash@{0}".to_string());

    Ok(Some(stash_ref))
}

/// Restore stashed changes.
fn stash_pop(repo_path: &str, stash_ref: &str) {
    let (ok, _, stderr) = run_git_raw(&["stash", "pop", stash_ref], repo_path);
    if !ok {
        tracing::warn!("git stash pop failed (manual recovery needed): {stderr}");
    }
}

/// Find all .rej files created by git apply --reject.
fn collect_rej_files(repo_path: &str) -> Vec<String> {
    let mut rej_files = Vec::new();
    if let Ok(entries) = walkdir_rej(repo_path) {
        rej_files = entries;
    }
    rej_files
}

fn walkdir_rej(repo_path: &str) -> AppResult<Vec<String>> {
    let mut result = Vec::new();
    collect_rej_recursive(Path::new(repo_path), Path::new(repo_path), &mut result);
    Ok(result)
}

fn collect_rej_recursive(base: &Path, dir: &Path, result: &mut Vec<String>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Skip .git directory
                if path.file_name().map(|n| n == ".git").unwrap_or(false) {
                    continue;
                }
                collect_rej_recursive(base, &path, result);
            } else if path.extension().map(|e| e == "rej").unwrap_or(false) {
                if let Ok(rel) = path.strip_prefix(base) {
                    result.push(rel.to_string_lossy().into_owned());
                }
            }
        }
    }
}

/// Extract list of files mentioned in the patch (from +++ b/ lines).
fn parse_applied_files(patch_path: &str) -> AppResult<Vec<String>> {
    let content = std::fs::read_to_string(patch_path)
        .map_err(|e| AppError::PatchApply(format!("Cannot read patch file '{patch_path}': {e}")))?;
    let mut files = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for line in content.lines() {
        if let Some(path) = line.strip_prefix("+++ b/") {
            if seen.insert(path.to_string()) {
                files.push(path.to_string());
            }
        }
    }
    Ok(files)
}

/// Try a git apply command. Returns (success, stderr).
fn try_apply(args: &[&str], repo_path: &str) -> (bool, String) {
    let (ok, _, stderr) = run_git_raw(args, repo_path);
    (ok, stderr)
}

/// Apply a .codesync patch to a git repository using a 5-level fallback pipeline.
pub fn apply_patch(
    patch_path: &str,
    repo_path: &str,
    expected_project_id: Option<&str>,
) -> AppResult<ApplyResult> {
    // ── Pre-apply validation ──────────────────────────────────────────────
    if !Path::new(patch_path).exists() {
        return Err(AppError::NotFound(format!(
            "Patch file not found: {patch_path}"
        )));
    }

    let content = std::fs::read_to_string(patch_path).map_err(AppError::Io)?;
    let meta = parse_meta_header(&content);

    // Project ID check
    if let Some(expected) = expected_project_id {
        if let Some(actual) = meta.get("project") {
            if actual != expected {
                return Err(AppError::PatchApply(format!(
                    "Patch project '{actual}' does not match expected '{expected}'. \
                     Applying to wrong repository is dangerous — aborting."
                )));
            }
        }
    }

    // base_commit existence check (warning only)
    if let Some(base_commit) = meta.get("base_commit") {
        if base_commit != "unknown" && !commit_exists(repo_path, base_commit) {
            tracing::warn!(
                "base_commit '{base_commit}' not found in local git history. \
                 The two sides may have diverged — conflicts are likely."
            );
        }
    }

    // Reversed patch detection
    if is_reversed_patch(patch_path, repo_path) {
        return Err(AppError::PatchApply(
            "This patch appears to have already been applied (reversed patch detected). \
             Skipping to avoid duplicate application."
                .to_string(),
        ));
    }

    // ── Auto-stash ────────────────────────────────────────────────────────
    let stash_ref = if !working_tree_clean(repo_path) {
        match stash_push(repo_path) {
            Ok(r) => {
                if let Some(ref s) = r {
                    tracing::info!("Auto-stashed working tree: {s}");
                }
                r
            }
            Err(e) => {
                return Ok(ApplyResult {
                    success: false,
                    error: Some(format!("Auto-stash failed: {e}")),
                    ..Default::default()
                });
            }
        }
    } else {
        None
    };

    let applied_files = parse_applied_files(patch_path)?;

    // ── Try strategies in order ───────────────────────────────────────────
    let strategies = [
        Strategy::ThreeWay,
        Strategy::Standard,
        Strategy::IgnoreWhitespace,
        Strategy::PatchCmd,
        Strategy::Reject,
    ];

    let mut last_error = String::new();

    for strategy in &strategies {
        let success = match strategy {
            Strategy::ThreeWay => {
                // Dry-run first
                let (dry_ok, _) = try_apply(&["apply", "--check", "--3way", patch_path], repo_path);
                if !dry_ok {
                    continue;
                }
                let (ok, err) = try_apply(&["apply", "--3way", patch_path], repo_path);
                last_error = err;
                ok
            }
            Strategy::Standard => {
                let (dry_ok, _) = try_apply(&["apply", "--check", patch_path], repo_path);
                if !dry_ok {
                    continue;
                }
                let (ok, err) = try_apply(&["apply", patch_path], repo_path);
                last_error = err;
                ok
            }
            Strategy::IgnoreWhitespace => {
                let (dry_ok, _) = try_apply(
                    &[
                        "apply",
                        "--check",
                        "--ignore-whitespace",
                        "--ignore-space-change",
                        patch_path,
                    ],
                    repo_path,
                );
                if !dry_ok {
                    continue;
                }
                let (ok, err) = try_apply(
                    &[
                        "apply",
                        "--ignore-whitespace",
                        "--ignore-space-change",
                        patch_path,
                    ],
                    repo_path,
                );
                last_error = err;
                ok
            }
            Strategy::PatchCmd => {
                // Use system `patch` command
                let output = Command::new(patch_bin())
                    .args(["-p1", "--ignore-whitespace", "-i", patch_path])
                    .current_dir(repo_path)
                    .output();
                match output {
                    Ok(o) => {
                        last_error = String::from_utf8_lossy(&o.stderr).into_owned();
                        o.status.success()
                    }
                    Err(e) => {
                        last_error = e.to_string();
                        false
                    }
                }
            }
            Strategy::Reject => {
                // Last resort: apply with --reject (partial application)
                let (ok, err) = try_apply(&["apply", "--reject", patch_path], repo_path);
                last_error = err;
                // Always "succeed" at this level — collect .rej files
                let conflict_files = collect_rej_files(repo_path);
                tracing::info!(
                    "Patch applied with strategy=git_apply_reject conflicts={}",
                    conflict_files.len()
                );
                return Ok(ApplyResult {
                    success: true,
                    strategy_used: Some(strategy.name().to_string()),
                    applied_files,
                    failed_files: Vec::new(),
                    conflict_files,
                    stash_ref,
                    error: if ok { None } else { Some(last_error) },
                });
            }
        };

        if success {
            let conflict_files = collect_rej_files(repo_path);
            tracing::info!(
                "Patch applied with strategy={} conflicts={}",
                strategy.name(),
                conflict_files.len()
            );
            return Ok(ApplyResult {
                success: true,
                strategy_used: Some(strategy.name().to_string()),
                applied_files,
                failed_files: Vec::new(),
                conflict_files,
                stash_ref,
                error: None,
            });
        }

        tracing::debug!(
            "Strategy {} failed: {}",
            strategy.name(),
            &last_error[..200.min(last_error.len())]
        );
    }

    // All strategies failed — restore stash
    if let Some(ref stash) = stash_ref {
        tracing::info!("All strategies failed, restoring stash: {stash}");
        stash_pop(repo_path, stash);
    }

    Ok(ApplyResult {
        success: false,
        error: Some(format!(
            "All apply strategies failed. Last error: {}",
            &last_error[..500.min(last_error.len())]
        )),
        stash_ref,
        ..Default::default()
    })
}
