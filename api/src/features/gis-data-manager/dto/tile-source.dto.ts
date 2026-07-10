/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * 设置/更新天地图 token
 * 天地图 token 为 32 位十六进制串；此处给一个宽松的长度区间做基本校验。
 */
export class SetTiandituTokenDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  token: string;
}
