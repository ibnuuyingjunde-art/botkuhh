import { games } from '../../src/lib/ichigo-games.js'

games.register('tebakanime', {
    
    alias: ['tkanime', 'guessanime', 'ta'],
    emoji: '🎌',
    title: 'TEBAK ANIME',
    description: 'Tebak judul anime dari cover/poster-nya',

    timeout: 60000,
    cooldown: 5,

    rewards: {
        energi: 10,
        koin: 1500,
        exp: 3000
    },

    dataFile: 'tebakanime.json',
    questionField: 'deskripsi',
    answerField: 'jawaban',

    hasImage: true,
    imageField: 'img',

    hintCount: 3
})

const { config: pluginConfig, handler, answerHandler } = games.createPlugin('tebakanime')
export { pluginConfig as config, handler, answerHandler }