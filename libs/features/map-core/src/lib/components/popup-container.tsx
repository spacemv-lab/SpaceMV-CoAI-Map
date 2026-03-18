/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useMapStore } from '../store/use-map-store';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

export function PopupContainer() {
  const popups = useMapStore((state) => state.popups);
  const removePopup = useMapStore((state) => state.removePopup);
  const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer }).CESIUM_VIEWER;
  
  // We need to update popup positions on map move
  // But for simplicity, we can just use absolute positioning if we had screen coordinates.
  // Since popups are geo-located, we need to project them to screen coordinates.
  
  // A better approach for React + Cesium popups is to update their position on each render frame or Scene PostRender.
  
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<string, {x: number, y: number}>>(new Map());

  useEffect(() => {
    if (!viewer) return;
    
    const scene = viewer.scene;
    
    const updatePositions = () => {
        let changed = false;
        popups.forEach(popup => {
            const cartesian = Cesium.Cartesian3.fromDegrees(popup.position[0], popup.position[1]);
            const canvasPosition = Cesium.SceneTransforms.worldToWindowCoordinates(scene, cartesian);
            
            if (canvasPosition) {
                const current = positionsRef.current.get(popup.id);
                if (!current || current.x !== canvasPosition.x || current.y !== canvasPosition.y) {
                    positionsRef.current.set(popup.id, canvasPosition);
                    changed = true;
                }
            } else {
                 // Off screen?
                 if (positionsRef.current.has(popup.id)) {
                     positionsRef.current.delete(popup.id);
                     changed = true;
                 }
            }
        });
        
        if (changed) {
            // Force re-render to update DOM styles
            // Actually, manipulating DOM directly is faster for high freq updates
            popups.forEach(popup => {
                const el = document.getElementById(`popup-${popup.id}`);
                const pos = positionsRef.current.get(popup.id);
                if (el && pos) {
                    el.style.display = 'block';
                    el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%) translate(0, -10px)`; // Centered above
                } else if (el) {
                    el.style.display = 'none';
                }
            });
        }
    };

    const listener = scene.postRender.addEventListener(updatePositions);
    
    return () => {
        listener();
    };
  }, [viewer, popups]);

  if (popups.length === 0) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {popups.map((popup) => (
        <div
          key={popup.id}
          id={`popup-${popup.id}`}
          className="absolute bg-white rounded shadow-lg p-3 pointer-events-auto min-w-[200px] transition-opacity"
          style={{ display: 'none', left: 0, top: 0 }} // Initial hidden, updated by PostRender
        >
          <div className="flex justify-between items-start mb-2 border-b pb-1">
            <h3 className="font-bold text-sm text-gray-800">{popup.layerName || 'Feature Details'}</h3>
            <button 
                onClick={() => removePopup(popup.id)}
                className="text-gray-400 hover:text-gray-600"
            >
                <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs space-y-1 max-h-[200px] overflow-auto">
            {Object.entries(popup.properties).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2">
                    <span className="text-gray-500 font-medium truncate" title={key}>{key}:</span>
                    <span className="text-gray-800 truncate" title={String(value)}>{String(value)}</span>
                </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
