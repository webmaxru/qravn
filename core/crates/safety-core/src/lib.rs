#![forbid(unsafe_code)]

pub mod detect;
pub mod engine;
pub mod explain;
pub mod payload;
pub mod psl;
mod psl_data;
pub mod rules;
pub mod types;
pub mod unicode_guard;
pub mod url_policy;
pub mod verdict;

pub use engine::SafetyEngine;
pub use types::{
    AssessInput, Assessment, EngineConfig, Limitation, PayloadKind, RecommendedAction, Verdict,
};

pub const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");
