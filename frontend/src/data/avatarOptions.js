// 10 preset avatars - emoji-based, so there's no copyright concern and
// no image assets to manage. Each user picks one; we store just the `id`
// string in the database (e.g. "fox"), and look up the emoji/color here.
export const AVATAR_OPTIONS = [
  { id: 'boy',   emoji: '👦', gradient: 'from-blue-400 to-blue-600' },
  { id: 'girl',  emoji: '👧', gradient: 'from-pink-400 to-pink-600' },
  { id: 'man',   emoji: '👨', gradient: 'from-indigo-400 to-indigo-600' },
  { id: 'woman', emoji: '👩', gradient: 'from-purple-400 to-purple-600' },
  { id: 'cat',   emoji: '🐱', gradient: 'from-orange-400 to-orange-600' },
  { id: 'panda', emoji: '🐼', gradient: 'from-teal-400 to-teal-600' },
  { id: 'fox',   emoji: '🦊', gradient: 'from-amber-400 to-amber-600' },
  { id: 'robot', emoji: '🤖', gradient: 'from-gray-400 to-gray-600' },
  { id: 'ninja', emoji: '🥷', gradient: 'from-slate-500 to-slate-700' },
  { id: 'alien', emoji: '👽', gradient: 'from-green-400 to-green-600' },
]

export const getAvatarById = (id) => AVATAR_OPTIONS.find(a => a.id === id) || null