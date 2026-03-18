/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react';

export type ThemeTokens = {
  bg?: string;
  panel?: string;
  border?: string;
  primary?: string;
};

export type AiThemeProps = {
  tokens?: ThemeTokens;
  tokensDark?: ThemeTokens;
  mode?: 'light' | 'dark' | 'auto';
  children?: React.ReactNode;
};

export function AiTheme(props: AiThemeProps) {
  const { tokens, tokensDark, mode = 'auto', children } = props;
  const [isDark, setIsDark] = React.useState<boolean>(mode === 'dark');
  React.useEffect(() => {
    if (mode !== 'auto') {
      setIsDark(mode === 'dark');
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setIsDark(!!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);
  const t = isDark ? (tokensDark ?? tokens) : tokens;
  const style: React.CSSProperties = {
    ['--ai-bg' as any]: t?.bg ?? 'transparent',
    ['--ai-panel' as any]: t?.panel ?? 'transparent',
    ['--ai-border' as any]: t?.border ?? 'rgba(0,0,0,0.1)',
    ['--ai-primary' as any]: t?.primary ?? 'inherit',
  };
  return (
    <div
      style={style}
      className={['AiTheme', 'h-full', isDark ? 'dark' : undefined]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
