# MindCraft World Contract Drafts

These files turn the v1 architecture into machine-readable starting contracts. They are isolated from the active world implementation so the visual build can continue without accidental coupling.

## Files

- `skill-block-manifest.schema.json`: one deterministic local computation block;
- `skill-graph.schema.json`: a pinned system made by wiring blocks together;
- `learning-policy.schema.json`: the frozen instructional policy for one mission assignment;
- `garden-skill-graph.example.json`: the intended shape of the first Garden system.

The repeated hashes in the Garden example are placeholders. They are not valid published artifact identities. Replace them with hashes generated from admitted block artifacts.

## Validation layers

JSON Schema checks structure. A runtime validator must also enforce rules that JSON Schema cannot safely express:

1. instance, edge, and port IDs are unique;
2. every referenced block version and content hash exists in the installed offline pack;
3. every edge resolves from an output port to a compatible input port;
4. value type and unit match, or the edge passes through an explicit converter;
5. graph cycles contain a declared delay or state block;
6. graph boundary ports resolve to real internal ports;
7. pure blocks do not declare state or resume behavior;
8. stateful blocks declare deterministic checkpoint and resume behavior;
9. artifact bytes match the pinned hash;
10. the same seed, initial state, and event trace produce the same checkpoint hash;
11. learning policy reasons resolve to frozen evidence references;
12. no policy can reveal the target answer or count group success as individual mastery.

## Integration order

1. Review names and semantics with the world, learning-engine, and content owners.
2. Generate TypeScript types and runtime validators from the approved schemas.
3. Implement the smallest `mindcraft-ir-v1` interpreter in a Web Worker.
4. Admit primitive blocks with deterministic test vectors.
5. Replace Garden example hashes with real admitted artifacts.
6. Run the same graph through headless, 2D iframe, and 3D adapters.
7. Add the generated public block index only after the admission checks pass.

Do not move formulas into Three.js handlers or visual iframe code while this layer is under construction. A view may animate a computed state, but it does not own the model.
