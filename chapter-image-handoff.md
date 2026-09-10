# MindCraft Chapter Illustration Handoff

Date: 2026-08-29

## Completed batch

- Algebra I: 15 chapters, 30 images
- Biology: 14 chapters, 28 images
- Blockchain: 14 chapters, 28 images
- Calculus: 18 chapters, 36 images
- Chemistry: 16 chapters, 32 images
- Circuits: 24 chapters, 48 images
- Computer Science: 15 chapters, 30 images
- Networking: 16 chapters, 32 images
- Total: 132 chapters, 264 images out of the 450-image manifest
- Remaining placeholders: 186

The source prompt manifest is `image_prompts.md`. Every generated image used its corresponding prompt exactly as written.

## File locations

- Images: `generated_chapter_images/`
- Machine-readable mapping: `generated_chapter_images_manifest.json`
- Algebra I archive: `algebra-1-chapter-images.zip`
- Biology archive: `biology-chapter-images.zip`
- Blockchain archive: `blockchain-chapter-images.zip`
- Calculus archive: `calculus-chapter-images.zip`
- Chemistry archive: `chemistry-chapter-images.zip`
- Circuits archive: `circuits-chapter-images.zip`
- Computer Science archive: `computer-science-chapter-images.zip`
- Networking archive: `networking-chapter-images.zip`
- Frozen 58-image checkpoint: `mindcraft-chapter-images-batch-01.zip`
- Frozen 86-image checkpoint: `mindcraft-chapter-images-batch-02.zip`
- Frozen 122-image checkpoint: `mindcraft-chapter-images-batch-03.zip`
- Frozen 154-image checkpoint: `mindcraft-chapter-images-batch-04.zip`
- Frozen 202-image checkpoint: `mindcraft-chapter-images-batch-05.zip`
- Frozen 232-image checkpoint: `mindcraft-chapter-images-batch-06.zip`
- Current 264-image checkpoint: `mindcraft-chapter-images-batch-07.zip`

## Naming contract

Each filename is derived from the chapter `concept_id` and image slot:

```text
<concept_id with :: replaced by __>__<opening|closing>.png
```

Example:

```text
chemistry::scientific-method + closing
chemistry__scientific-method__closing.png
```

Do not rename these manually. The filename is the lookup key for wiring an image to its chapter and slot.

## Integration guidance

1. Resolve each image from the chapter `concept_id` and `opening` or `closing` slot.
2. Use `generated_chapter_images_manifest.json` for filenames and actual source dimensions.
3. Start with aspect-fit while reviewing the final slide layout. The image service returned a mixture of landscape, square, and portrait canvases.
4. Add deliberate per-frame cropping only after visual review. Do not stretch images into a fixed ratio.
5. Keep placeholder behavior for the remaining 186 manifest slots.
6. Review every image in its real frame before release. Some diagrams contain conventional symbols, equations, question marks, hazard pictograms, or icon-like marks even though the prompts prohibit labels. No prompt text was changed to suppress those symbols.
7. Treat `calculus__unit-circle__closing.png` as a high-priority regeneration or editorial-review candidate. The image model reproduced equations and multiple explanatory text blocks despite the exact prompt ending with `no embedded text or labels`.
8. Review the ASCII/Unicode and character-encoding pairs before release. Their concepts led the image model to render letters, digits, and multilingual glyphs despite the same no-label instruction; the source prompts were not changed.

## Verification performed

- Completed-subject manifest comparison: 264 expected files, 264 present
- Missing filenames: none
- Unexpected filenames: none
- PNG signatures: valid
- Mapping manifest: 264 unique entries, all source files present
- Algebra I archive integrity: passed
- Biology archive integrity: passed
- Blockchain archive integrity: passed
- Calculus archive integrity: passed
- Chemistry archive integrity: passed
- Circuits archive integrity: passed
- Computer Science archive integrity: passed
- Networking archive integrity: passed
- Current combined checkpoint archive integrity: passed

## Repository state

The prompt manifest, generated image directory, mapping manifest, handoff note, and archives are intentionally untracked. Review file size and choose the app asset or remote-content strategy before committing binary assets. Keep the PNGs as source masters and create optimized delivery derivatives for the app or CDN.
