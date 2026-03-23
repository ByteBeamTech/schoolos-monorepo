import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable, switchMap } from 'rxjs'
import { RlsMiddleware } from './rls-middleware'

@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private readonly rls: RlsMiddleware) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest()
    const user = req.user
    if (!user) return next.handle()

    return new Observable(observer => {
      this.rls
        .setTenantContext(user.tenantId, user.isSuperadmin, () =>
          next.handle().toPromise(),
        )
        .then(result => { observer.next(result); observer.complete() })
        .catch(err => observer.error(err))
    })
  }
}
