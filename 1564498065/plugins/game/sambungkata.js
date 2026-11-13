import { games } from '../../src/lib/ichigo-games.js'

games.register('sambungkata', {
    mode: 'chain',
    alias: ['sambkata', 'sw', 'wordchain'],
    emoji: '🔠',
    title: 'SAMBUNG KATA',
    description: 'Sambung kata dari huruf terakhir kata sebelumnya',
    dataFile: 'sambungkata.json',
    turnTimeout: 300000, 
    minWordLength: 3,
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('sambungkata', {
    isGroup: true,
    isPrivate: false,
})
export { pluginConfig as config, handler, answerHandler }