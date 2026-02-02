import type { Request, Response, NextFunction } from "express";
import { whopSdk } from "./whop-sdk";
import { logger } from "./logger";
import { storage } from "./storage";

export interface WhopUser {
  id: string;
  experienceId?: string;
}

export async function requireWhopAuth(req: Request, res: Response, next: NextFunction) {
  const userToken = req.headers["x-whop-user-token"] as string;
  
  try {
    if (!userToken) {
      // Only log this in development when not expected
      if (process.env.NODE_ENV === "development") {
        console.warn("⚠️  No Whop user token - app must be accessed through Whop iframe with dev proxy enabled");
      }
      return res.status(401).json({ error: "No authentication token provided" });
    }

    // Use Whop SDK to verify the JWT token properly
    const result = await whopSdk.verifyUserToken(userToken);
    
    // Debug logging to track user ID changes
    logger.debug("JWT Token Debug:", {
      tokenLength: userToken.length,
      tokenStart: userToken.slice(0, 20) + "...",
      extractedUserId: result.userId,
      route: req.path
    });
    
    (req as any).whopUser = {
      id: result.userId,
      experienceId: req.params.experienceId || req.body.experienceId
    };
    
    // Update user activity to track that they're online
    try {
      await storage.updateUserActivity(result.userId);
    } catch (error) {
      // Don't fail the request if activity tracking fails, just log it
      logger.debug("Failed to update user activity:", error);
    }
    
    next();
  } catch (error) {
    // Only log detailed auth errors in development if it's not the mock token
    if (process.env.NODE_ENV === "development" && userToken !== "mock-whop-token-for-development") {
      console.warn("🔐 Authentication failed - ensure you're accessing via Whop iframe:", (error as Error).message);
    }
    return res.status(401).json({ error: "Invalid authentication token" });
  }
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const whopUser = (req as any).whopUser as WhopUser;
  
  try {
    if (!whopUser) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get the resource ID from params, query, or body
    const resourceId = req.params.companyId || req.params.experienceId || 
                      req.query.companyId || req.query.experienceId ||
                      req.body.companyId || req.body.experienceId;

    if (!resourceId) {
      return res.status(400).json({ error: "Resource ID required for admin check" });
    }

    // Check if user is admin using the access check
    const accessResult = await whopSdk.access.checkIfUserHasAccessToExperience({
      userId: whopUser.id,
      experienceId: resourceId as string,
    });

    if (accessResult.accessLevel !== "admin") {
      logger.warn(`🚫 Non-admin user ${whopUser.id} attempted admin action on ${resourceId}`);
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    logger.error("Admin auth check failed:", error);
    return res.status(500).json({ error: "Failed to verify admin access" });
  }
}