/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import axios from 'axios';

describe('GET /api/health', () => {
  it('should return health status', async () => {
    const res = await axios.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.data).toEqual(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(Number),
      }),
    );
  });
});
