export const SENTENCE_TOPIC_OPTIONS = [
  { value: 'random', label: 'Random topic', prompt: null },
  { value: 'sport', label: 'Sport', prompt: 'sports and physical activity' },
  { value: 'work', label: 'Work', prompt: 'professional life and workplaces' },
  { value: 'entertainment', label: 'Entertainment', prompt: 'movies, music, and leisure entertainment' },
  { value: 'travel', label: 'Travel', prompt: 'travelling and exploring new places' },
  { value: 'education', label: 'Education', prompt: 'studying and education' },
  { value: 'health', label: 'Health', prompt: 'health and wellbeing' },
  { value: 'technology', label: 'Technology', prompt: 'technology and innovation' },
  { value: 'relationships', label: 'Relationships', prompt: 'friendships and relationships' },
  { value: 'food', label: 'Food', prompt: 'food, cooking, and dining' },
  { value: 'nature', label: 'Nature', prompt: 'nature and environment' },
];

export const AVAILABLE_SENTENCE_TOPICS = SENTENCE_TOPIC_OPTIONS.filter(
  (topic) => topic.value !== 'random',
);

export function resolveSentenceTopic(value) {
  if (AVAILABLE_SENTENCE_TOPICS.length === 0) {
    throw new Error('No sentence topics configured');
  }

  if (value === 'random') {
    const index = Math.floor(Math.random() * AVAILABLE_SENTENCE_TOPICS.length);
    return AVAILABLE_SENTENCE_TOPICS[index];
  }

  const match = SENTENCE_TOPIC_OPTIONS.find((topic) => topic.value === value);
  if (match && match.value !== 'random') {
    return match;
  }

  return AVAILABLE_SENTENCE_TOPICS[0];
}
