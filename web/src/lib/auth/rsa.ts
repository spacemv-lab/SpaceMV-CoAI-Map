/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * RSA 密码加密工具
 * 使用 jsencrypt 库，公钥从参考项目复用
 */

import JSEncrypt from 'jsencrypt';

// IAM 服务配套的 RSA 公钥
const PUBLIC_KEY = `MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCPqwWQEQqXfPxa3GFUvNR+1rkMXmLSlXZqeBEYrXqjCxVp+cdKIDPOKjiapW06RSuGEBWQuKwNyG1IpDRLddifZJ0TZQEd3BNkaIqfUz4RE+qhnIb48dcJQwQdiwvTfrkLCky67aczhRt8kwcOvG0dK68QVI2xKowT4BMGkowfAwIDAQAB`;

/**
 * RSA 加密密码
 * @param password 明文密码
 * @returns 加密后的字符串，或 false 表示加密失败
 */
export function encryptPassword(password: string): string | false {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(PUBLIC_KEY);
  return encryptor.encrypt(password);
}