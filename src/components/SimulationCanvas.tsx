import React, { useEffect, useRef } from 'react';

const OBJECT_COUNT = 1000;

const SimulationCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker>();

  useEffect(() => {
    if (!canvasRef.current) return;

    const sharedPositions = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 2 * OBJECT_COUNT);
    const sharedVelocities = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 2 * OBJECT_COUNT);

    const positions = new Float32Array(sharedPositions);
    const velocities = new Float32Array(sharedVelocities);

    for (let i = 0; i < OBJECT_COUNT * 2; i++) {
      positions[i] = Math.random() * 800;
      velocities[i] = (Math.random() - 0.5) * 5;
    }

    workerRef.current = new Worker(new URL('../workers/physics.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current.postMessage({
      type: 'INIT',
      sharedPositions,
      sharedVelocities,
      count: OBJECT_COUNT,
    });

    const ctx = canvasRef.current.getContext('2d');
    const render = () => {
      if (!ctx) return;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#00ffcc';
      for (let i = 0; i < OBJECT_COUNT * 2; i += 2) {
        ctx.beginPath();
        ctx.arc(positions[i], positions[i + 1], 2, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(render);
    };

    render();
    return () => workerRef.current?.terminate();
  }, []);

  return (
    <div className="flex justify-center items-center h-screen bg-black">
      <canvas ref={canvasRef} width={800} height={600} className="border border-gray-700 shadow-2xl shadow-emerald-500/20" />
    </div>
  );
};

export default SimulationCanvas;