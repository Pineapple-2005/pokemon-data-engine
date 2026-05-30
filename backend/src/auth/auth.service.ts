import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';

export interface JwtPayload {
  sub: string;   // user id
  username: string;
}

export interface TrainerAuthResponse {
  access_token: string;
  id: string;
  username: string;
  display_name: string;
  section: string;
  trainer_class: string;
  trainer_card_color: string;
  starter_pokemon: string;
  hometown: string;
  favorite_type: string;
  trainer_title: string;
  rival_name: string;
  trainer_id: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async register(
    username: string,
    password: string,
    section?: string,
    trainerFields?: {
      trainer_class?: string;
      trainer_card_color?: string;
      starter_pokemon?: string;
      hometown?: string;
      favorite_type?: string;
      trainer_title?: string;
      rival_name?: string;
      trainer_id?: string;
      display_name?: string;
    },
  ): Promise<TrainerAuthResponse> {
    const existing = await this.db.findUserByUsername(username);
    if (existing) throw new ConflictException('Username already taken');

    const hash = await bcrypt.hash(password, 10);
    const displayName = trainerFields?.display_name ?? username;

    // Strip display_name out of trainerFields before forwarding to createUser
    const { display_name: _dn, ...trainerOnly } = trainerFields ?? {};

    const user = await this.db.createUser(username, hash, displayName, section, trainerOnly);

    const token = this.jwt.sign({ sub: user.id, username: user.username } satisfies JwtPayload);
    return {
      access_token: token,
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      section: section ?? '3ISC',
      trainer_class: user.trainer_class,
      trainer_card_color: user.trainer_card_color,
      starter_pokemon: user.starter_pokemon,
      hometown: user.hometown,
      favorite_type: user.favorite_type,
      trainer_title: user.trainer_title,
      rival_name: user.rival_name,
      trainer_id: user.trainer_id,
    };
  }

  async login(
    username: string,
    password: string,
  ): Promise<TrainerAuthResponse> {
    const user = await this.db.findUserByUsername(username);
    if (!user) throw new UnauthorizedException('Invalid username or password');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid username or password');

    const token = this.jwt.sign({ sub: user.id, username: user.username } satisfies JwtPayload);
    return {
      access_token: token,
      id: user.id,
      username: user.username,
      display_name: user.display_name ?? user.username,
      section: user.section ?? '3ISC',
      trainer_class: user.trainer_class,
      trainer_card_color: user.trainer_card_color,
      starter_pokemon: user.starter_pokemon,
      hometown: user.hometown,
      favorite_type: user.favorite_type,
      trainer_title: user.trainer_title,
      rival_name: user.rival_name,
      trainer_id: user.trainer_id,
    };
  }
}
