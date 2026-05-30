'use client';

import type { TrainerProfile } from '@/types';

export interface AuthUser {
  id: string;
  username: string;
  access_token: string;
  // Trainer profile fields (optional — may not be set on old sessions)
  display_name?: string;
  section?: string;
  trainer_class?: string;
  trainer_card_color?: string;
  starter_pokemon?: string;
  hometown?: string;
  favorite_type?: string;
  trainer_title?: string;
  rival_name?: string;
  trainer_id?: string;
}

const KEY = 'pk_auth';

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch { return null; }
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(KEY);
}

export function getAuthHeader(): Record<string, string> {
  const user = getStoredUser();
  return user ? { Authorization: `Bearer ${user.access_token}` } : {};
}

/** Returns the trainer profile fields from localStorage, or null if not stored / not logged in. */
export function getTrainerProfile(): TrainerProfile | null {
  const user = getStoredUser();
  if (!user) return null;
  // Only return a profile if the core trainer fields are present
  if (!user.trainer_class) return null;
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name ?? user.username,
    section: user.section ?? '',
    trainer_class: user.trainer_class,
    trainer_card_color: user.trainer_card_color ?? '#EF4444',
    starter_pokemon: user.starter_pokemon ?? 'bulbasaur',
    hometown: user.hometown ?? 'Pallet Town',
    favorite_type: user.favorite_type ?? 'Normal',
    trainer_title: user.trainer_title ?? 'Trainer',
    rival_name: user.rival_name ?? '',
    trainer_id: user.trainer_id ?? '',
  };
}
