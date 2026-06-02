import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT guard — attaches req.user when a valid token is present,
 * but does NOT throw on a missing or invalid token.
 * Use this for GET routes that return personalised data to authenticated users
 * and empty/zero data to anonymous callers.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Never throw — just pass through with user = undefined when token is absent/invalid
  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
