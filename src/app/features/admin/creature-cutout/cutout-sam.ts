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

  private inputs: { original_sizes: [number, number][]; reshaped_input_sizes: [number, number][] } | null = null;
  private embeddings: Record<string, Tensor> | null = null;

  /** Loads the library and the model; `progress` 0..1 while the model downloads. */
  static async load(progress: (done: number) => void): Promise<CutoutSam> {
    const lib = await import('@huggingface/transformers');
    const files = new Map<string, number>();
    const onProgress = (p: { status: string; file?: string; progress?: number }) => {
      if (p.status !== 'progress' || !p.file) return;
      files.set(p.file, (p.progress ?? 0) / 100);
      progress([...files.values()].reduce((a, b) => a + b, 0) / Math.max(2, files.size));
    };
    const [model, processor] = await Promise.all([
      lib.SamModel.from_pretrained(MODEL, { dtype: 'q8', progress_callback: onProgress }),
      lib.AutoProcessor.from_pretrained(MODEL, { progress_callback: onProgress }),
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
    const scores = out.iou_scores.data as Float32Array;
    let best = 0;
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    const size = oh * ow;
    return (masks.data as Uint8Array).slice(best * size, (best + 1) * size);
  }
}
