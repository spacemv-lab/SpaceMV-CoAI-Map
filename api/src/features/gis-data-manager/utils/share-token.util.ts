/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 公开分享 token 生成工具
 *
 * 生成 url-safe 的不可猜测随机 token，作为 ProjectShare 的唯一凭证。
 * 使用 crypto.randomBytes 提供 ≥24 字节（192 bit）熵，
 * 经 base64url 编码后仅包含 [A-Za-z0-9_-]，可安全出现在 URL 路径中。
 */
import { randomBytes } from 'crypto';

/** 生成一个 url-safe 的随机分享 token（24 字节熵 → 32 字符） */
export function generateShareToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}
