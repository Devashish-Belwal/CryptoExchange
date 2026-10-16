import { Router } from "express";
import * as authController from "../controller/auth-controller.js";
import { asyncHandler, idempotencyHandler } from "../utils/asyn-wrapper.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const authRouter: Router = Router();

authRouter.post("/signup",
    asyncHandler(authController.signup)
);

authRouter.post("/signin",
    asyncHandler(authController.signin)
);

authRouter.post("/signout",
    asyncHandler(authController.signout)
);

authRouter.get("/refresh", asyncHandler(authController.refreshToken))

authRouter.post("/resend-otp",
    asyncHandler(authController.resendOTP)
);

authRouter.post("/verify-otp",
    asyncHandler(authController.checkOTPVerification)
);

authRouter.post("/forget-password",
    asyncHandler(authController.forgetPassword)
);

authRouter.post("/reset-password",
    asyncHandler(authController.resetPassword)
);

authRouter.post("/change-password",
    requireAuth,
    asyncHandler(authController.changePassword)
);

authRouter.get("/balances",
    requireAuth,
    asyncHandler(authController.getBalances)
);

authRouter.post("/on-ramp",
    requireAuth,
    ...idempotencyHandler(authController.onRampBalance)
);

authRouter.post("/off-ramp",
    requireAuth,
    ...idempotencyHandler(authController.offRampBalance)
);

authRouter.get("/sessions",
    requireAuth,
    asyncHandler(authController.getSessions)
);

authRouter.delete("/sessions/:sessionId",
    requireAuth,
    asyncHandler(authController.revokeSession)
);

export default authRouter;