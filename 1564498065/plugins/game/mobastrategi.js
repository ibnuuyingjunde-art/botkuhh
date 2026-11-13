import { games } from '../../src/lib/ichigo-games.js'

games.register('mobastrategi', {
    alias: ['moba', 'battlestrategi', 'mobastra'],
    emoji: '⚔️',
    title: 'MOBA STRATEGI',
    description: 'Tebak skill terbaik dalam situasi battle MOBA!',
    timeout: 60000,
    cooldown: 5,
    dataFile: 'mobastrategi.json',
    questionField: 'soal',
    answerField: 'jawaban',
    hasImage: false,
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('mobastrategi')
export { pluginConfig as config, handler, answerHandler }