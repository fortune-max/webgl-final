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
  GridHelper,
  Shape,
  BufferGeometry,
  Line,
  LineBasicMaterial,
} from 'three';

import * as constants from  "./constants";
import type { ObjPool } from "./types/global";
import { castShadow, getNewBlockPos, getNewMeshPos, getNewMeshRot, getOldBlockPos, normalizeBlock } from './utils';
import  Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const gui = new GUI();
const GL = new GLTFLoader();
const RL = new RGBELoader();

const gridSize = 2;
const sandboxSize = 40;

export default class App {
  private _renderer: WebGLRenderer;
  private _camera: PerspectiveCamera;
  private _meshSteve: Group;
  private _meshSteveHead: Mesh;

  private _stats: Stats;
  private _scene: Scene;
  private _mouse: Vector2;
  private _raycaster: Raycaster;
  private _blocks: Record<string, ObjPool> = {};
  private _collisionMeshes: ObjPool;
  private _highlighter: Line;
  private _destroyMode: boolean = false;

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
    });
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = PCFSoftShadowMap;
    this._renderer.toneMapping = ACESFilmicToneMapping;
    this._renderer.setSize(window.innerWidth, window.innerHeight);

    const aspect = window.innerWidth / window.innerHeight;
    this._camera = new PerspectiveCamera(70, aspect, 0.1, 100);
    this._camera.position.set(0, 0, 5);
    new OrbitControls(this._camera, this._renderer.domElement);

    this._initEvents();
    this._initLights();
    // this._initGrid();
    this._initEnvironment();
    this._initFloor();
    this._initCollisionMeshes();
    this._initHighlighter();
    this._initDirtBlock();
    this._createSteve();
    this._initGui();
    this._render();
    this._animate();
  }

  _initGrid() {
    const gridHelper = new GridHelper(sandboxSize, sandboxSize/gridSize, 0x0000ff, 0xff8080);
    gridHelper.position.y = -2;
    this._scene.add(gridHelper);
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

  _initDirtBlock() {
    GL.load('/models/minecraft_grass_block.glb', (model) => {
      const dirtBlock = normalizeBlock(model.scene, gridSize);
      castShadow(dirtBlock);
      this._blocks.dirt = { mesh: dirtBlock, instances: [] };
    });
  }

  _spawnBlock(meshPos: Vector3, meshOrienation: string) {
    const blockPos = getNewBlockPos(meshPos, meshOrienation, gridSize);
    const newBlock = this._blocks.dirt.mesh.clone() as Group;
    newBlock.userData.collisionMeshes = [];
    
    newBlock.position.copy(blockPos);
    this._scene.add(newBlock);
    this._blocks.dirt.instances.push(newBlock);

    for (let orientation=0; orientation<6; orientation++) {
      const collisionMesh = this._collisionMeshes.mesh.clone() as Mesh;
      collisionMesh.position.copy(getNewMeshPos(blockPos, orientation, gridSize));
      collisionMesh.rotation.setFromVector3(getNewMeshRot(orientation));
      collisionMesh.userData = { meshOrientation: orientation };
      this._collisionMeshes.instances.push(collisionMesh);
      this._scene.add(collisionMesh);
      newBlock.userData.collisionMeshes.push(collisionMesh);
    }
  }

  _destroyBlock(meshPos: Vector3, meshOrienation: constants.MeshOrientation) {
    const blockPos = getOldBlockPos(meshPos, meshOrienation, gridSize);
    const blockIndex = this._blocks.dirt.instances.findIndex((block) => block.position.equals(blockPos));
    if (blockIndex === -1) return;
    const block = this._blocks.dirt.instances[blockIndex];
    this._blocks.dirt.instances.splice(blockIndex, 1);
    this._scene.remove(block);

    for (const collisionMesh of block.userData.collisionMeshes) {
      const collisionMeshIndex = this._collisionMeshes.instances.findIndex((mesh) => mesh.uuid === collisionMesh.uuid);
      this._collisionMeshes.instances.splice(collisionMeshIndex, 1);
      this._scene.remove(collisionMesh);
    }
    this._updateHighlighter();
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
    })
  }

  _initGui() {
    gui.add(this, '_destroyMode').onChange((value: boolean) => {
      const highlighterMaterial = this._highlighter.material as LineBasicMaterial;
      if (value) highlighterMaterial.color.setHex(0xff0000);
      else highlighterMaterial.color.setHex(0x000000);
    });
  }

  _initEvents() {
    window.addEventListener('resize', this._onResize.bind(this));
    window.addEventListener('pointermove', this._onMouseMove.bind(this));
    window.addEventListener('click', this._onClick.bind(this));
    window.addEventListener('touchstart', this._onClick.bind(this));
  }

  _initLights() {
    const dl = new DirectionalLight(0xffffff, 5);
    dl.position.set(-5, 5, 4);
    dl.castShadow = true;
    this._scene.add(dl);

    dl.shadow.mapSize.width = 200;
    dl.shadow.mapSize.height = 200;
    dl.shadow.camera.near = 0.5;
    dl.shadow.camera.far = 20;
  }

  _initEnvironment() {
    RL.load('/envmaps/alps_field_2k.hdr', (t) => {
      t.mapping = EquirectangularReflectionMapping
      this._scene.environment = t;
      this._scene.background = t;
    });
  }

  _initFloor() {
    const geo = new PlaneGeometry(sandboxSize, sandboxSize);
    const mat = new MeshStandardMaterial({ color: 0x444444 });
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

  _onClick() {
    this._raycaster.setFromCamera(this._mouse, this._camera);
    const result = this._raycaster.intersectObjects(this._collisionMeshes.instances);
    if (result.length) {
      if (this._destroyMode) this._destroyBlock(result[0].object.position, result[0].object.userData.meshOrientation);
      else this._spawnBlock(result[0].object.position, result[0].object.userData.meshOrientation);
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
    } else {
      this._highlighter.position.set(0, -2.1, 0);
      this._highlighter.rotation.x = -Math.PI * 0.5;
    }
  }

  _render() {
    this._renderer.render(this._scene, this._camera);
  }

  _animate() {
    this._stats.begin();
    window.requestAnimationFrame(this._animate.bind(this));
    this._renderer.render(this._scene, this._camera);
    this._stats.end();
  }
}
