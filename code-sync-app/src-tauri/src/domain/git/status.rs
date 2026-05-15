use std::process::Command;

use crate::domain::error::{AppError, AppResult};
use crate::domain::git::cmd::git_bin;
use crate::domain::types::FileStatus;

/// Run a git command in the given directory and return stdout.
pub fn run_git(args: &[&str], cwd: &str) -> AppResult<String> {
    let output = Command::new(git_bin())
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| AppError::Git(format!("Failed to run git: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "git {} failed: {}",
            args.join(" "),
            stderr.trim()
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Run a git command, returning (success, stdout, stderr).
pub fn run_git_raw(args: &[&str], cwd: &str) -> (bool, String, String) {
    match Command::new(git_bin()).args(args).current_dir(cwd).output() {
        Ok(output) => (
            output.status.success(),
            String::from_utf8_lossy(&output.stdout).into_owned(),
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ),
        Err(e) => (false, String::new(), e.to_string()),
    }
}

/// Get the short HEAD commit hash.
pub fn head_commit(repo_path: &str) -> String {
    run_git(&["rev-parse", "--short", "HEAD"], repo_path)
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

/// Get the HEAD commit message (subject line).
pub fn head_commit_msg(repo_path: &str) -> String {
    run_git(&["log", "-1", "--pretty=%s", "HEAD"], repo_path)
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

/// Get the working tree status using `git status --porcelain -uall -z`.
/// The `-z` flag uses NUL as separator, correctly handling paths with spaces.
pub fn get_status(repo_path: &str) -> AppResult<Vec<FileStatus>> {
    let output = Command::new(git_bin())
        .args(["status", "--porcelain", "-uall", "-z"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| AppError::Git(format!("Failed to run git status: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "git status failed: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_status_output(&stdout)
}

fn parse_status_output(output: &str) -> AppResult<Vec<FileStatus>> {
    let mut files: Vec<FileStatus> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // NUL-separated entries
    let entries: Vec<&str> = output.split('\0').collect();
    let mut i = 0;

    while i < entries.len() {
        let entry = entries[i];
        if entry.len() < 3 {
            i += 1;
            continue;
        }

        let xy = &entry[..2];
        let mut path = entry[3..].to_string();

        // Handle rename: "R old\0new" — next entry is the new path
        if (xy.starts_with('R') || xy.starts_with('C')) && i + 1 < entries.len() {
            path = entries[i + 1].to_string();
            i += 2;
        } else {
            i += 1;
        }

        if path.is_empty() || seen.contains(&path) {
            continue;
        }
        seen.insert(path.clone());

        let x = xy.chars().next().unwrap_or(' ');
        let y = xy.chars().nth(1).unwrap_or(' ');

        if xy == "??" {
            files.push(FileStatus {
                rel_path: path,
                status: "untracked".to_string(),
            });
        } else {
            if x != ' ' && x != '?' {
                files.push(FileStatus {
                    rel_path: path.clone(),
                    status: "staged".to_string(),
                });
            }
            if y != ' ' && y != '?' && !seen.contains(&format!("{path}:unstaged")) {
                seen.insert(format!("{path}:unstaged"));
                files.push(FileStatus {
                    rel_path: path,
                    status: "unstaged".to_string(),
                });
            }
        }
    }

    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_modified_file() {
        let output = " M src/main.rs\0";
        let result = parse_status_output(output).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].rel_path, "src/main.rs");
        assert_eq!(result[0].status, "unstaged");
    }

    #[test]
    fn parses_staged_file() {
        let output = "M  src/main.rs\0";
        let result = parse_status_output(output).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].status, "staged");
    }

    #[test]
    fn parses_untracked_file() {
        let output = "?? new_file.rs\0";
        let result = parse_status_output(output).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].status, "untracked");
    }
}
