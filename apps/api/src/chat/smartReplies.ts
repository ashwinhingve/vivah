import type { SmartReplySuggestion } from '@smartshaadi/types'

interface RecentMessage {
  senderId: string
  content:  string
  type:     string
}

/**
 * Lightweight rules-based suggestion generator. Three contextual replies
 * tailored to the last incoming message. Designed to ship without LLM
 * latency or cost — the AI service can swap this with a Claude call later
 * by wiring callAiService('/ai/smart-replies', ...) here.
 *
 * Rules favour warm, culturally-appropriate matrimonial tone. Suggestions
 * never quote the other user's text back at them and never promise contact
 * info — Smart Shaadi safety policy keeps phone/email locked.
 */
export function generateSmartReplies(
  myProfileId: string,
  recent: RecentMessage[],
): SmartReplySuggestion[] {
  const lastIncoming = [...recent].reverse().find((m) => m.senderId !== myProfileId)
  if (!lastIncoming) {
    return [
      { text: 'Hi! Lovely to match with you 🌸', tone: 'warm' },
      { text: 'How are you doing today?',         tone: 'friendly' },
      { text: 'Tell me a bit about yourself.',    tone: 'curious' },
    ]
  }

  const text = lastIncoming.content.toLowerCase()

  if (lastIncoming.type === 'PHOTO') {
    return [
      { text: 'You look great!',          tone: 'warm' },
      { text: 'Where was this taken?',    tone: 'curious' },
      { text: '😊',                        tone: 'friendly' },
    ]
  }

  if (lastIncoming.type === 'VOICE') {
    return [
      { text: 'Loved your voice 🎙️',     tone: 'warm' },
      { text: 'Will reply in a bit!',     tone: 'friendly' },
      { text: 'Tell me more about that.', tone: 'curious' },
    ]
  }

  if (/\?\s*$/.test(text)) {
    return [
      { text: 'Good question — let me think 😊', tone: 'friendly' },
      { text: 'Yes, definitely!',                tone: 'warm' },
      { text: 'Honestly, not sure — you?',       tone: 'curious' },
    ]
  }

  if (/\b(hi|hello|hey|namaste|namaskar)\b/.test(text)) {
    return [
      { text: 'Hi! Nice to hear from you 🌸',     tone: 'warm' },
      { text: 'Hello! How is your day going?',    tone: 'friendly' },
      { text: 'Hey! What do you like doing for fun?', tone: 'curious' },
    ]
  }

  if (/\b(how are you|how r u|kaise ho|kaise hain)\b/.test(text)) {
    return [
      { text: 'Doing great, thanks for asking 🌸 You?', tone: 'warm' },
      { text: 'Pretty good! Just busy with work.',      tone: 'friendly' },
      { text: 'All well — what about you?',             tone: 'curious' },
    ]
  }

  if (/\b(family|parents|mom|dad|mummy|papa)\b/.test(text)) {
    return [
      { text: 'My family is everything to me too 💛',   tone: 'warm' },
      { text: 'Tell me more about your family!',        tone: 'curious' },
      { text: 'That sounds lovely.',                    tone: 'friendly' },
    ]
  }

  if (/\b(work|job|company|office)\b/.test(text)) {
    return [
      { text: 'That sounds interesting! How long?',     tone: 'curious' },
      { text: 'Wow, must be busy days 😊',              tone: 'warm' },
      { text: 'Do you enjoy it?',                       tone: 'friendly' },
    ]
  }

  return [
    { text: 'That\'s lovely to hear 🌸',           tone: 'warm' },
    { text: 'Tell me more about that!',            tone: 'curious' },
    { text: 'Haha, I can relate 😊',               tone: 'friendly' },
  ]
}
