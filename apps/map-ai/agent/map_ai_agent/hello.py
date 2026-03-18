# Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
# This project is licensed under the MIT License - see the LICENSE file in the project root for details.


import os
import math
from typing import TypedDict, Optional, List, Dict, Literal
import sys
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


class AgentState(TypedDict, total=False):
    messages: List[Dict[str, str]]
    tool_result: Optional[Dict]
    intent: Optional[str]
    tools_params: Optional[Dict]


def read_env():
    p = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    try:
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k, v = s.split("=", 1)
                os.environ.setdefault(k, v)
    except Exception:
        pass
    try:
        os.environ.setdefault("PYTHONIOENCODING", "utf-8")
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="ignore")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="ignore")
    except Exception:
        pass


def stub_llm(messages: List[Dict[str, str]]) -> str:
    last = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last = m.get("content", "")
            break
    print("agent_stub_llm", {"user_len": len(last) if last else 0})
    if last:
        return "这是本地占位回复：" + last[:200]
    return "这是本地占位回复"

def get_llm() -> Optional[ChatOpenAI]:
    api_key = os.getenv("openai_api_key") or os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("openai_api_base_url")
    model = os.getenv("model") or "gpt-4o-mini"
    if not api_key or not base_url or not model:
        print("agent_llm_none")
        return None
    try:
        print("agent_llm_ready", {"model": model})
        return ChatOpenAI(api_key=api_key, base_url=base_url, model=model, temperature=0)
    except Exception:
        print("agent_llm_error")
        return None


def classify_node(state: AgentState) -> Dict:
    text = ""
    msgs = state.get("messages") or []
    for m in reversed(msgs):
        if m.get("role") == "user":
            text = m.get("content", "")
            break
    lower = text.lower()
    ks = ["geo", "地理", "地图", "范围", "缓冲", "buffer", "边界", "bbox", "热度", "heat", "isoline", "等值线"]
    intent = "geo" if any(k in text or k in lower for k in ks) or state.get("tools_params") else "chat"
    print("agent_classify", {"intent": intent})
    return {"intent": intent}


def geodesic_buffer(lat_deg: float, lon_deg: float, radius_km: float, num_points: int = 64) -> List[List[float]]:
    R = 6371.0
    lat1 = math.radians(lat_deg)
    lon1 = math.radians(lon_deg)
    d = radius_km / R
    coords: List[List[float]] = []
    for i in range(num_points):
        tc = 2 * math.pi * i / num_points
        lat2 = math.asin(math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(tc))
        lon2 = lon1 + math.atan2(
            math.sin(tc) * math.sin(d) * math.cos(lat1),
            math.cos(d) - math.sin(lat1) * math.sin(lat2),
        )
        coords.append([math.degrees(lon2), math.degrees(lat2)])
    coords.append(coords[0])
    return coords


def bbox_polygon(lat_deg: float, lon_deg: float, radius_km: float) -> List[List[float]]:
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(0.0001, math.cos(math.radians(lat_deg))))
    min_lat = lat_deg - dlat
    max_lat = lat_deg + dlat
    min_lon = lon_deg - dlon
    max_lon = lon_deg + dlon
    return [
        [min_lon, min_lat],
        [max_lon, min_lat],
        [max_lon, max_lat],
        [min_lon, max_lat],
        [min_lon, min_lat],
    ]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def grid_heat(lat_deg: float, lon_deg: float, radius_km: float, step_km: float = 10.0) -> Dict:
    dlat = step_km / 111.0
    dlon_unit = step_km / (111.0 * max(0.0001, math.cos(math.radians(lat_deg))))
    bbox = bbox_polygon(lat_deg, lon_deg, radius_km)
    min_lon = bbox[0][0]
    min_lat = bbox[0][1]
    max_lon = bbox[2][0]
    max_lat = bbox[2][1]
    features: List[Dict] = []
    sigma = max(0.001, radius_km / 2.0)
    lat = min_lat
    while lat < max_lat:
        lon = min_lon
        while lon < max_lon:
            center_lat = lat + dlat / 2
            center_lon = lon + dlon_unit / 2
            dist = haversine_km(lat_deg, lon_deg, center_lat, center_lon)
            value = math.exp(-(dist * dist) / (2 * sigma * sigma))
            poly = [
                [lon, lat],
                [lon + dlon_unit, lat],
                [lon + dlon_unit, lat + dlat],
                [lon, lat + dlat],
                [lon, lat],
            ]
            feat = {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [poly]},
                "properties": {"value": value, "center": [center_lon, center_lat]},
            }
            features.append(feat)
            lon += dlon_unit
        lat += dlat
    return {
        "type": "FeatureCollection",
        "features": features,
        "properties": {"op": "grid_heat", "center": [lon_deg, lat_deg], "radius_km": radius_km, "step_km": step_km},
    }


def geosim_tool(params: Dict) -> Dict:
    op = str(params.get("op", "bbox"))
    lat = float(params.get("lat"))
    lon = float(params.get("lon"))
    radius_km = float(params.get("radius_km", 1.0))
    if op == "buffer":
        poly = geodesic_buffer(lat, lon, radius_km)
        return {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [poly]},
            "properties": {"op": "buffer", "center": [lon, lat], "radius_km": radius_km, "points": len(poly) - 1},
        }
    if op == "bbox":
        poly = bbox_polygon(lat, lon, radius_km)
        return {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [poly]},
            "properties": {"op": "bbox", "center": [lon, lat], "radius_km": radius_km},
        }
    if op == "grid_heat":
        step_km = float(params.get("step_km", 10.0))
        return grid_heat(lat, lon, radius_km, step_km)
    return {"type": "FeatureCollection", "features": [], "properties": {"op": op, "error": "unsupported"}}


def geo_node(state: AgentState) -> Dict:
    params = state.get("tools_params")
    if not params:
        params = {"op": "bbox", "lat": 0.0, "lon": 0.0, "radius_km": 1.0}
    print("agent_geo_node_in", {"op": str(params.get("op"))})
    result = geosim_tool(params)
    msgs = state.get("messages") or []
    msgs = msgs + [{"role": "assistant", "content": "已生成地理空间模拟结果"}]
    print("agent_geo_node_out", {"type": result.get("type") if isinstance(result, dict) else None})
    return {"tool_result": result, "messages": msgs}


def chat_node(state: AgentState) -> Dict:
    msgs_dicts = state.get("messages") or []
    llm = get_llm()
    reply = ""
    if llm:
        lc_msgs = []
        for m in msgs_dicts:
            r = m.get("role")
            c = m.get("content", "")
            if r == "system":
                lc_msgs.append(SystemMessage(content=c))
            elif r == "assistant":
                lc_msgs.append(AIMessage(content=c))
            else:
                lc_msgs.append(HumanMessage(content=c))
        try:
            print("agent_chat_node_llm_in", {"len": len(lc_msgs)})
            out = llm.invoke(lc_msgs)
            reply = getattr(out, "content", "") if out else ""
            print("agent_chat_node_llm_out", {"len": len(reply)})
        except Exception:
            print("agent_chat_node_llm_err")
            reply = stub_llm(msgs_dicts)
    else:
        print("agent_chat_node_stub")
        reply = stub_llm(msgs_dicts)
    msgs = state.get("messages") or []
    msgs = msgs + [{"role": "assistant", "content": reply}]
    print("agent_chat_node_done", {"len": len(reply)})
    return {"messages": msgs}


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("classify", classify_node)
    g.add_node("chat", chat_node)
    g.add_node("geo", geo_node)
    g.add_edge(START, "classify")

    def route(s: AgentState) -> str:
        return s.get("intent", "chat")

    g.add_conditional_edges("classify", route, {"chat": "chat", "geo": "geo"})
    g.add_edge("chat", END)
    g.add_edge("geo", END)
    return g.compile()


class Message(BaseModel):
    role: Literal["user", "assistant", "system"] = "user"
    content: str


class ChatInput(BaseModel):
    messages: List[Message]
    cid: Optional[str] = None


class GeoInput(BaseModel):
    lon: float
    lat: float
    radius_km: float = Field(gt=0)
    op: Literal["buffer", "bbox", "grid_heat"] = "bbox"
    step_km: Optional[float] = Field(default=None, gt=0)
    cid: Optional[str] = None


class RunInput(BaseModel):
    input: str
    tools_params: Optional[Dict] = None
    cid: Optional[str] = None


read_env()
app = FastAPI()
thread = build_graph()

@app.get("/health")
def health():
    return {"ok": True, "llm_ready": get_llm() is not None}


@app.post("/agent/chat")
def agent_chat(payload: ChatInput):
    print("agent_chat_in", {"cid": payload.cid, "messages_len": len(payload.messages)})
    state: AgentState = {"messages": [m.model_dump() for m in payload.messages]}
    result = thread.invoke(state)
    msgs = result.get("messages") or []
    if not msgs:
        raise HTTPException(status_code=500, detail="empty")
    print("agent_chat_out", {"cid": payload.cid, "content_len": len(msgs[-1].get("content", ""))})
    return {"cid": payload.cid, "message": msgs[-1]}


@app.post("/agent/geo-sim")
def agent_geo(payload: GeoInput):
    params = payload.model_dump()
    print("agent_geo_in", {"cid": payload.cid, "op": params.get("op")})
    state: AgentState = {"messages": [{"role": "user", "content": "geo"}], "tools_params": params}
    result = thread.invoke(state)
    out = result.get("tool_result")
    print("agent_geo_out", {"cid": payload.cid, "type": out.get("type") if isinstance(out, dict) else None})
    return out


@app.post("/agent/run")
def agent_run(payload: RunInput):
    print("agent_run_in", {"panload": payload, "has_tools": bool(payload.tools_params)})
    state: AgentState = {"messages": [{"role": "user", "content": payload.input}]}
    if payload.tools_params:
        state["tools_params"] = payload.tools_params
    result = thread.invoke(state)
    if result.get("intent") == "geo":
        out = result.get("tool_result")
        print("agent_run_out_geo", {"cid": payload.cid, "type": out.get("type") if isinstance(out, dict) else None})
        return out
    msgs = result.get("messages") or []
    print("agent_run_out_chat", {"cid": payload.cid, "len": len((msgs[-1] or {}).get("content", "")) if msgs else 0})
    print("agent_run_out_chat_msgs", msgs)
    return {"cid": payload.cid, "message": msgs[-1] if msgs else {"role": "assistant", "content": ""}}


def hello():
    return "Hello"
