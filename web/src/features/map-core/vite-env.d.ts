/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/// <reference types="vite/client" />

// Declare SVG raw imports (returns string content)
declare module '*.svg?raw' {
  const content: string;
  export default content;
}

// Declare SVG URL imports (returns URL string)
declare module '*.svg?url' {
  const content: string;
  export default content;
}

// Declare SVG default imports (returns URL for use as img src)
declare module '*.svg' {
  const content: string;
  export default content;
}