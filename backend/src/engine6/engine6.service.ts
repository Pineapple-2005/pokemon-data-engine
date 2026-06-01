import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../database/database.service';

export interface ChatResponse {
  answer: string;
  sources: string[];
}

interface PokemonRow {
  name: string;
  type_1: string;
  type_2?: string;
  hp: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
  total_base_stats: number;
  role_label: string;
  weakness_count: number;
  resistance_count: number;
}

@Injectable()
export class Engine6Service {
  private readonly logger = new Logger(Engine6Service.name);
  private readonly anthropic: Anthropic;

  constructor(private readonly db: DatabaseService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async chat(question: string): Promise<ChatResponse> {
    // Fetch all Pokemon
    const result = await this.db.query(
      `SELECT name, type_1, type_2, hp, attack, defense, special_attack,
              special_defense, speed, total_base_stats, role_label,
              weakness_count, resistance_count
       FROM pokemon_data
       ORDER BY total_base_stats DESC`,
      [],
    );
    const allPokemon = result.rows as PokemonRow[];

    // Filter to top 10 most relevant by keyword match
    const questionLower = question.toLowerCase();
    const matched = allPokemon.filter((p) => {
      const nameLower = p.name.toLowerCase();
      const t1Lower = (p.type_1 ?? '').toLowerCase();
      const t2Lower = (p.type_2 ?? '').toLowerCase();
      const roleLower = (p.role_label ?? '').toLowerCase();
      return (
        questionLower.includes(nameLower) ||
        (t1Lower && questionLower.includes(t1Lower)) ||
        (t2Lower && questionLower.includes(t2Lower)) ||
        (roleLower && questionLower.includes(roleLower))
      );
    });

    // Fill up to 10 with highest BST if fewer matched
    const topPokemon: PokemonRow[] = [...matched];
    if (topPokemon.length < 10) {
      for (const p of allPokemon) {
        if (topPokemon.length >= 10) break;
        if (!topPokemon.find((x) => x.name === p.name)) {
          topPokemon.push(p);
        }
      }
    }
    const context10 = topPokemon.slice(0, 10);

    // Build context string
    const contextLines = context10.map((p) => {
      const typeStr = p.type_2 ? `${p.type_1}/${p.type_2}` : p.type_1;
      return `- ${p.name}: Type=${typeStr}, BST=${p.total_base_stats}, Role=${p.role_label}, HP=${p.hp}, ATK=${p.attack}, DEF=${p.defense}, SPA=${p.special_attack}, SPD=${p.special_defense}, SPE=${p.speed}, Weaknesses=${p.weakness_count}, Resistances=${p.resistance_count}`;
    });
    const context = `Available Pokemon data:\n${contextLines.join('\n')}`;

    const prompt = `You are Professor Oak, a Pokemon expert. Using only the Pokemon data provided below, answer the trainer's question helpfully and accurately. Speak in Professor Oak's voice — knowledgeable, encouraging, and enthusiastic about Pokemon research. Call the user "Trainer". Keep your answer to 3-5 sentences unless the question asks for a team recommendation (up to 8 sentences).

${context}

Trainer's question: ${question}

Provide a helpful answer based on the data. If asking for team recommendations, suggest specific Pokemon with brief reasoning using their stats.`;

    this.logger.log(`Engine6: answering question "${question.slice(0, 60)}..."`);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const answer =
      message.content[0].type === 'text' ? message.content[0].text : '';
    const sources = context10.map((p) => p.name);

    return { answer, sources };
  }
}
