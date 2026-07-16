import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { LicenseService } from '../services/license.service.legacy';

const prisma = new PrismaClient();

/**
 * Enterprise Guard: Checks Commercial License, Operational Toggles, and RBAC Permissions
 */
export const requirePermission = (requiredPermission: string, requireQuotaCheck = false) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Get User Context (Assuming auth middleware already populated req.user)
      const { id: userId, tenantId, branchId, roleId } = req.user as any;

      if (!tenantId) return res.status(401).json({ error: "Unauthorized: Missing Tenant Context" });

      // 2. LAYER 1: Commercial Tier (License & Quota Check)
      await LicenseService.getActiveLicense(tenantId, branchId);
      if (requireQuotaCheck) {
        await LicenseService.checkStudentQuota(tenantId, branchId);
      }

      // 3. LAYER 2: Operational Tier (Tenant Settings)
      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
      
      if (requiredPermission === 'admission:direct:create' && settings && !settings.enableDirectAdmission) {
        return res.status(403).json({ 
          error: "Operational Toggle: Direct admissions are disabled by the school Director. Use the CRM flow." 
        });
      }

      // 4. LAYER 3: Access Tier (RBAC Permissions)
      if (roleId) {
        const userRole = await prisma.role.findUnique({ where: { id: roleId } });
        if (!userRole || (!userRole.permissions.includes(requiredPermission) && !userRole.permissions.includes('*'))) {
          return res.status(403).json({ 
            error: `RBAC Violation: You lack the '${requiredPermission}' capability.` 
          });
        }
      } else {
        return res.status(403).json({ error: "RBAC Violation: No role assigned." });
      }

      // Passed all 3 layers
      next();
    } catch (error: any) {
      // Catch Quota errors or License errors and return 402 Payment Required / 403 Forbidden
      const status = error.message.includes('QUOTA') || error.message.includes('LICENSE') ? 402 : 500;
      res.status(status).json({ error: error.message });
    }
  };
};
