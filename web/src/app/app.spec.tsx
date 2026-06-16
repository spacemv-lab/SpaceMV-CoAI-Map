/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/features/map-core', () => ({
  MapViewer: () => <div data-testid="map-viewer">Map Viewer</div>,
}));

import App from './app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeTruthy();
  });

  it('should render the map viewer', () => {
    render(<App />);
    expect(screen.getByTestId('map-viewer')).toBeTruthy();
  });
});
