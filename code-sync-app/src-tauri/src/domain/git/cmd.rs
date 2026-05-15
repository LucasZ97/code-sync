/// Resolve the path to the `git` executable.
///
/// macOS GUI apps launch with a minimal PATH (`/usr/bin:/bin`) that does not
/// include Homebrew (`/opt/homebrew/bin`) or other package managers.  This
/// function probes a list of well-known locations and falls back to the bare
/// name `"git"` so the OS can still find it if it happens to be on PATH.
///
/// The result is cached in a `OnceLock` so the probe only runs once.
pub fn git_bin() -> &'static str {
    use std::sync::OnceLock;
    static GIT: OnceLock<String> = OnceLock::new();

    GIT.get_or_init(|| {
        // Ordered by likelihood on macOS / Linux developer machines.
        let candidates = [
            "/opt/homebrew/bin/git",  // Homebrew on Apple Silicon
            "/usr/local/bin/git",     // Homebrew on Intel Mac / Linux
            "/usr/bin/git",           // Xcode CLT / system git
            "/usr/local/git/bin/git", // Git installer for macOS
            "git",                    // last resort: rely on PATH
        ];

        for candidate in candidates {
            if candidate == "git" {
                return candidate.to_string();
            }
            if std::path::Path::new(candidate).exists() {
                tracing::debug!("Using git at: {candidate}");
                return candidate.to_string();
            }
        }

        "git".to_string()
    })
}

/// Resolve the path to the `patch` executable.
///
/// On macOS the system `patch` lives at `/usr/bin/patch` which is always
/// available, but we probe explicitly so the path is absolute and unambiguous.
pub fn patch_bin() -> &'static str {
    use std::sync::OnceLock;
    static PATCH: OnceLock<String> = OnceLock::new();

    PATCH.get_or_init(|| {
        let candidates = [
            "/usr/bin/patch",          // macOS / Linux system
            "/opt/homebrew/bin/patch", // Homebrew (GNU patch)
            "/usr/local/bin/patch",
            "patch",
        ];

        for candidate in candidates {
            if candidate == "patch" {
                return candidate.to_string();
            }
            if std::path::Path::new(candidate).exists() {
                tracing::debug!("Using patch at: {candidate}");
                return candidate.to_string();
            }
        }

        "patch".to_string()
    })
}
