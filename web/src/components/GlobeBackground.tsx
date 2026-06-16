/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 3D Globe 地球可视化背景组件
 * 使用原生 Three.js 实现
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// 创建地球纹理
function createEarthTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 深蓝背景
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制网格线（经纬线）
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;

  // 经线
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // 纬线
  for (let i = 0; i <= 12; i++) {
    const y = (i / 12) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 绘制一些"陆地"区域（抽象形状）
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#1a4a6e';

  // 模拟大陆块
  const continents = [
    { x: 200, y: 100, w: 300, h: 150 }, // 欧亚大陆
    { x: 100, y: 200, w: 150, h: 100 }, // 非洲
    { x: 700, y: 150, w: 200, h: 200 }, // 北美
    { x: 750, y: 300, w: 100, h: 100 }, // 南美
    { x: 850, y: 350, w: 150, h: 80 },  // 澳洲
  ];

  continents.forEach((c) => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 创建卫星粒子
function createSatellites(count: number, earthRadius: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const colorPalette = [
    new THREE.Color('#00d4ff'), // cyan
    new THREE.Color('#00ff88'), // green
    new THREE.Color('#ff6b35'), // orange
  ];

  for (let i = 0; i < count; i++) {
    // 随机球面坐标
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;

    // 卫星高度（地球半径 + 随机偏移）
    const r = earthRadius + 0.1 + Math.random() * 0.3;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    // 随机颜色
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.03,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });

  return new THREE.Points(geometry, material);
}

export function GlobeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const initializedRef = useRef<boolean>(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const atmosphereRef = useRef<THREE.Mesh | null>(null);
  const satellitesRef = useRef<THREE.Points | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 使用 ResizeObserver 监听容器尺寸变化
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || entry.contentRect.width === 0 || entry.contentRect.height === 0) {
        return; // 容器尺寸为 0，跳过
      }

      const width = entry.contentRect.width;
      const height = entry.contentRect.height;

      if (!initializedRef.current) {
        initializedRef.current = true; // 先设置标志防止竞态
        initThree(width, height);
      } else if (cameraRef.current && rendererRef.current) {
        // 尺寸变化时更新
        cameraRef.current.aspect = width / height;
        // 根据新宽度调整相机距离
        const minCameraDistance = 3.5;
        const maxCameraDistance = 5.5;
        const referenceWidth = 800;
        const cameraDistance = Math.min(maxCameraDistance, Math.max(minCameraDistance, minCameraDistance + (referenceWidth - width) / 200));
        cameraRef.current.position.set(cameraDistance, 0, cameraDistance);
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    });

    resizeObserver.observe(containerRef.current);

    function initThree(width: number, height: number) {
      if (!containerRef.current) return;

      // 创建场景
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // 创建相机 - 根据容器宽度调整相机距离，确保地球完整显示
      // 宽度越窄，相机越远，地球看起来越小
      const minCameraDistance = 3.5;  // 最小距离（宽屏）
      const maxCameraDistance = 5.5;  // 最大距离（窄屏）
      const referenceWidth = 800;     // 参考宽度
      const cameraDistance = Math.min(maxCameraDistance, Math.max(minCameraDistance, minCameraDistance + (referenceWidth - width) / 200));

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(cameraDistance, 0, cameraDistance);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;

      // 创建地球
      const earthRadius = 1;
      const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
      const earthMaterial = new THREE.MeshPhongMaterial({
        map: createEarthTexture(),
        transparent: true,
        opacity: 0.9,
        shininess: 30,
      });
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      earthRef.current = earth;
      scene.add(earth);

      // 创建大气层光晕
      const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.15, 64, 64);
      const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
      });
      const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      atmosphereRef.current = atmosphere;
      scene.add(atmosphere);

      // 创建卫星粒子
      const satellites = createSatellites(80, earthRadius);
      satellitesRef.current = satellites;
      scene.add(satellites);

      // 添加灯光
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
      directionalLight.position.set(5, 3, 5);
      scene.add(directionalLight);

      // 将 canvas 添加到容器
      containerRef.current.appendChild(renderer.domElement);

      // 动画循环
      const animate = () => {
        if (earthRef.current) {
          earthRef.current.rotation.y += 0.002;
        }
        if (satellitesRef.current) {
          satellitesRef.current.rotation.y += 0.003;
          satellitesRef.current.rotation.x += 0.001;
        }
        renderer.render(scene, camera);
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    }

    // 完整清理 Three.js 资源
    function cleanupScene() {
      if (!sceneRef.current) return;

      sceneRef.current.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose());
            } else {
              // 清理材质上的纹理
              const mat = object.material as THREE.MeshPhongMaterial;
              if (mat.map) mat.map.dispose();
              object.material.dispose();
            }
          }
        }
      });

      sceneRef.current.clear();
    }

    // 清理
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationRef.current);

      cleanupScene();

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        if (containerRef.current && rendererRef.current.domElement) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }

      // 重置所有 refs
      rendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
      earthRef.current = null;
      atmosphereRef.current = null;
      satellitesRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="globe-background absolute inset-0 w-full h-full"
    />
  );
}