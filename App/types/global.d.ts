export type ObjPool = {
  instances: (THREE.Group | THREE.Mesh)[];
  mesh: THREE.Group | THREE.Mesh;
};

type BlockConfig = {
  block: string;
  positions: number[][];
};
