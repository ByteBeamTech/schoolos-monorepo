import { SetMetadata } from '@nestjs/common';

export const IS_SUPERADMIN_ROUTE = 'isSuperadminRoute';

export const SuperadminRoute = () =>
  SetMetadata(IS_SUPERADMIN_ROUTE, true);
