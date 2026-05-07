import { Day1Scene }    from './scenes/Day1Scene.js';
import { SummaryScene } from './scenes/SummaryScene.js';

const TILE_SIZE = 48;

function getGameDimensions() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const tilesX = Math.max(15, Math.floor(w / TILE_SIZE));
  const tilesY = Math.max(10, Math.floor(h / TILE_SIZE));

  return {
    width: tilesX * TILE_SIZE,
    height: tilesY * TILE_SIZE,
    tilesX,
    tilesY,
  };
}

const dims = getGameDimensions();

const config = {
  type: Phaser.AUTO,
  width:  dims.width,
  height: dims.height,
  backgroundColor: '#060810',
  scene: [Day1Scene, SummaryScene],
  parent: document.getElementById('game-wrapper'),
  pixelArt: false,
  antialias: true,
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  const newDims = getGameDimensions();
  game.scale.resize(newDims.width, newDims.height);
  game.scene.scenes.forEach(scene => {
    if (scene.onWindowResize) {
      scene.onWindowResize(newDims);
    }
  });
});
