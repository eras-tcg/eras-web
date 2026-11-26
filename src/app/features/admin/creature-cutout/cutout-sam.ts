import type { PreTrainedModel, Processor, Tensor } from '@huggingface/transformers';

/** The model: SlimSAM (a small Segment Anything), from Hugging Face, kept by the browser after the first time. */
const MODEL = 'Xenova/slimsam-77-uniform';

/**
 * Segment Anything in the browser, for the cut-out editor: it reads the illustration once, then answers the part
 * under the points clicked. Loaded only when the editor opens (the library and the model are big).
 */
export class CutoutSam {
  private constructor(
    private readonly lib: typeof import('@huggingface/transformers'),
    private readonly model: PreTrainedModel,
    private readonly processor: Processor,
  ) {}

  /**
   * Loads the model and reads the illustration at `url`: on the graphics card when the browser has one for the web
   * (WebGPU, several times faster), else (or if it fails there) on the processor.
   */
  static async open(url: string): Promise<CutoutSam> {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const sam = await CutoutSam.load('webgpu');
        await sam.read(url);
        return sam;
      } catch {
        // Not on this card: on the processor
      }
    }
    const sam = await CutoutSam.load('wasm');
    await sam.read(url);
    return sam;
  }

  private inputs: { original_sizes: [number, number][]; reshaped_input_sizes: [number, number][] } | null = null;
  private embeddings: Record<string, Tensor> | null = null;

  /** Loads the library and the model, to run on `device` (quantized on the processor, full precision on the card). */
  private static async load(device: 'webgpu' | 'wasm'): Promise<CutoutSam> {
    const lib = await import('@huggingface/transformers');
    const [model, processor] = await Promise.all([
      lib.SamModel.from_pretrained(MODEL, { device, dtype: device === 'webgpu' ? 'fp32' : 'q8' }),
      lib.AutoProcessor.from_pretrained(MODEL),
    ]);
    return new CutoutSam(lib, model, processor);
  }

  /** Reads the illustration (its address: a blob URL), for the parts asked next. */
  async read(url: string): Promise<void> {
    const image = await this.lib.RawImage.read(url);
    const inputs = await this.processor(image);
    this.inputs = inputs;
    this.embeddings = await (this.model as unknown as { get_image_embeddings(i: unknown): Promise<Record<string, Tensor>> }).get_image_embeddings(inputs);
  }

  /**
   * The part under `points` (pixels of the illustration; `inside` false for points that are not of it): one byte per
   * pixel, 1 in the part. The best of SAM's three guesses.
   */
  async part(points: { x: number; y: number; inside: boolean }[]): Promise<Uint8Array> {
    if (!this.inputs || !this.embeddings) throw new Error('Sin imagen');
    const [h, w] = this.inputs.reshaped_input_sizes[0];
    const [oh, ow] = this.inputs.original_sizes[0];
    const coords = points.flatMap((p) => [(p.x / ow) * w, (p.y / oh) * h]);
    const input_points = new this.lib.Tensor('float32', coords, [1, 1, points.length, 2]);
    const input_labels = new this.lib.Tensor('int64', points.map((p) => BigInt(p.inside ? 1 : 0)), [1, 1, points.length]);
    const out = (await this.model({ ...this.embeddings, input_points, input_labels })) as { pred_masks: Tensor; iou_scores: Tensor };
    const masks = (await (this.processor as unknown as { post_process_masks(...a: unknown[]): Promise<Tensor[]> }).post_process_masks(
      out.pred_masks,
      this.inputs.original_sizes,
      this.inputs.reshaped_input_sizes,
    ))[0];
    // SAM guesses three parts, small to large (a buckle, the armour, the whole robot): the largest of those it is
    // nearly as sure of as its best, since a click usually means the whole figure there
    const scores = out.iou_scores.data as Float32Array;
    const size = oh * ow;
    const data = masks.data as Uint8Array;
    const top = Math.max(...scores);
    let pick = -1;
    let area = -1;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] < top - 0.15) continue;
      let n = 0;
      for (let p = i * size; p < (i + 1) * size; p++) n += data[p] ? 1 : 0;
      if (n > area) [pick, area] = [i, n];
    }
    return data.slice(pick * size, (pick + 1) * size);
  }
}
