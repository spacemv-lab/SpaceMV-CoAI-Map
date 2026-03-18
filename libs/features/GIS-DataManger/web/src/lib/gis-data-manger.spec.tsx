/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { render } from '@testing-library/react';

import GisDataManger from './gis-data-manger';

describe('GisDataManger', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<GisDataManger />);
    expect(baseElement).toBeTruthy();
  });
});
