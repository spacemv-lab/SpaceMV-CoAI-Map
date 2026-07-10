/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * AES-256-GCM 对称加解密 util —— 用于瓦片源凭据（如天地图 token）落库加密。
 *
 * 设计：
 * - 密钥由 env TILE_SOURCE_ENCRYPTION_KEY 提供（base64 编码的 32 字节随机串）。
 * - 每次加密生成随机 12 字节 iv + 16 字节 GCM 鉴权 tag；同明文每次密文不同。
 * - tag 提供完整性校验：错误密钥或密文被篡改时解密抛错（不静默返回垃圾数据）。
 *
 * 落库形态：{ ciphertext, iv, tag }（均 base64）整体存入 TileSource.credential (JSON)。
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedSecret {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
}

function assertKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('TILE_SOURCE_ENCRYPTION_KEY 必须是 32 字节(base64 编码)');
  }
  return key;
}

export function encryptSecret(plaintext: string, keyB64: string): EncryptedSecret {
  const key = assertKey(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptSecret(secret: EncryptedSecret, keyB64: string): string {
  const key = assertKey(keyB64);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(secret.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}
