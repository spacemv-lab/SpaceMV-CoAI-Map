/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './styles.css';
import AppRouter from './routes/index';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(<AppRouter />);
