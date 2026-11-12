//! Step 0 probe contract (throwaway).
//!
//! Proves the trust path the treasury will rely on:
//!   1. this contract, not an off-chain party, calls `outlayer.testnet`
//!   2. it names the exact wasm sha256 to run (OutLayer refuses any other bytes)
//!   3. the result comes back only through this contract's own private callback
//!
//! Only the owner may change the pinned engine. Anyone may trigger a run (it is a probe).

use near_sdk::json_types::U64;
use near_sdk::serde_json::{self, json};
use near_sdk::{
    env, log, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseResult,
};

const GAS_FOR_OUTLAYER: Gas = Gas::from_tgas(150);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(30);

#[near(serializers = [json])]
#[derive(Clone)]
pub struct PinnedEngine {
    pub wasm_url: String,
    pub wasm_hash: String, // lowercase hex sha256
    pub build_target: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct RunRecord {
    pub request_no: U64,
    pub wasm_hash: String,
    pub input: String,
    pub ok: bool,
    pub output: String,
    pub block_height: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Probe {
    owner: AccountId,
    outlayer: AccountId,
    wasm_url: String,
    wasm_hash: String,
    build_target: String,
    next_request: u64,
    last: Option<RunRecord>,
}

#[near]
impl Probe {
    #[init]
    pub fn new(owner: AccountId, outlayer: AccountId, engine: PinnedEngine) -> Self {
        Self {
            owner,
            outlayer,
            wasm_url: engine.wasm_url,
            wasm_hash: engine.wasm_hash.to_lowercase(),
            build_target: engine.build_target,
            next_request: 0,
            last: None,
        }
    }

    pub fn set_engine(&mut self, engine: PinnedEngine) {
        require!(env::predecessor_account_id() == self.owner, "E_NOT_OWNER");
        self.wasm_url = engine.wasm_url;
        self.wasm_hash = engine.wasm_hash.to_lowercase();
        self.build_target = engine.build_target;
        log!("EVENT_JSON:{}", json!({"event":"engine_pinned","wasm_hash":self.wasm_hash}));
    }

    /// Ask OutLayer to run the pinned engine. Attach NEAR for the execution fee;
    /// unused deposit is refunded by OutLayer to this contract (payer).
    #[payable]
    pub fn run(&mut self, input: String) -> Promise {
        let deposit = env::attached_deposit();
        require!(deposit > NearToken::from_yoctonear(0), "E_DEPOSIT_REQUIRED");
        let request_no = self.next_request;
        self.next_request += 1;

        let args = json!({
            "source": { "WasmUrl": {
                "url": self.wasm_url,
                "hash": self.wasm_hash,
                "build_target": self.build_target,
            }},
            "resource_limits": {
                "max_instructions": 1_000_000_000u64,
                "max_memory_mb": 128u32,
                "max_execution_seconds": 30u64,
            },
            "input_data": input,
            "response_format": "Text",
            "payer_account_id": env::current_account_id(),
        });

        log!("EVENT_JSON:{}", json!({"event":"engine_requested","request_no":request_no,"wasm_hash":self.wasm_hash}));

        Promise::new(self.outlayer.clone())
            .function_call(
                "request_execution".to_string(),
                serde_json::to_vec(&args).unwrap(),
                deposit,
                GAS_FOR_OUTLAYER,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_result(U64(request_no), self.wasm_hash.clone(), input),
            )
    }

    /// Only reachable as this contract's own callback (#[private]).
    #[private]
    pub fn on_result(&mut self, request_no: U64, wasm_hash: String, input: String) -> RunRecord {
        let (ok, output) = match env::promise_result(0) {
            PromiseResult::Successful(bytes) => (true, String::from_utf8_lossy(&bytes).into_owned()),
            PromiseResult::Failed => (false, "promise_failed".to_string()),
        };
        let rec = RunRecord {
            request_no,
            wasm_hash,
            input,
            ok,
            output,
            block_height: U64(env::block_height()),
        };
        log!("EVENT_JSON:{}", json!({"event":"engine_result","request_no":request_no,"ok":ok,"output":rec.output}));
        self.last = Some(rec.clone());
        rec
    }

    pub fn get_last(&self) -> Option<RunRecord> {
        self.last.clone()
    }

    pub fn get_engine(&self) -> PinnedEngine {
        PinnedEngine {
            wasm_url: self.wasm_url.clone(),
            wasm_hash: self.wasm_hash.clone(),
            build_target: self.build_target.clone(),
        }
    }
}
