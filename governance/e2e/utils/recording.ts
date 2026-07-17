import * as path from 'node:path'
import type { BrowserContextOptions } from '@playwright/test'

/**
 * E2E 默认不录制视频；运行时设置 E2E_RECORD_VIDEO=1 才开启。
 */
export const shouldRecordVideo = process.env.E2E_RECORD_VIDEO === '1'

export const recordVideoOptions: BrowserContextOptions['recordVideo'] = shouldRecordVideo
  ? {
      dir: path.resolve(process.cwd(), 'test-results/videos'),
      size: { width: 1600, height: 900 },
    }
  : undefined
