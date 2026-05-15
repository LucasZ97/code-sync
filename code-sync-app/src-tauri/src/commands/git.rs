use tauri::State;

use crate::domain::git::apply::apply_patch;
use crate::domain::git::cmd::git_bin;
use crate::domain::git::patch::generate_patch;
use crate::domain::git::status::get_status;
use crate::domain::types::{ApplyResult, FileStatus, GeneratedPatch, PatchDiff};
use crate::state::AppState;

/// Validate that `patch_path` is a real file that lives inside the expected
/// patches directory (`~/.config/codesync/patches/`).
///
/// Returns the canonicalized path string on success, or an error message.
fn validate_patch_path(patch_path: &str) -> Result<String, String> {
    let path = std::path::Path::new(patch_path);

    // Must exist and be a file before we can canonicalize.
    if !path.exists() {
        return Err(format!("Patch file not found: '{patch_path}'"));
    }
    if !path.is_file() {
        return Err(format!("Patch path is not a file: '{patch_path}'"));
    }

    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Cannot canonicalize patch path '{patch_path}': {e}"))?;

    // Determine the expected patches directory and canonicalize it too.
    let patches_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("codesync")
        .join("patches");

    // The patches directory may not exist yet; create it so we can canonicalize.
    std::fs::create_dir_all(&patches_dir).map_err(|e| format!("Cannot create patches dir: {e}"))?;

    let canonical_patches_dir = patches_dir
        .canonicalize()
        .map_err(|e| format!("Cannot canonicalize patches dir: {e}"))?;

    if !canonical.starts_with(&canonical_patches_dir) {
        return Err(format!(
            "Patch path '{}' is outside the allowed patches directory '{}'",
            canonical.display(),
            canonical_patches_dir.display()
        ));
    }

    Ok(canonical.to_string_lossy().into_owned())
}

/// Get the git status for a project.
#[tauri::command]
pub async fn git_status(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<FileStatus>, String> {
    let config = state.config.lock().await;
    let project = config
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{project_id}' not found"))?;

    let repo_path = project.local_repo_path.clone();
    drop(config);

    tokio::task::spawn_blocking(move || get_status(&repo_path).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}

/// Generate a patch for a project.
#[tauri::command]
pub async fn patch_generate(
    project_id: String,
    files: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<GeneratedPatch, String> {
    let config = state.config.lock().await;
    let project = config
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{project_id}' not found"))?
        .clone();
    drop(config);

    let output_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("codesync")
        .join("patches");

    let repo_path = project.local_repo_path.clone();
    let proj_id = project.id.clone();
    let proj_name = project.name.clone();
    let output_dir_str = output_dir.to_string_lossy().into_owned();
    let syncignore = if project.syncignore_path.is_empty() {
        None
    } else {
        Some(project.syncignore_path.clone())
    };
    let encoding_hint = if project.source_encoding_hint.is_empty() {
        None
    } else {
        Some(project.source_encoding_hint.clone())
    };

    tokio::task::spawn_blocking(move || {
        generate_patch(
            &repo_path,
            &proj_id,
            &proj_name,
            &output_dir_str,
            files.as_deref(),
            syncignore.as_deref(),
            encoding_hint.as_deref(),
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

/// Apply a patch to a project.
#[tauri::command]
pub async fn patch_apply(
    patch_path: String,
    project_id: String,
    state: State<'_, AppState>,
) -> Result<ApplyResult, String> {
    let config = state.config.lock().await;
    let project = config
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{project_id}' not found"))?
        .clone();
    drop(config);

    let repo_path = project.local_repo_path.clone();
    let proj_id = project.id.clone();

    // Validate patch_path before entering the blocking thread.
    let safe_patch_path = validate_patch_path(&patch_path)?;

    tokio::task::spawn_blocking(move || {
        apply_patch(&safe_patch_path, &repo_path, Some(&proj_id)).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

/// Get the diff for the current working tree of a project.
#[tauri::command]
pub async fn patch_diff(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<PatchDiff, String> {
    let config = state.config.lock().await;
    let project = config
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project '{project_id}' not found"))?
        .clone();
    drop(config);

    let repo_path = project.local_repo_path.clone();

    tokio::task::spawn_blocking(move || {
        let output = std::process::Command::new(git_bin())
            .args(["diff", "HEAD", "--no-color"])
            .current_dir(&repo_path)
            .output()
            .map_err(|e| format!("Failed to run git diff: {e}"))?;

        let diff_text = String::from_utf8_lossy(&output.stdout).into_owned();

        Ok(PatchDiff {
            patch_name: format!("{project_id}-current"),
            diff_text,
            conflict_files: Vec::new(),
        })
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}
