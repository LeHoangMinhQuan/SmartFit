import { z } from 'zod';

export const clothTypeEnum = z.enum(['upper', 'lower', 'overall']);
export type ClothType = z.infer<typeof clothTypeEnum>;

/**
 * POST /api/tryon/session
 * Multer/multer-s3 runs BEFORE this validator so multipart fields are
 * already on req.body as strings — hence z.coerce.number() below.
 *
 * NOTE vs. the original plan doc: `product_id`/`variant_id` are required
 * here (not just at preview time), because tryon_session.product_id and
 * .variant_id are NOT NULL with an FK to product_variant. The session is
 * scoped to one variant from the moment the photo is uploaded.
 */
export const tryonSessionUploadSchema = z.object({
  body: z.object({
    product_id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
  }),
});

/**
 * POST /api/tryon/preview
 * `product_id`/`variant_id` are intentionally NOT accepted here — they're
 * already pinned to the session from creation. Only `cloth_type` varies.
 */
export const tryonPreviewSchema = z.object({
  body: z.object({
    session_id: z.coerce.number().int().positive(),
    cloth_type: clothTypeEnum.optional().default('upper'),
  }),
});

/** GET /api/tryon/preview/:session_id and DELETE /api/tryon/session/:session_id */
export const tryonSessionIdParamSchema = z.object({
  params: z.object({
    session_id: z.coerce.number().int().positive(),
  }),
});

/** PUT /api/admin/tryon/endpoint */
export const adminTryonEndpointSchema = z.object({
  body: z.object({
    base_url: z.string().url(),
    shared_secret: z.string().min(16, 'shared_secret should be a long random value'),
  }),
});
