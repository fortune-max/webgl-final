## Overview
The project is a stripped down version of MineCraft - a sandbox game which allows users to place and destroy blocks in a 3D world. The game is written in JavaScript and uses WebGL for rendering.

## Decisions
- The game is made to be able to incorporate any number of blocks someone wishes to add. Simply add the model to the model folder and initialize it in the _initBlocks method using the path and the block label. It is important to ensure the origin is at the center bottom of the block. The block should also be a cube. The game will automatically scale the block to the correct size.

- The size of the field can be set in the code. It is defaulted to a 40x40 field with each block being 2x2x2 units. The field size can be changed by changing the sandboxSize variable in the code. This affects the initial colliding meshes created as we use colliding meshes of size 2x2 to know which cell has been clicked on. Higher numbers so far seem to have no effect on framerate so it is safe to increase the size of the field.

- Whenever a block is placed, it also creates six collision meshes on each side and tags their directions. This is used in conjunction with the raycaster to determine which mesh has been clicked on, and then with the relative direction to the cube of the mesh, we can know where to place a new block (or destroy an existing block). To keep things simple, the floorMeshes use the same logic and just behave like they are the top meshes for cubes placed on the floor. This is done to avoid having to create a separate raycaster for the floor meshes. Also this may mean that as more collision blocks are added, the raycaster may take longer to compute the intersection. However, no noticeable lag was observed even with 1000 blocks placed.

- To potentially allow for saving current state, the game has a way to serialize all placed blocks and deserialize from this JSON to the world. This is used in the template debugger dropdown in spawning random structures. To serialize your world, hit the T button and it outputs the blocks in the console. This data can be consumed by the _buildTemplate method to create a world from the template.

- Walk animations are present for Steve which play when WASD is pressed. Currently it is more practical to have the user use the mouse and interact in third-person so Steve doesn't move yet. Also this will involve introducing collision detection for Steve which is not yet implemented.

- On optimization, as all the models already only contain few vertices, there was no need to optimize those. The resources were optimized, for example the texture for the ground used for the platform. The HDR was used uncompressed and is the largest single resource (6MB). It was in 2k and I had one in 1k which was poorer when used as an envMap so I went with the 2k one. The entire site comes in at under 16MB (mostly due to the HDR) and loads near-instantly on a decent connection.

- The shadows were added with the default gridSize in mind. At first I considered not adding any shadows but finally went with adding as the shadows add a lot to the realism of the scene and the game's performance was still quite smooth. The shadows are not very sharp but are good enough for the game.
