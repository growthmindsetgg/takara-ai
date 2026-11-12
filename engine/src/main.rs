//! Takara AI policy engine (OutLayer WASM, wasm32-wasip1).
//!
//! Reads one JSON request on stdin, writes one JSON answer on stdout (OutLayer caps stdout at
//! 900 bytes, so contract-facing answers use compact keys). The engine key arrives as the
//! OutLayer secret `TAKARA_ENGINE_SK`, bound to this exact wasm hash and readable only by the
//! treasury contract's requests.

mod crypto;
mod engine;
mod model;

#[cfg(test)]
mod tests;

use std::io::{self, Read, Write};

fn main() {
    let mut input = String::new();
    let out = if io::stdin().read_to_string(&mut input).is_err() {
        r#"{"v":1,"ok":false,"reason":"stdin_unreadable"}"#.to_string()
    } else {
        engine::handle(&input, std::env::var("TAKARA_ENGINE_SK").ok().filter(|s| !s.is_empty()))
    };
    let mut stdout = io::stdout();
    let _ = stdout.write_all(out.as_bytes());
    let _ = stdout.flush();
}
