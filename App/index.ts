import {
  PerspectiveCamera,
  WebGLRenderer,
  DirectionalLight,
  Scene,
  Mesh,
  EquirectangularReflectionMapping,
  MeshStandardMaterial,
  Raycaster,
  Vector2,
  PCFSoftShadowMap,
  ACESFilmicToneMapping,
  PlaneGeometry,
  Vector3,
  Group,
  Shape,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  AnimationMixer,
  AnimationAction,
  TextureLoader,
  SRGBColorSpace,
} from 'three';

import * as constants from  "./constants";
import demoTemplates from "./templates/demo.json";
import type { BlockConfig, ObjPool } from "./types/global";
import  Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { castShadow, getNewBlockPos, getNewMeshPos, getNewMeshRot, getOldBlockPos, normalizeBlock } from './utils';

const gui = new GUI();
const GL = new GLTFLoader();
const RL = new RGBELoader();
const TL = new TextureLoader();

const gridSize = 2;
const sandboxSize = 40;

export default class App {
  private _renderer: WebGLRenderer;
  private _camera: PerspectiveCamera;
  private _meshSteve: Group;
  private _meshSteveHead: Mesh;
  private _steveWalkMixer: AnimationMixer;
  private _steveWalkAction: AnimationAction;
  private _lastWalkTimeMs: number = 0;

  private _stats: Stats;
  private _scene: Scene;
  private _mouse: Vector2;
  private _raycaster: Raycaster;
  private _blocks: Record<string, ObjPool> = {};
  private _collisionMeshes: ObjPool;
  private _highlighter: Line<BufferGeometry, LineBasicMaterial>;
  private _destroyMode: boolean = false;
  private _blockOptions: string[] = [];
  private _selectedBlock: string;
  private _template: string = "Pick a template";
  private _audio: Record<string, HTMLAudioElement> = {};

  constructor() {
    this._scene = new Scene();
    this._stats = new Stats();
    this._raycaster = new Raycaster();
    this._mouse = new Vector2(-1000, -1000);
    document.body.appendChild(this._stats.dom);
    this._init();
  }

  _init() {
    this._renderer = new WebGLRenderer({
      canvas: document.getElementById('canvas') as HTMLCanvasElement,
      antialias: true,
    });
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = PCFSoftShadowMap;
    this._renderer.toneMapping = ACESFilmicToneMapping;
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const aspect = window.innerWidth / window.innerHeight;
    this._camera = new PerspectiveCamera(70, aspect, 0.1, 100);
    this._camera.position.set(0, 0, 5);
    new OrbitControls(this._camera, this._renderer.domElement);

    this._initEvents();
    this._initAudio();
    this._initLights();
    this._initEnvironment();
    this._initFloor();
    this._initCollisionMeshes();
    this._initHighlighter();
    this._initBlocks();
    this._createSteve();
    this._initGui();
    this._render();
    this._animate();
  }

  _initAudio() {
    this._audio.spawnBlock = new Audio('/audio/spawn_block.mp3');
  }

  _initHighlighter() {
    const lineMaterial = new LineBasicMaterial({ color: 0x000000 });
    const outlineShape = new Shape();
    outlineShape.moveTo(-1, -1);
    outlineShape.lineTo(1, -1);
    outlineShape.lineTo(1, 1);
    outlineShape.lineTo(-1, 1);
    outlineShape.lineTo(-1, -1);
    const outlineGeometry = new BufferGeometry().setFromPoints(outlineShape.getPoints());
    const outlineMesh = new Line(outlineGeometry, lineMaterial);
    outlineMesh.rotation.x = -Math.PI * 0.5;
    outlineMesh.position.set(0, -2.1, 0);
    this._scene.add(outlineMesh);
    this._highlighter = outlineMesh;
  }

  _initCollisionMeshes() {
    const geo = new PlaneGeometry(gridSize, gridSize);
    const mat = new MeshStandardMaterial({ color: 0xffffff });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.position.y = -2;
    mesh.visible = false;
    this._collisionMeshes = { mesh: mesh, instances: [] }

    for (let i=0; i<sandboxSize; i+=gridSize) {
      for (let j=0; j<sandboxSize; j+=gridSize) {
        const newMesh = mesh.clone();
        newMesh.position.x = -sandboxSize/2 + gridSize/2 + i;
        newMesh.position.z = -sandboxSize/2 + gridSize/2 + j;
        newMesh.userData = { meshOrientation: constants.MeshOrientation.TOP };
        this._collisionMeshes.instances.push(newMesh);
        this._scene.add(newMesh);
      }
    }
  }

  _initBlocks() {
    this._initBlock('/models/minecraft_grass_block.glb', 'dirt');
    this._initBlock('/models/minecraft_stone_block.glb', 'stone');
    this._initBlock('/models/minecraft_diamond_block.glb', 'diamond');
    this._initBlock('/models/minecraft_obsidian_block.glb', 'obsidian');
    this._initBlock('/models/minecraft_oakplank_block.glb', 'oak_plank');
  }

  _initBlock(modelPath: string, blockName: string) {
    GL.load(modelPath, (model) => {
      const block = normalizeBlock(model.scene, gridSize);
      castShadow(block);
      this._blocks[blockName] = { mesh: block, instances: [] };
    });
    this._blockOptions.push(blockName);
    this._selectedBlock = this._selectedBlock || blockName;
  }

  _spawnBlock(meshPos: Vector3, meshOrienation: constants.MeshOrientation, blockName: string) {
    const blockPos = getNewBlockPos(meshPos, meshOrienation, gridSize);
    const newBlock = this._blocks[blockName].mesh.clone() as Group;
    newBlock.userData.collisionMeshes = [];
    
    newBlock.position.copy(blockPos);
    this._scene.add(newBlock);
    this._blocks[blockName].instances.push(newBlock);

    for (let orientation=0; orientation<6; orientation++) {
      const collisionMesh = this._collisionMeshes.mesh.clone() as Mesh;
      collisionMesh.position.copy(getNewMeshPos(blockPos, orientation, gridSize));
      collisionMesh.rotation.setFromVector3(getNewMeshRot(orientation));
      collisionMesh.userData = { meshOrientation: orientation };
      this._collisionMeshes.instances.push(collisionMesh);
      this._scene.add(collisionMesh);
      newBlock.userData.collisionMeshes.push(collisionMesh);
    }
    this._audio.spawnBlock.play();
  }

  _destroyBlock(meshPos: Vector3, meshOrienation: constants.MeshOrientation, blockName: string) {
    const blockPos = getOldBlockPos(meshPos, meshOrienation, gridSize);
    const blockIndex = this._blocks[blockName].instances.findIndex((block) => block.position.equals(blockPos));
    if (blockIndex === -1) return;
    const block = this._blocks[blockName].instances[blockIndex];
    this._blocks[blockName].instances.splice(blockIndex, 1);
    this._scene.remove(block);

    for (const collisionMesh of block.userData.collisionMeshes) {
      const collisionMeshIndex = this._collisionMeshes.instances.findIndex((mesh) => mesh.uuid === collisionMesh.uuid);
      this._collisionMeshes.instances.splice(collisionMeshIndex, 1);
      this._scene.remove(collisionMesh);
    }
    this._updateHighlighter();
    this._audio.spawnBlock.play();
  }

  _createSteve() {
    GL.load('/models/steve.glb', (model) => {
      const steve = model.scene;
      steve.scale.setScalar(1.5);
      steve.position.y -= 2;
      castShadow(steve);
      steve.traverse((child) => {
          if (child.name === constants.HEAD) this._meshSteveHead = child as Mesh;
      });
      this._scene.add(steve);
      this._meshSteve = steve;
      this._steveWalkMixer = new AnimationMixer(steve);
      this._steveWalkAction = this._steveWalkMixer.clipAction(model.animations[1]);
    })
  }

  _initGui() {
    gui.add(this, '_destroyMode').onChange((value: boolean) => {
      if (value) this._highlighter.material.color.setHex(0xff0000);
      else this._highlighter.material.color.setHex(0x000000);
    });
    gui.add(this, '_selectedBlock', this._blockOptions);
    gui.add(this, '_template', Object.keys(demoTemplates)).onChange((value: string) => {
      this._buildTemplate(demoTemplates[value]);
    });
  }

  _buildTemplate(template: BlockConfig[]) {
    for (const block of template)
      for (const pos of block.positions)
        this._spawnBlock(new Vector3(...pos), constants.MeshOrientation.TOP, block.block);
  }

  _serializeToTemplate() {
    const template: BlockConfig[] = [];
    for (const blockName in this._blocks) {
      const block = this._blocks[blockName];
      const blockConfig: BlockConfig = { block: blockName, positions: [] };
      for (const blockInstance of block.instances) {
        const pos = blockInstance.position;
        blockConfig.positions.push([pos.x, pos.y, pos.z]);
      }
      if (blockConfig.positions.length) template.push(blockConfig);
    }
    console.log(JSON.stringify(template));
  }

  _initEvents() {
    window.addEventListener('resize', this._onResize.bind(this));
    window.addEventListener('pointermove', this._onMouseMove.bind(this));
    window.addEventListener('click', this._onClick.bind(this));
    window.addEventListener('touchstart', this._onClick.bind(this));
    window.addEventListener('keydown', this._onKeyDown.bind(this));
    window.addEventListener('keyup', this._onKeyUp.bind(this));
  }

  _initLights() {
    const dl = new DirectionalLight(0xffffff, 5);
    dl.position.set(-20, 40, 4);
    dl.castShadow = true;
    this._scene.add(dl);

    dl.shadow.camera.near = 0.5;
    dl.shadow.camera.far = 55;
    dl.shadow.camera.right = dl.shadow.camera.top = 50;
    dl.shadow.camera.left = dl.shadow.camera.bottom = -50;
  }

  _initEnvironment() {
    RL.load('/envmaps/alps_field_2k.hdr', (t) => {
      t.mapping = EquirectangularReflectionMapping
      this._scene.environment = this._scene.background = t;
    });
  }

  _initFloor() {
    const geo = new PlaneGeometry(sandboxSize, sandboxSize);
    const map = TL.load('/floor/laterite/red_laterite_soil_stones_diff_1k.jpg');
    const normalMap = TL.load('/floor/laterite/red_laterite_soil_stones_nor_gl_1k.jpg');
    const roughnessMap = TL.load('/floor/laterite/red_laterite_soil_stones_rough_1k.png');
    const displacementMap = TL.load('/floor/laterite/red_laterite_soil_stones_disp_1k.png');
    map.colorSpace = normalMap.colorSpace = roughnessMap.colorSpace = displacementMap.colorSpace = SRGBColorSpace;
    const mat = new MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap,
      displacementMap,
      displacementScale: 0.1,
    });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.position.y = -2;
    mesh.receiveShadow = true;
    this._scene.add(mesh);
  }

  _onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    this._camera.aspect = aspect;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _onKeyDown(e: KeyboardEvent) {
    if ("wasd".includes(e.key)) {
      if (!this._steveWalkAction.isRunning()) this._steveWalkAction.play();
      this._lastWalkTimeMs = Date.now();
    } else if (e.key === 't') this._serializeToTemplate();
  }

  _onKeyUp(e: KeyboardEvent) {
    if ("wasd".includes(e.key)) {
      this._lastWalkTimeMs = 0;
      this._steveWalkAction.stop();
    }
  }

  _onClick() {
    this._raycaster.setFromCamera(this._mouse, this._camera);
    const result = this._raycaster.intersectObjects(this._collisionMeshes.instances);
    if (result.length) {
      if (this._destroyMode)
        this._blockOptions.forEach((blockName) => {
          this._destroyBlock(result[0].object.position, result[0].object.userData.meshOrientation, blockName);
        });
      else this._spawnBlock(result[0].object.position, result[0].object.userData.meshOrientation, this._selectedBlock);
    }
  }

  _onMouseMove(e: MouseEvent) {
    this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this._meshSteveHead.lookAt(this._camera.position.x, this._camera.position.y, -this._camera.position.z);
    const angleDiff = this._meshSteveHead.rotation.y - this._meshSteve.rotation.y;
    if (angleDiff > 0.1) this._meshSteve.rotation.y += 0.1;
    else if (angleDiff < -0.1) this._meshSteve.rotation.y -= 0.1;

    this._updateHighlighter();
  }

  _updateHighlighter() {
    this._raycaster.setFromCamera(this._mouse, this._camera);
    const result = this._raycaster.intersectObjects(this._collisionMeshes.instances);
    if (result.length) {
      this._highlighter.position.copy(result[0].object.position);
      this._highlighter.rotation.copy(result[0].object.rotation);
    } else this._highlighter.position.set(-1000, -1000, -1000);
  }

  _updateWalkAnimation() {
    if (Date.now() - this._lastWalkTimeMs < 500)
      this._steveWalkMixer.update(constants.walkAnimSpeed);
  }

  _render() {
    this._renderer.render(this._scene, this._camera);
  }

  _animate() {
    this._stats.begin();
    this._updateWalkAnimation();
    window.requestAnimationFrame(this._animate.bind(this));
    this._renderer.render(this._scene, this._camera);
    this._stats.end();
  }
}
