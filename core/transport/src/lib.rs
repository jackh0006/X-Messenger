// SPDX-License-Identifier: AGPL-3.0-or-later
//! X Messenger offline transport: strict packets, fountain-style frames,
//! QR encode/decode. Moves opaque ciphertext only; the channel is untrusted.

#![forbid(unsafe_code)]

pub mod frames;
pub mod packet;
pub mod qr;

#[cfg(test)]
mod tests {
    use super::frames::{self, Reassembler};
    use super::packet::{Packet, PacketError, PacketType, CRC_LEN, HEADER_LEN, MAX_PAYLOAD};
    use super::qr;

    fn sample_packet() -> Packet {
        Packet {
            ptype: PacketType::Single,
            flags: 0,
            packet_id: 42,
            payload: b"hello offline".to_vec(),
        }
    }

    #[test]
    fn packet_round_trip() {
        let p = sample_packet();
        let wire = p.encode().unwrap();
        assert_eq!(Packet::decode(&wire).unwrap(), p);
    }

    #[test]
    fn packet_rejects_garbage() {
        assert!(matches!(Packet::decode(&[]), Err(PacketError::Rejected)));
        assert!(matches!(
            Packet::decode(&[0u8; 5]),
            Err(PacketError::Rejected)
        ));
        let mut wire = sample_packet().encode().unwrap();
        wire[0] = b'Z';
        assert!(matches!(Packet::decode(&wire), Err(PacketError::Rejected)));
        let mut wire = sample_packet().encode().unwrap();
        wire[3] = 99;
        assert!(matches!(Packet::decode(&wire), Err(PacketError::Rejected)));
        let mut wire = sample_packet().encode().unwrap();
        wire[4] = 77;
        assert!(matches!(Packet::decode(&wire), Err(PacketError::Rejected)));
    }

    #[test]
    fn packet_rejects_tamper_truncate_trailing() {
        let mut wire = sample_packet().encode().unwrap();
        let last = wire.len() - 1;
        wire[last] ^= 1;
        assert!(matches!(Packet::decode(&wire), Err(PacketError::Rejected)));
        let wire = sample_packet().encode().unwrap();
        assert!(matches!(
            Packet::decode(&wire[..wire.len() - 1]),
            Err(PacketError::Rejected)
        ));
        let mut wire = sample_packet().encode().unwrap();
        wire.push(0);
        assert!(matches!(Packet::decode(&wire), Err(PacketError::Rejected)));
    }

    #[test]
    fn packet_rejects_oversize_before_alloc() {
        let big = Packet {
            ptype: PacketType::Single,
            flags: 0,
            packet_id: 1,
            payload: vec![0u8; MAX_PAYLOAD + 1],
        };
        assert_eq!(big.encode().unwrap_err(), PacketError::TooLarge);
        // Forged length prefix must not cause a huge allocation.
        let mut wire = vec![0u8; HEADER_LEN + CRC_LEN];
        wire[0..3].copy_from_slice(b"XM1");
        wire[3] = 1;
        wire[4] = 2;
        wire[10..14].copy_from_slice(&u32::MAX.to_be_bytes());
        assert!(matches!(Packet::decode(&wire), Err(PacketError::TooLarge)));
    }

    #[test]
    fn frames_reassemble_shuffled_and_duplicated() {
        let data: Vec<u8> = (0..5000u32).map(|i| (i % 251) as u8).collect();
        let packets = frames::split(7, &data);
        assert!(packets.len() > 1);
        let mut order: Vec<usize> = (0..packets.len()).rev().collect();
        order.extend(0..packets.len()); // duplicates included
        let mut asm = Reassembler::new();
        let mut done = None;
        for i in order {
            let wire = packets[i].encode().unwrap();
            let back = Packet::decode(&wire).unwrap();
            if let Some(full) = asm.push(&back).unwrap() {
                done = Some(full);
            }
        }
        assert_eq!(done.unwrap(), data);
    }

    #[test]
    fn frames_incomplete_and_foreign_rejected() {
        let data = vec![9u8; 2000];
        let packets = frames::split(7, &data);
        let mut asm = Reassembler::new();
        assert!(asm.push(&packets[0]).unwrap().is_none());
        let foreign = Packet {
            ptype: PacketType::Single,
            flags: 0,
            packet_id: 0,
            payload: vec![0u8; 8],
        };
        assert!(matches!(asm.push(&foreign), Err(PacketError::Rejected)));
        let empty = frames::split(99, &[]);
        assert_eq!(empty.len(), 1);
        let mut asm2 = Reassembler::new();
        assert_eq!(asm2.push(&empty[0]).unwrap().unwrap(), Vec::<u8>::new());
    }

    #[test]
    fn qr_round_trip_small_and_medium() {
        for payload in [vec![1u8; 64], vec![2u8; 640], b"key material".to_vec()] {
            let packet = Packet {
                ptype: PacketType::Single,
                flags: 0,
                packet_id: 3,
                payload,
            };
            let frame = qr::encode_packet(&packet).unwrap();
            let back = qr::decode_pixels(&frame.pixels, frame.width, frame.height).unwrap();
            assert_eq!(back, packet);
        }
    }

    #[test]
    fn qr_full_transfer_end_to_end() {
        // 4 KiB ciphertext: split -> QR each frame -> scan each frame -> join.
        let data: Vec<u8> = (0..4096u32).map(|i| (i % 251) as u8).collect();
        let packets = frames::split(1234, &data);
        let mut asm = Reassembler::new();
        let mut done = None;
        for p in &packets {
            let frame = qr::encode_packet(p).unwrap();
            let scanned = qr::decode_pixels(&frame.pixels, frame.width, frame.height).unwrap();
            if let Some(full) = asm.push(&scanned).unwrap() {
                done = Some(full);
            }
        }
        assert_eq!(done.unwrap(), data);
    }

    #[test]
    fn qr_rejects_garbage_pixels() {
        let noise = vec![127u8; 200 * 200];
        assert!(qr::decode_pixels(&noise, 200, 200).is_err());
    }
}
