import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import * as UserController from "../controllers/user.controller.js";
import {
  updateProfileSchema,
  changePasswordSchema,
  createAddressSchema,
  updateAddressSchema,
  addressParamsSchema,
  wishlistItemSchema,
  wishlistDeleteSchema,
} from "../schemas/user.schema.js";

const router = Router();

// All user routes require JWT
router.use(authenticate);

// Profile
router.get("/me", UserController.getProfile);
router.patch(
  "/me",
  validate(updateProfileSchema),
  UserController.updateProfile,
);
router.patch(
  "/me/password",
  validate(changePasswordSchema),
  UserController.changePassword,
);
router.delete("/me", UserController.deleteAccount);

// Addresses
router.get("/me/addresses", UserController.getAddresses);
router.post(
  "/me/addresses",
  validate(createAddressSchema),
  UserController.addAddress,
);
router.put(
  "/me/addresses/:address_id",
  validate(updateAddressSchema),
  UserController.updateAddress,
);
router.delete(
  "/me/addresses/:address_id",
  validate(addressParamsSchema),
  UserController.removeAddress,
);
router.patch(
  "/me/addresses/:address_id/default",
  validate(addressParamsSchema),
  UserController.setDefaultAddress,
);

// Wishlist
router.get("/me/wishlist", UserController.getWishlist);
router.post(
  "/me/wishlist",
  validate(wishlistItemSchema),
  UserController.addToWishlist,
);
router.delete(
  "/me/wishlist/:product_id/:variant_id",
  validate(wishlistDeleteSchema),
  UserController.removeFromWishlist,
);

export default router;
