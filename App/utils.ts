import {
  Box3,
  Object3D,
  Vector3,
  Camera,
  Group,
  Mesh,
} from 'three';
import { MeshOrientation } from './constants';

export function getSize(mesh: Object3D) {
  const boundingBox = new Box3().setFromObject(mesh);
  const size = new Vector3();
  boundingBox.getSize(size);
  return size;
}

export function normalizeBlock(block: Group, gridSize: number = 2) {
  const blockSize = getSize(block);
  const scale = new Vector3(gridSize/blockSize.x, gridSize/blockSize.y, gridSize/blockSize.z);
  block.scale.copy(scale);
  return block;
}

export function castShadow(mesh: Object3D) {
  mesh.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = true;
  });
}

export function cameraTarget(camera: Camera, distance: number = 2) {
  const forward = new Vector3();
  camera.getWorldDirection(forward);
  const targetPosition = new Vector3();
  targetPosition.copy(this._camera.position).add(forward.multiplyScalar(distance));
}

export function getNewBlockPos(meshPosition: Vector3, meshOrienation: number | string, gridSize: number = 2) {
  if (meshOrienation === MeshOrientation.TOP)
    return meshPosition.clone().add(new Vector3(0, 0, 0));
  if (meshOrienation === MeshOrientation.BOTTOM)
    return meshPosition.clone().add(new Vector3(0, -gridSize, 0));
  if (meshOrienation === MeshOrientation.LEFT)
    return meshPosition.clone().add(new Vector3(gridSize/2, -gridSize/2, 1 - gridSize/2));
  if (meshOrienation === MeshOrientation.RIGHT)
    return meshPosition.clone().add(new Vector3(-gridSize/2, -gridSize/2, gridSize/2 - 1));
  if (meshOrienation === MeshOrientation.FRONT)
    return meshPosition.clone().add(new Vector3(gridSize/2 - 1, -gridSize/2, gridSize/2));
  return meshPosition.clone().add(new Vector3(-gridSize/2 + 1, -gridSize/2, -gridSize/2));
}

export function getOldBlockPos(meshPosition: Vector3, meshOrienation: number | string, gridSize: number = 2) {
  meshOrienation = (+meshOrienation + 3) % 6;
  return getNewBlockPos(meshPosition, meshOrienation, gridSize);
}

export function getNewMeshPos(blockPosition: Vector3, meshOrienation: number | string, gridSize: number = 2) {
  if (meshOrienation === MeshOrientation.TOP)
    return blockPosition.clone().add(new Vector3(0, gridSize, 0));
  if (meshOrienation === MeshOrientation.BOTTOM)
    return blockPosition.clone().add(new Vector3(0, 0, 0));
  if (meshOrienation === MeshOrientation.LEFT)
    return blockPosition.clone().add(new Vector3(gridSize/2, gridSize/2, -gridSize/2 + 1));
  if (meshOrienation === MeshOrientation.RIGHT)
    return blockPosition.clone().add(new Vector3(-gridSize/2, gridSize/2, gridSize/2 - 1));
  if (meshOrienation === MeshOrientation.FRONT)
    return blockPosition.clone().add(new Vector3(gridSize/2 - 1, gridSize/2, gridSize/2));
  return blockPosition.clone().add(new Vector3(-gridSize/2 + 1, gridSize/2, -gridSize/2));
}

export function getNewMeshRot(meshOrienation: number | string) {
  if (meshOrienation === MeshOrientation.TOP)
    return new Vector3(-Math.PI/2, 0, 0);
  if (meshOrienation === MeshOrientation.BOTTOM)
    return new Vector3(Math.PI/2, 0, 0);
  if (meshOrienation === MeshOrientation.LEFT)
    return new Vector3(0, Math.PI/2, 0);
  if (meshOrienation === MeshOrientation.RIGHT)
    return new Vector3(0, -Math.PI/2, 0);
  if (meshOrienation === MeshOrientation.FRONT)
    return new Vector3(0, 0, 0);
  return new Vector3(0, Math.PI, 0);
}
