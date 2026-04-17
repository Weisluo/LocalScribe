import type { Character } from '@/types/character';

export interface CapturedCharacterData {
  name: string;
  gender: string;
  birth_date: string | undefined;
  birthplace: string | undefined;
  race: string | undefined;
  faction: string | undefined;
  level: string;
  quote: string | undefined;
  avatar: string | undefined;
  full_image: string | undefined;
  first_appearance_volume: string | undefined;
  first_appearance_act: string | undefined;
  first_appearance_chapter: string | undefined;
  last_appearance_volume: string | undefined;
  last_appearance_act: string | undefined;
  last_appearance_chapter: string | undefined;
  aliases: Array<{ alias_type: string; content: string }>;
  cards: Array<{ title: string; icon: string | undefined; content: unknown[] }>;
  relationships: Array<{
    target_character_id: string | undefined;
    target_name: string | undefined;
    relation_type: string;
    description: string | undefined;
    strength: number;
    is_bidirectional: boolean;
    reverse_description: string | undefined;
  }>;
  artifacts: Array<{
    name: string;
    quote: string | undefined;
    description: string | undefined;
    artifact_type: string | undefined;
    rarity: string | undefined;
    image: string | undefined;
  }>;
}

export function captureCharacterData(character: Character): Record<string, unknown> {
  return {
    name: character.name,
    gender: character.gender,
    birth_date: character.birth_date,
    birthplace: character.birthplace,
    race: character.race,
    faction: character.faction,
    level: character.level,
    quote: character.quote,
    avatar: character.avatar,
    full_image: character.full_image,
    first_appearance_volume: character.first_appearance_volume,
    first_appearance_act: character.first_appearance_act,
    first_appearance_chapter: character.first_appearance_chapter,
    last_appearance_volume: character.last_appearance_volume,
    last_appearance_act: character.last_appearance_act,
    last_appearance_chapter: character.last_appearance_chapter,
    aliases: character.aliases?.map(alias => ({
      alias_type: alias.alias_type,
      content: alias.content,
    })) || [],
    cards: character.cards?.map(card => ({
      title: card.title,
      icon: card.icon,
      content: card.content,
    })) || [],
    relationships: character.relationships?.map(rel => ({
      target_character_id: rel.target_character_id,
      target_name: rel.target_name,
      relation_type: rel.relation_type,
      description: rel.description,
      strength: rel.strength,
      is_bidirectional: rel.is_bidirectional,
      reverse_description: rel.reverse_description,
    })) || [],
    artifacts: character.artifacts?.map(artifact => ({
      name: artifact.name,
      quote: artifact.quote,
      description: artifact.description,
      artifact_type: artifact.artifact_type,
      rarity: artifact.rarity,
      image: artifact.image,
    })) || [],
  };
}
