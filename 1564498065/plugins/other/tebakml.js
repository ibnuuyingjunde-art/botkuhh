import { games } from '../../src/lib/ichigo-games.js'

games.register('tebakml', {
    alias: ['tebakmobalegends', 'tebakhero'],
    emoji: '⚔️',
    title: 'TEBAK ML',
    description: 'Tebak karakter Mobile Legends',
    hasImage: true,
    questionField: 'deskripsi',
    answerField: 'jawaban',
    imageField: 'img'
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('tebakml')
export { pluginConfig as config, handler, answerHandler }