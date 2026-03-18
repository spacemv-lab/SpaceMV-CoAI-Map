/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AgentClient } from './agent.client';
import type {
  ToolEvent,
  DeltaPayload,
  FinalPayload,
  ErrorPayload,
} from '../shared';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;
  private history = new Map<string, Array<{ role: string; content: string }>>();
  private chunkSize = Number(process.env.STREAM_CHUNK_SIZE || 6);
  private layers = new Map<
    string,
    Map<
      string,
      {
        id: string;
        name?: string;
        visible: boolean;
      }
    >
  >();
  private layerData = new Map<string, Map<string, any>>();
  private name2id = new Map<string, Map<string, string>>();
  constructor(private readonly agent: AgentClient) {}

  afterInit(server: Server) {
    this.agent
      .health()
      .then((ok) => {
        if (!ok) console.warn('Agent health check failed');
        else console.log('Agent health check ok');
      })
      .catch(() => console.warn('Agent health check failed'));
  }

  handleConnection(client: Socket) {
    console.log('Connected');
    client.on('heartbeat', () => {
      try {
        client.emit('hb', {});
      } catch {
        console.warn('Heartbeat emit failed');
      }
    });
  }

  handleDisconnect(client: Socket) {
    try {
      console.log('Disconnected', { id: client.id });
    } catch {
      console.log('handleDisconnect error');
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket): { ok: boolean } {
    // console.log('handleHeartbeat');
    client.emit('hb', {});
    return { ok: true };
  }

  @SubscribeMessage('send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId?: string;
      text: string;
      toolsParams?: Record<string, unknown>;
    },
  ) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      console.log('handleSend', data);
      const cid = data.conversationId || 'global';
      if (!this.history.has(cid)) this.history.set(cid, []);
      const hist = this.history.get(cid)!;
      hist.push({ role: 'user', content: data.text });
      if (isMapStateQuery(data.text)) {
        const msg = this.describeLayers(cid);
        hist.push({ role: 'assistant', content: String(msg) });
        const finalPayload = {
          id,
          conversationId: data.conversationId,
          role: 'assistant',
          content: String(msg),
        };
        this.sendToRoomOrClient(
          client,
          data.conversationId,
          'final',
          finalPayload,
        );
        return;
      }

      const bufCmd = this.parseBufferCommand(data.text);
      if (bufCmd) {
        const { layerName, distanceMeters } = bufCmd;
        const targetId = this.getLayerIdByName(cid, layerName);
        if (!targetId) {
          const payload = {
            id,
            conversationId: data.conversationId,
            message: `未找到图层：${layerName}`,
            code: 'LAYER_NOT_FOUND',
          };
          this.sendToRoomOrClient(
            client,
            data.conversationId,
            'error',
            payload,
          );
          return;
        }
        const geo = this.getGeoByLayerId(cid, targetId);
        if (!geo) {
          const payload = {
            id,
            conversationId: data.conversationId,
            message: `图层无数据：${layerName}`,
            code: 'LAYER_DATA_NOT_FOUND',
          };
          this.sendToRoomOrClient(
            client,
            data.conversationId,
            'error',
            payload,
          );
          return;
        }
        const center = this.computeCenter(geo);
        if (!center) {
          const payload = {
            id,
            conversationId: data.conversationId,
            message: `无法解析图层中心：${layerName}`,
            code: 'CENTER_PARSE_FAILED',
          };
          this.sendToRoomOrClient(
            client,
            data.conversationId,
            'error',
            payload,
          );
          return;
        }
        const radius_km = Number(distanceMeters) / 1000;
        const toolsParams = {
          op: 'buffer',
          lat: center.lat,
          lon: center.lon,
          radius_km,
          source: { layerName, layerId: targetId },
          data: geo,
        };
        const out = await this.agent.run(data.text, toolsParams, id);
        console.log('agent.run buffer done', out);
        if (this.isGeoResult(out)) {
          const payload = {
            id,
            conversationId: data.conversationId,
            type: 'geo',
            data: out,
          };
          console.log('emit tool geo', payload);
          this.sendToRoomOrClient(client, data.conversationId, 'tool', payload);
          const name = `Buffer(${layerName})`;
          console.log('upsertLayer', { cid, id, name });
          this.upsertLayer(cid, id, { id, name, visible: true });
          return;
        }
        const msg = out?.message?.content || out?.message || '';
        hist.push({ role: 'assistant', content: String(msg) });
        console.log('stream assistant begin', {
          id,
          cid,
          len: String(msg).length,
        });
        await this.streamAssistantMessage(
          client,
          data.conversationId,
          id,
          String(msg),
        );
        return;
      }

      const schema = this.buildUiActionSchemaFromText(data.text);
      console.log('schema', schema);
      if (schema) {
        const payload = {
          id,
          conversationId: data.conversationId,
          type: 'ui_action',
          schema,
        };
        console.log('emit tool ui_action', { id, cid });
        this.sendToRoomOrClient(client, data.conversationId, 'tool', payload);
        return;
      }
      const out = await this.agent.run(data.text, data.toolsParams, id);
      if (this.isGeoResult(out)) {
        const payload = {
          id,
          conversationId: data.conversationId,
          type: 'geo',
          data: out,
        };
        this.sendToRoomOrClient(client, data.conversationId, 'tool', payload);
        this.upsertLayer(cid, id, { id, name: guessName(out), visible: true });
        return;
      }
      const msg = out?.message?.content || out?.message || '';
      hist.push({ role: 'assistant', content: String(msg) });
      console.log('stream assistant begin', {
        id,
        cid,
        len: String(msg).length,
      });
      await this.streamAssistantMessage(
        client,
        data.conversationId,
        id,
        String(msg),
      );
      console.log('stream assistant end', { id, cid });
    } catch (e: any) {
      const payload = {
        id,
        conversationId: data.conversationId,
        message: 'agent_error',
        code: 'AGENT_ERROR',
      };
      console.warn('agent.run error', { id, message: e?.message });
      this.sendToRoomOrClient(client, data.conversationId, 'error', payload);
    }
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      console.log('join', {
        cid: data.conversationId,
        rooms: Array.from(client.rooms),
      });
      client.join(data.conversationId);
      client.emit('joined', { conversationId: data.conversationId });
    }
  }

  @SubscribeMessage('geo')
  async handleGeo(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId?: string;
      params: Record<string, unknown>;
    },
  ) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      const out = await this.agent.geoSim(data.params || {}, id);
      const payload = {
        id,
        conversationId: data.conversationId,
        type: 'geo',
        data: out,
      };
      if (data.conversationId && client.rooms.has(data.conversationId))
        this.server.to(data.conversationId).emit('tool', payload);
      else client.emit('tool', payload);
      const cid = data.conversationId || 'global';
      this.upsertLayer(cid, id, { id, name: guessName(out), visible: true });
    } catch {
      const payload = {
        id,
        conversationId: data.conversationId,
        message: 'agent_error',
        code: 'AGENT_ERROR',
      };
      if (data.conversationId && client.rooms.has(data.conversationId))
        this.server.to(data.conversationId).emit('error', payload);
      else client.emit('error', payload);
    }
  }

  @SubscribeMessage('uploadGeo')
  async handleUploadGeo(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { conversationId?: string; name?: string; data: any },
  ) {
    console.log('uploadGeo', data);
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const cid = data.conversationId || 'global';
    const type = data?.data?.type;
    if (type !== 'Feature' && type !== 'FeatureCollection') {
      client.emit('error', {
        id,
        conversationId: cid,
        code: 'INVALID_GEOJSON',
        message: 'GeoJSON type must be Feature or FeatureCollection',
      });
      return;
    }
    const payload = {
      id,
      conversationId: cid,
      type: 'geo',
      data: data.data,
    };
    if (client.rooms.has(cid)) this.server.to(cid).emit('tool', payload);
    else this.server.emit('tool', payload);
    console.log('emit uploaded', { id, cid, name: data.name });
    client.emit('uploaded', { id, conversationId: cid, name: data.name });
    this.upsertLayer(cid, id, {
      id,
      name: data.name || guessName(data.data),
      visible: true,
    });
    this.upsertLayerData(cid, id, data.name || guessName(data.data), data.data);
    return { ok: true, id };
  }

  @SubscribeMessage('layer')
  handleLayer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId?: string;
      layerId: string;
      name?: string;
      visible: boolean;
    },
  ) {
    const cid = data.conversationId || 'global';
    this.upsertLayer(cid, data.layerId, {
      id: data.layerId,
      name: data.name,
      visible: data.visible,
    });
    console.log('layer', { cid, id: data.layerId, visible: data.visible });
  }

  @SubscribeMessage('uiAction')
  handleUiAction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { conversationId?: string; schema: any },
  ) {
    const cid = data.conversationId || 'global';
    const payload = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      conversationId: cid,
      type: 'ui_action',
      schema: data.schema,
    };
    if (client.rooms.has(cid)) this.server.to(cid).emit('tool', payload);
    else this.server.emit('tool', payload);
    console.log('emit uiAction tool', { cid });
    return { ok: true };
  }

  @SubscribeMessage('uiActionAck')
  handleUiActionAck(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId?: string;
      actionId: string;
      status: 'applied' | 'failed';
      message?: string;
    },
  ) {
    return { ok: true };
  }

  private ensureConvMap<T>(
    store: Map<string, Map<string, T>>,
    cid: string,
  ): Map<string, T> {
    if (!store.has(cid)) store.set(cid, new Map<string, T>());
    return store.get(cid)!;
  }

  private upsertLayer(
    cid: string,
    id: string,
    layer: { id: string; name?: string; visible: boolean },
  ) {
    const map = this.ensureConvMap(this.layers, cid);
    map.set(id, layer);
    console.log('upsertLayer', { cid, id, layer });
  }
  private upsertLayerData(
    cid: string,
    id: string,
    name: string | undefined,
    data: any,
  ) {
    const dataMap = this.ensureConvMap(this.layerData, cid);
    dataMap.set(id, data);
    if (name) {
      const n2i = this.ensureConvMap(this.name2id, cid);
      n2i.set(String(name), id);
      console.log('upsertLayerData', { cid, id, name, data });
    }
  }

  private describeLayers(cid: string): string {
    const map = this.layers.get(cid);
    if (!map || map.size === 0) return '当前地图未加载任何图层。';
    const list = Array.from(map.values());
    const total = list.length;
    const visibles = list.filter((l) => l.visible).length;
    const names = list
      .map((l) => `${l.name ?? l.id}${l.visible ? '(显示)' : '(隐藏)'}`)
      .join('，');
    return `当前地图已加载 ${total} 个图层，其中显示 ${visibles} 个：${names}`;
  }

  private getLayerIdByName(cid: string, name: string): string | undefined {
    const n2i = this.name2id.get(cid);
    if (n2i && n2i.has(name)) return n2i.get(name);
    const map = this.layers.get(cid);
    if (!map) return undefined;
    for (const [id, meta] of map.entries()) {
      if (meta.name === name) return id;
    }
    return undefined;
  }
  private getGeoByLayerId(cid: string, id: string): any | undefined {
    const dataMap = this.layerData.get(cid);
    return dataMap ? dataMap.get(id) : undefined;
  }
  private parseBufferCommand(
    text: string,
  ): { layerName: string; distanceMeters: number } | null {
    const t = (text || '').trim();
    const patterns: RegExp[] = [
      /对([^\s，。()（）]+)进行\s*(\d+(?:\.\d+)?)\s*(米|m|M|公里|km|KM)\s*缓冲(?:区)?分析/,
      /对([^\s，。()（）]+)\s*(\d+(?:\.\d+)?)\s*(米|m|M|公里|km|KM)\s*缓冲(?:区)?分析/,
      /缓冲(?:区)?分析\(\s*(\d+(?:\.\d+)?)\s*(米|m|M|公里|km|KM)\s*\)\s*针对([^\s，。()（）]+)/,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        let layerName = '';
        let distance = 0;
        if (re === patterns[2]) {
          distance = Number(m[1]);
          const unit = m[2];
          layerName = m[3];
          const meters =
            unit.toLowerCase().includes('k') || unit.includes('公里')
              ? distance * 1000
              : distance;
          return { layerName, distanceMeters: meters };
        }
        layerName = m[1];
        distance = Number(m[2]);
        const unit = m[3];
        const meters =
          unit.toLowerCase().includes('k') || unit.includes('公里')
            ? distance * 1000
            : distance;
        return { layerName, distanceMeters: meters };
      }
    }
    return null;
  }
  private computeCenter(geo: any): { lat: number; lon: number } | null {
    try {
      const collect = (g: any, acc: Array<[number, number]>) => {
        if (!g) return;
        const type = g.type;
        const coords = g.coordinates;
        if (type === 'Point') {
          acc.push([coords[0], coords[1]]);
          return;
        }
        if (type === 'LineString' || type === 'MultiPoint') {
          for (const c of coords) acc.push([c[0], c[1]]);
          return;
        }
        if (type === 'Polygon') {
          for (const ring of coords)
            for (const c of ring) acc.push([c[0], c[1]]);
          return;
        }
        if (type === 'MultiLineString') {
          for (const line of coords)
            for (const c of line) acc.push([c[0], c[1]]);
          return;
        }
        if (type === 'MultiPolygon') {
          for (const poly of coords)
            for (const ring of poly)
              for (const c of ring) acc.push([c[0], c[1]]);
          return;
        }
      };
      const acc: Array<[number, number]> = [];
      if (geo.type === 'Feature') {
        collect(geo.geometry, acc);
      } else if (
        geo.type === 'FeatureCollection' &&
        Array.isArray(geo.features)
      ) {
        for (const f of geo.features) collect(f.geometry, acc);
      } else {
        return null;
      }
      if (!acc.length) return null;
      let minLon = acc[0][0],
        maxLon = acc[0][0],
        minLat = acc[0][1],
        maxLat = acc[0][1];
      for (const [lon, lat] of acc) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      const centerLon = (minLon + maxLon) / 2;
      const centerLat = (minLat + maxLat) / 2;
      return { lat: centerLat, lon: centerLon };
    } catch {
      return null;
    }
  }
  private sendToRoomOrClient(
    client: Socket,
    conversationId: string | undefined,
    event: string,
    payload: any,
  ) {
    if (conversationId && client.rooms.has(conversationId))
      this.server.to(conversationId).emit(event, payload);
    else client.emit(event, payload);
    console.log('emit', {
      event,
      cid: conversationId || 'global',
      room: !!conversationId && client.rooms.has(conversationId),
    });
  }

  private isGeoResult(out: any): boolean {
    return (
      out &&
      typeof out === 'object' &&
      out.type &&
      (out.type === 'Feature' || out.type === 'FeatureCollection')
    );
  }

  private buildUiActionSchemaFromText(text: string): any | null {
    const t = (text || '').trim();
    const patterns: RegExp[] = [
      /(显示|隐藏)\s*(?:图层)?\s*([^\s，。]+)/,
      /(显示|隐藏)\s*([^\s，。]+)\s*图层?/,
      /(显示|隐藏)(?:图层)?([^\s，。]+)图层?/,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        const visible = m[1] === '显示';
        const name = m[2];
        return {
          actionId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          intent: 'toggleLayer',
          target: { name },
          params: { visible },
        };
      }
    }
    return null;
  }

  private async streamAssistantMessage(
    client: Socket,
    conversationId: string | undefined,
    id: string,
    msg: string,
  ) {
    const parts = splitToChunks(String(msg), this.chunkSize);
    console.log('stream parts', { id, count: parts.length });
    for (let i = 0; i < parts.length; i++) {
      await delay(80);
      const payload = {
        id,
        conversationId,
        role: 'assistant',
        delta: parts[i],
      };
      console.log('stream delta', payload);
      this.sendToRoomOrClient(client, conversationId, 'delta', payload);
    }
    await delay(50);
    const finalPayload = {
      id,
      conversationId,
      role: 'assistant',
      content: String(msg),
    };
    console.log('stream final', finalPayload);
    this.sendToRoomOrClient(client, conversationId, 'final', finalPayload);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitToChunks(s: string, n: number): string[] {
  const size = Math.ceil(s.length / n);
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

function isMapStateQuery(text: string): boolean {
  const t = (text || '').toLowerCase();
  return (
    t.includes('地图上加载了哪些数据') ||
    t.includes('地图上有什么数据') ||
    (t.includes('map') && t.includes('data') && t.includes('loaded'))
  );
}

function guessName(geo: any): string {
  if (!geo) return 'geojson';
  if (geo.type === 'Feature' && geo.properties?.name)
    return String(geo.properties.name);
  if (
    geo.type === 'FeatureCollection' &&
    Array.isArray(geo.features) &&
    geo.features[0]?.properties?.name
  )
    return String(geo.features[0].properties.name);
  return String(geo.type || 'geojson');
}
