/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import axios, { AxiosInstance } from 'axios';

export class AgentClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly http: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.AGENT_BASE_URL || 'http://127.0.0.1:8001';
    this.timeoutMs = Number(process.env.AGENT_TIMEOUT_MS || 20000);
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
    });
    this.http.interceptors.request.use((config) => {
      const ts = Date.now();
      (config as any).__ts = ts;
      console.log('agent_req', {
        url: config.url,
        method: config.method,
        baseURL: config.baseURL,
      });
      return config;
    });
    this.http.interceptors.response.use(
      (res) => {
        const ts = (res.config as any).__ts || Date.now();
        const dt = Date.now() - ts;
        console.log('agent_resp', {
          url: res.config.url,
          status: res.status,
          ms: dt,
        });
        console.log('测试热重载');
        return res;
      },
      (err) => {
        const cfg = err?.config || {};
        const ts = (cfg as any).__ts ?? Date.now();
        const dt = Date.now() - ts;
        console.warn('agent_err', {
          url: cfg?.url,
          ms: dt,
          message: err?.message,
        });
        throw err;
      },
    );
  }

  async health(): Promise<boolean> {
    try {
      const r = await this.http.get('/health');
      return r.status === 200;
    } catch {
      return false;
    }
  }

  async run(
    input: string,
    toolsParams?: Record<string, unknown>,
    cid?: string,
  ): Promise<any> {
    console.log('agent_run', { input, toolsParams, cid });
    const r = await this.http.post('/agent/run', {
      input,
      tools_params: toolsParams,
      cid,
    });
    console.log('agent_run_out', r.data);
    return r.data;
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    cid?: string,
  ): Promise<any> {
    const r = await this.http.post('/agent/chat', { messages, cid });
    return r.data;
  }

  async geoSim(params: Record<string, unknown>, cid?: string): Promise<any> {
    const r = await this.http.post('/agent/geo-sim', { ...params, cid });
    return r.data;
  }
}
