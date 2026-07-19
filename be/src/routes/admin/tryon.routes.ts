import { Router } from 'express';
import { authenticateStaff } from '../../middleware/authenticateStaff.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { adminTryonEndpointSchema } from '../../schemas/tryon.schema.js';
import * as adminTryonController from '../../controllers/admin/tryon.controller.js';

const router = Router();

router.put(
  '/endpoint',
  authenticateStaff,
  authorize('admin'),
  validate(adminTryonEndpointSchema),
  adminTryonController.setTryonEndpoint,
);

router.get(
  '/endpoint',
  authenticateStaff,
  authorize('admin'),
  adminTryonController.getTryonEndpoint,
);

export default router;
