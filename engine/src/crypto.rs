//! Sealing. Two formats, both standard base64:
//!   0x01 | nonce(12) | ChaCha20-Poly1305(ct+tag)            symmetric, made by the engine
//!   0x02 | eph_pk(32) | ChaCha20-Poly1305(ct+tag)           X25519 ECIES to a public key
//! No randomness is needed inside the TEE: symmetric nonces are derived (SIV-style) and ECIES
//! ephemeral keys are either derived from the engine key per request or supplied by the caller
//! (local tools pass fresh random bytes).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};

type HmacSha256 = Hmac<Sha256>;

const AAD_SYM: &[u8] = b"takara-ai/sym/v1";
const AAD_ECIES: &[u8] = b"takara-ai/ecies/v1";

pub fn sha256(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

pub fn sha256_hex(data: &[u8]) -> String {
    hex::encode(sha256(data))
}

pub fn hmac(key: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut m = <HmacSha256 as Mac>::new_from_slice(key).expect("hmac accepts any key length");
    for p in parts {
        m.update(p);
    }
    m.finalize().into_bytes().into()
}

fn hkdf32(ikm: &[u8], info: &[&[u8]]) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(Some(b"takara-ai/v1"), ikm);
    let mut okm = [0u8; 32];
    let info: Vec<u8> = info.concat();
    hk.expand(&info, &mut okm).expect("32 bytes is a valid hkdf length");
    okm
}

pub fn parse_key32(hex_str: &str) -> Option<[u8; 32]> {
    let b = hex::decode(hex_str.trim()).ok()?;
    b.try_into().ok()
}

pub struct Keys {
    sk: StaticSecret,
    pub pk: [u8; 32],
    seal: [u8; 32],
    evidence: [u8; 32],
}

impl Keys {
    pub fn from_hex(h: &str) -> Option<Self> {
        let raw = parse_key32(h)?;
        let sk = StaticSecret::from(raw);
        let pk = PublicKey::from(&sk).to_bytes();
        Some(Self { sk, pk, seal: hkdf32(&raw, &[b"seal"]), evidence: hkdf32(&raw, &[b"evidence"]) })
    }

    pub fn pk_hex(&self) -> String {
        hex::encode(self.pk)
    }

    /// Keyed derivations (vendor refs, evidence hashes, salts, ephemeral keys).
    pub fn derive(&self, label: &str, data: &[u8]) -> [u8; 32] {
        hmac(&self.seal, &[label.as_bytes(), b":", data])
    }

    pub fn evidence_hash(&self, doc_sha256_hex: &str) -> String {
        hex::encode(hmac(&self.evidence, &[doc_sha256_hex.as_bytes()]))
    }

    pub fn seal(&self, pt: &[u8]) -> String {
        let n = hmac(&self.seal, &[b"nonce", pt]);
        let nonce = Nonce::from_slice(&n[..12]);
        let ct = ChaCha20Poly1305::new(Key::from_slice(&self.seal))
            .encrypt(nonce, Payload { msg: pt, aad: AAD_SYM })
            .expect("encryption cannot fail for in-memory buffers");
        let mut out = Vec::with_capacity(1 + 12 + ct.len());
        out.push(1);
        out.extend_from_slice(&n[..12]);
        out.extend_from_slice(&ct);
        B64.encode(out)
    }

    /// Opens a blob this engine sealed itself (records, outflow, refusal details).
    pub fn open_sym(&self, sealed: &str) -> Option<Vec<u8>> {
        let b = B64.decode(sealed.trim()).ok()?;
        if b.first() != Some(&1) {
            return None;
        }
        self.open(sealed)
    }

    /// Opens a blob sealed TO this engine by an outsider (claims, the policy bundle).
    pub fn open_ecies(&self, sealed: &str) -> Option<Vec<u8>> {
        let b = B64.decode(sealed.trim()).ok()?;
        if b.first() != Some(&2) {
            return None;
        }
        self.open(sealed)
    }

    /// Opens either format (owner tools only).
    pub fn open(&self, sealed: &str) -> Option<Vec<u8>> {
        let b = B64.decode(sealed.trim()).ok()?;
        match b.first()? {
            1 if b.len() > 13 => ChaCha20Poly1305::new(Key::from_slice(&self.seal))
                .decrypt(Nonce::from_slice(&b[1..13]), Payload { msg: &b[13..], aad: AAD_SYM })
                .ok(),
            2 if b.len() > 33 => {
                let eph_pk: [u8; 32] = b[1..33].try_into().ok()?;
                let shared = self.sk.diffie_hellman(&PublicKey::from(eph_pk));
                let (key, nonce) = ecies_key(shared.as_bytes(), &eph_pk, &self.pk);
                ChaCha20Poly1305::new(Key::from_slice(&key))
                    .decrypt(Nonce::from_slice(&nonce), Payload { msg: &b[33..], aad: AAD_ECIES })
                    .ok()
            }
            _ => None,
        }
    }
}

fn ecies_key(shared: &[u8], eph_pk: &[u8; 32], recipient_pk: &[u8; 32]) -> ([u8; 32], [u8; 12]) {
    let key = hkdf32(shared, &[b"ecies-key", eph_pk, recipient_pk]);
    let n = hkdf32(shared, &[b"ecies-nonce", eph_pk, recipient_pk]);
    let mut nonce = [0u8; 12];
    nonce.copy_from_slice(&n[..12]);
    (key, nonce)
}

/// ECIES seal to `recipient_pk` using ephemeral secret `eph`.
pub fn seal_to(recipient_pk: &[u8; 32], eph: [u8; 32], pt: &[u8]) -> String {
    let eph_sk = StaticSecret::from(eph);
    let eph_pk = PublicKey::from(&eph_sk).to_bytes();
    let shared = eph_sk.diffie_hellman(&PublicKey::from(*recipient_pk));
    let (key, nonce) = ecies_key(shared.as_bytes(), &eph_pk, recipient_pk);
    let ct = ChaCha20Poly1305::new(Key::from_slice(&key))
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: pt, aad: AAD_ECIES })
        .expect("encryption cannot fail for in-memory buffers");
    let mut out = Vec::with_capacity(33 + ct.len());
    out.push(2);
    out.extend_from_slice(&eph_pk);
    out.extend_from_slice(&ct);
    B64.encode(out)
}

/// Open an ECIES blob with an arbitrary X25519 secret (agent payout key, local tools).
pub fn open_with(sk_raw: [u8; 32], sealed: &str) -> Option<Vec<u8>> {
    let sk = StaticSecret::from(sk_raw);
    let pk = PublicKey::from(&sk).to_bytes();
    let b = B64.decode(sealed.trim()).ok()?;
    if b.first() != Some(&2) || b.len() <= 33 {
        return None;
    }
    let eph_pk: [u8; 32] = b[1..33].try_into().ok()?;
    let shared = sk.diffie_hellman(&PublicKey::from(eph_pk));
    let (key, nonce) = ecies_key(shared.as_bytes(), &eph_pk, &pk);
    ChaCha20Poly1305::new(Key::from_slice(&key))
        .decrypt(Nonce::from_slice(&nonce), Payload { msg: &b[33..], aad: AAD_ECIES })
        .ok()
}

pub fn public_key_of(sk_raw: [u8; 32]) -> [u8; 32] {
    PublicKey::from(&StaticSecret::from(sk_raw)).to_bytes()
}
