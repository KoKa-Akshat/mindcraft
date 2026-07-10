import type { FolkTaleEntry } from './storyMatch'
import type { Question } from './questionBank'

export interface SparkScene {
  protagonist: string
  setting: string
  storyIntro: string
  bridgeLine: string
}

const INTEREST_NOUN: Record<string, string> = {
  cooking: 'the kitchen',
  music: 'the rhythm',
  basketball: 'the court',
  soccer: 'football',
  gaming: 'the strategy',
  fashion: 'the pattern',
  art: 'the canvas',
  travel: 'the map',
  money: 'the budget',
  space: 'the orbit',
  animals: 'the herd',
  building: 'the blueprint',
  dance: 'the beat',
  film: 'the frame',
  photography: 'the lens',
  science: 'the lab',
  nature: 'the trail',
  cars: 'the engine',
  books: 'the chapter',
  writing: 'the draft',
}

function interestNoun(raw: string): string {
  const key = raw.toLowerCase().trim().split(/\s+/)[0]
  return INTEREST_NOUN[key] ?? raw.trim().toLowerCase()
}

export function weaveSparkIntro(
  interests: string[],
  tale: FolkTaleEntry,
  question: Question,
): SparkScene {
  const protagonist = tale.characters?.[0]?.name ?? tale.title
  const setting = tale.setting
  const a = interests[0] ? interestNoun(interests[0]) : 'what you love'
  const b = interests[1] ? interestNoun(interests[1]) : 'the craft you named'

  const woven =
    question.storyIntro?.trim() ||
    `You told us you care about ${a} and ${b}. ${protagonist} is in ${setting}, and tonight the numbers are not abstract — they decide whether the scene holds.`

  const bridgeLine =
    question.storyContext?.trim() ||
    tale.katha_voice_sample ||
    tale.synopsis.slice(0, 160)

  return { protagonist, setting, storyIntro: woven, bridgeLine }
}
