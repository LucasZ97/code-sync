use std::time::Duration;

use crate::domain::error::{AppError, AppResult};

/// Maximum number of retry attempts.
pub const MAX_RETRIES: u32 = 3;

/// Base delay for exponential backoff (seconds).
pub const RETRY_BASE_DELAY_SECS: u64 = 1;

/// Execute an async operation with exponential backoff retry.
/// Delays: 1s, 2s, 4s (max 3 attempts).
pub async fn with_retry<F, Fut, T>(mut f: F) -> AppResult<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = AppResult<T>>,
{
    let mut last_err = AppError::Timeout("No attempts made".to_string());

    for attempt in 1..=MAX_RETRIES {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_err = e;
                if attempt < MAX_RETRIES {
                    let delay = Duration::from_secs(RETRY_BASE_DELAY_SECS * (1 << (attempt - 1)));
                    tracing::warn!(
                        "Attempt {attempt}/{MAX_RETRIES} failed: {last_err}. \
                         Retrying in {}s...",
                        delay.as_secs()
                    );
                    tokio::time::sleep(delay).await;
                } else {
                    tracing::error!("All {MAX_RETRIES} attempts failed: {last_err}");
                }
            }
        }
    }

    Err(last_err)
}
