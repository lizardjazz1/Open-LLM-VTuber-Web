/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

export let canvas: HTMLCanvasElement | null = null;
export let gl: WebGLRenderingContext | null = null;
export let s_instance: LAppGlManager | null = null;
/**
 * Cubism SDKのサンプルで使用するWebGLを管理するクラス
 */
export class LAppGlManager {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppGlManager {
    if (s_instance == null) {
      s_instance = new LAppGlManager();
    } else {
      // Retry initialization if canvas/gl were not ready previously
      if (!canvas || !gl) {
        s_instance = new LAppGlManager();
      }
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release();
    }

    s_instance = null;
  }

  constructor() {
    // Use existing canvas instead of creating a new one
    canvas = document.getElementById('canvas') as HTMLCanvasElement | null;

    if (!canvas) {
      console.warn('[LAppGlManager] Canvas element with id "canvas" not found at construction time.');
      return;
    }

    try {
      gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    } catch (e) {
      gl = null;
    }

    if (!gl) {
      console.error('[LAppGlManager] Cannot initialize WebGL context.');
      return;
    }
  }

  /**
   * 解放する。
   */
  public release(): void {}
}
