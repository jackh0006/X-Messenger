//! Minimal TLV codec for contact cards and frame headers.
//!
//! Record: tag(1) | len(>H) | value. No floats, no recursion, no allocator tricks.

/// Encode errors.
#[derive(Debug, thiserror::Error)]
pub enum EncodeError {
    /// Value too large
    #[error("value too large")]
    TooLarge,
    /// I/O
    #[error("encode failed")]
    Failed,
}

/// Decode errors.
#[derive(Debug, thiserror::Error)]
pub enum DecodeError {
    /// Truncated input
    #[error("truncated")]
    Truncated,
    /// Bad tag
    #[error("bad tag")]
    BadTag,
    /// Trailing bytes
    #[error("trailing bytes")]
    Trailing,
}

/// Encode one record.
pub fn encode(tag: u8, value: &[u8]) -> Result<alloc::vec::Vec<u8>, EncodeError> {
    if value.len() > u16::MAX as usize {
        return Err(EncodeError::TooLarge);
    }
    let mut out = alloc::vec::Vec::with_capacity(3 + value.len());
    out.push(tag);
    out.extend_from_slice(&(value.len() as u16).to_be_bytes());
    out.extend_from_slice(value);
    Ok(out)
}

/// Decode one record, returning (tag, value, rest).
pub fn decode(input: &[u8]) -> Result<(u8, &[u8], &[u8]), DecodeError> {
    if input.len() < 3 {
        return Err(DecodeError::Truncated);
    }
    let tag = input[0];
    let len = u16::from_be_bytes([input[1], input[2]]) as usize;
    if input.len() < 3 + len {
        return Err(DecodeError::Truncated);
    }
    Ok((tag, &input[3..3 + len], &input[3 + len..]))
}
