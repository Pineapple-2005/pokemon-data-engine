import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'pokemon_day_secret_jwt_2026',
    });
  }

  async validate(payload: JwtPayload): Promise<{ userId: string; username: string }> {
    if (!payload.sub) throw new UnauthorizedException();
    return { userId: payload.sub, username: payload.username };
  }
}
