import PQueue from 'p-queue';

/**
 * Kaggle free tier gives exactly one GPU per running notebook session, and
 * CatVTON is a diffusion model — concurrent inference calls will either
 * queue up inside the notebook's own process or crash a naively single-
 * worker FastAPI server. concurrency: 1 here is a correctness requirement,
 * not a tunable — every call to the Kaggle endpoint MUST go through this
 * queue, never called directly from a controller/service.
 */
export const tryonQueue = new PQueue({ concurrency: 1 });
