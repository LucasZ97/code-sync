use std::path::Path;

use globset::{Glob, GlobSet, GlobSetBuilder};

/// Default exclusion rules for common build artifacts.
const DEFAULT_RULES: &[&str] = &[
    "target/",
    "*.class",
    "*.jar",
    "*.war",
    "*.ear",
    "*.zip",
    "*.tar.gz",
    "*.rar",
    ".idea/",
    ".vscode/",
    "__pycache__/",
    "*.pyc",
    "node_modules/",
    ".DS_Store",
    "Thumbs.db",
];

pub struct SyncIgnoreMatcher {
    /// Patterns that match directory prefixes (end with /)
    dir_prefixes: Vec<String>,
    /// GlobSet for file patterns (matches full path)
    file_globs: GlobSet,
    /// GlobSet for filename-only patterns
    name_globs: GlobSet,
}

impl SyncIgnoreMatcher {
    pub fn new(rules: Vec<String>) -> Self {
        let mut dir_prefixes = Vec::new();
        let mut file_builder = GlobSetBuilder::new();
        let mut name_builder = GlobSetBuilder::new();

        for rule in &rules {
            if rule.ends_with('/') {
                dir_prefixes.push(rule.trim_end_matches('/').to_string());
            } else if rule.contains('/') {
                // Path-based pattern — match against full path
                if let Ok(glob) = Glob::new(rule) {
                    file_builder.add(glob);
                }
            } else {
                // Filename-only pattern — match against filename component
                if let Ok(glob) = Glob::new(rule) {
                    name_builder.add(glob);
                }
            }
        }

        let file_globs = file_builder.build().unwrap_or_else(|_| GlobSet::empty());
        let name_globs = name_builder.build().unwrap_or_else(|_| GlobSet::empty());

        Self {
            dir_prefixes,
            file_globs,
            name_globs,
        }
    }

    /// Check if a repo-relative path is excluded.
    /// Returns `Some(matched_rule)` if excluded, `None` otherwise.
    pub fn is_excluded(&self, rel_path: &str) -> Option<String> {
        // Check directory prefix rules
        for prefix in &self.dir_prefixes {
            if rel_path.starts_with(&format!("{prefix}/")) || rel_path == prefix {
                return Some(format!("{prefix}/"));
            }
        }

        // Check full-path glob rules
        if self.file_globs.is_match(rel_path) {
            return Some("(path glob match)".to_string());
        }

        // Check filename-only glob rules
        let filename = Path::new(rel_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(rel_path);

        if self.name_globs.is_match(filename) {
            return Some("(name glob match)".to_string());
        }

        None
    }

    /// Return a map of {file: matched_rule} for all excluded files.
    pub fn explain_exclusions(
        &self,
        files: &[String],
    ) -> std::collections::HashMap<String, String> {
        files
            .iter()
            .filter_map(|f| self.is_excluded(f).map(|rule| (f.clone(), rule)))
            .collect()
    }
}

/// Load syncignore rules from file + built-in defaults.
pub fn load_rules(syncignore_path: Option<&str>, repo_path: &str) -> SyncIgnoreMatcher {
    let mut rules: Vec<String> = DEFAULT_RULES.iter().map(|s| s.to_string()).collect();

    let path = if let Some(p) = syncignore_path {
        if !p.is_empty() {
            Some(std::path::PathBuf::from(p))
        } else {
            None
        }
    } else {
        None
    };

    let path = path.or_else(|| {
        let candidate = std::path::Path::new(repo_path).join(".syncignore");
        if candidate.exists() {
            Some(candidate)
        } else {
            None
        }
    });

    if let Some(p) = path {
        if let Ok(content) = std::fs::read_to_string(&p) {
            for line in content.lines() {
                let stripped = line.trim();
                if !stripped.is_empty() && !stripped.starts_with('#') {
                    rules.push(stripped.to_string());
                }
            }
            tracing::debug!("Loaded {} rules from {}", rules.len(), p.display());
        }
    }

    SyncIgnoreMatcher::new(rules)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn excludes_target_directory() {
        let matcher = load_rules(None, "/tmp");
        assert!(matcher.is_excluded("target/classes/App.class").is_some());
    }

    #[test]
    fn excludes_class_files() {
        let matcher = load_rules(None, "/tmp");
        assert!(matcher.is_excluded("src/main/App.class").is_some());
    }

    #[test]
    fn does_not_exclude_java_files() {
        let matcher = load_rules(None, "/tmp");
        assert!(matcher.is_excluded("src/main/App.java").is_none());
    }

    #[test]
    fn excludes_node_modules() {
        let matcher = load_rules(None, "/tmp");
        assert!(matcher
            .is_excluded("node_modules/lodash/index.js")
            .is_some());
    }
}
