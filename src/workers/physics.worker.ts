/// <reference lib="webworker" />

let positions: Float32Array;
let velocities: Float32Array;
let count = 0;

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'INIT') {
    positions = new Float32Array(e.data.sharedPositions);
    velocities = new Float32Array(e.data.sharedVelocities);
    count = e.data.count;
    console.log('👷 Worker: المكن دار وجاهز للحسابات');
    loop();
  }
};

function loop() {
  for (let i = 0; i < count * 2; i += 2) {
    positions[i] += velocities[i];
    positions[i + 1] += velocities[i + 1];

    if (positions[i] > 800 || positions[i] < 0) velocities[i] *= -1;
    if (positions[i + 1] > 600 || positions[i + 1] < 0) velocities[i + 1] *= -1;
  }
  setTimeout(loop, 1000 / 60);
}