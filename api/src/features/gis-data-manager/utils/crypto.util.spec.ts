/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { randomBytes } from 'crypto';
import { encryptSecret, decryptSecret } from './crypto.util';

describe('crypto.util (AES-256-GCM)', () => {
  const key = randomBytes(32).toString('base64');

  it('加解密往返还原原文(含中文)', () => {
    const secret = encryptSecret('hello-天地图-token-1234567890', key);
    expect(decryptSecret(secret, key)).toBe('hello-天地图-token-1234567890');
  });

  it('每次加密 iv 不同 → 密文不同(同明文)', () => {
    const a = encryptSecret('same-secret', key);
    const b = encryptSecret('same-secret', key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    // 但都能解回原文
    expect(decryptSecret(a, key)).toBe('same-secret');
    expect(decryptSecret(b, key)).toBe('same-secret');
  });

  it('错误密钥 → 解密抛错(GCM 鉴权失败)', () => {
    const secret = encryptSecret('secret-value', key);
    const wrongKey = randomBytes(32).toString('base64');
    expect(() => decryptSecret(secret, wrongKey)).toThrow();
  });

  it('密文/tag 被篡改 → 解密抛错(完整性校验)', () => {
    const secret = encryptSecret('secret-value', key);
    const tamperedTag: typeof secret = {
      ...secret,
      tag: randomBytes(16).toString('base64'),
    };
    expect(() => decryptSecret(tamperedTag, key)).toThrow();
  });

  it('密钥非 32 字节 → 加解密均抛错', () => {
    const badKey = randomBytes(16).toString('base64');
    expect(() => encryptSecret('x', badKey)).toThrow(/32 字节/);
  });
});
