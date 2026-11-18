/** Tipos mínimos da libheif-js. */
declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  type HeifImage = {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    has_alpha_channel(): boolean;
    display<T extends { data: Uint8ClampedArray; width: number; height: number }>(
      target: T,
      callback: (result: T | null) => void,
    ): void;
    free(): void;
  };
  type HeifDecoder = { decoder: unknown; decode(buffer: ArrayBuffer): HeifImage[] };
  type LibHeif = { HeifDecoder: new () => HeifDecoder; heif_context_free(context: unknown): void };
  export default function libheif(): LibHeif;
}
