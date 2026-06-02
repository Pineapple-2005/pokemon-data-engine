import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Pokemon } from '../common/interfaces/pokemon.interface';
import { parseShowdownTeam } from './showdown.parser';

export interface PokemonFilterParams {
  role?: string;
  type?: string;
  is_assigned?: number;
  native_region?: string;
  restricted_status?: string;
}

@Injectable()
export class PokemonService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(filters: PokemonFilterParams = {}): Promise<Pokemon[]> {
    return this.db.findAllPokemon({
      is_assigned: filters.is_assigned,
      role_label: filters.role,
      type_1: filters.type,
      native_region: filters.native_region,
      restricted_status: filters.restricted_status,
    });
  }

  async findByRegion(region: string): Promise<Pokemon[]> {
    const normalized = region.charAt(0).toUpperCase() + region.slice(1).toLowerCase();
    return this.db.findAllPokemon({ native_region: normalized, restricted_status: 'none' });
  }

  async findAssigned(): Promise<Pokemon[]> {
    return this.db.findAssignedPokemon();
  }

  async findOne(name: string): Promise<Pokemon> {
    const pokemon = await this.db.findPokemonByName(name);
    if (!pokemon) {
      throw new NotFoundException({ success: false, error: `Pokémon "${name}" not found.` });
    }
    return pokemon;
  }

  async getMyPool(userId: string): Promise<Array<Pokemon & { user_assigned: boolean }>> {
    return this.db.getPokemonWithUserPool(userId);
  }

  async assignToUser(userId: string, pokemonId: number): Promise<void> {
    return this.db.assignPokemonToUser(userId, pokemonId);
  }

  async unassignFromUser(userId: string, pokemonId: number): Promise<void> {
    return this.db.unassignPokemonFromUser(userId, pokemonId);
  }

  /**
   * Parses a Pokémon Showdown export string, looks each name up in the DB,
   * and returns which were found and which were not.
   */
  async importTeam(showdownText: string): Promise<{ found: Pokemon[]; not_found: string[] }> {
    const names = parseShowdownTeam(showdownText);
    const found: Pokemon[] = [];
    const not_found: string[] = [];

    for (const name of names) {
      const pokemon = await this.db.findPokemonByName(name);
      if (pokemon) {
        found.push(pokemon);
      } else {
        not_found.push(name);
      }
    }

    return { found, not_found };
  }
}
