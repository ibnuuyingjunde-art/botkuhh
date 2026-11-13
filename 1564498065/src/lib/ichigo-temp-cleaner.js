import fs from 'fs'
import path from 'path'
import { logger } from './ichigo-logger.js'

const CLEAN_INTERVAL = 10 * 60 * 1000    
const SIZE_CHECK_INTERVAL = 60 * 1000    
const SIZE_LIMIT = 10 * 1024 * 1024      
const TEMP_DIRS = ['temp', 'tmp']
const SKIP_DIRS = new Set(['antidelete']) // dikelola sendiri oleh ichigo-delete-store.js

let cleanerTimer = null
let sizeWatcherTimer = null
let lastRun = null
let lastCleaned = 0
let lastTrigger = 'interval'  
let totalRuns = 0
let totalCleanedAllTime = 0

function formatBytes(bytes) {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getDirSize(dirPath) {
    let total = 0
    let entries = []
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true })
    } catch {
        return 0
    }
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue
            total += getDirSize(fullPath)
        } else {
            try {
                total += fs.statSync(fullPath).size
            } catch {}
        }
    }
    return total
}

function getDirsSize() {
    let total = 0
    for (const dir of TEMP_DIRS) {
        total += getDirSize(path.join(process.cwd(), dir))
    }
    return total
}

function wipeDirContents(dirPath) {
    let cleaned = 0
    let entries = []
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true })
    } catch {
        return 0
    }
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        try {
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue
                cleaned += wipeDirContents(fullPath)
                fs.rmdirSync(fullPath)
            } else {
                fs.unlinkSync(fullPath)
                cleaned++
            }
        } catch {}
    }
    return cleaned
}

function cleanNow(trigger = 'interval') {
    let totalCleaned = 0
    for (const dir of TEMP_DIRS) {
        const dirPath = path.join(process.cwd(), dir)
        if (!fs.existsSync(dirPath)) continue
        totalCleaned += wipeDirContents(dirPath)
    }

    lastRun = Date.now()
    lastCleaned = totalCleaned
    lastTrigger = trigger
    totalRuns++
    totalCleanedAllTime += totalCleaned

    if (totalCleaned > 0) {
        logger.system('temp', `cleaned ${totalCleaned} file(s) [${trigger}]`)
    }
}

function startTempCleaner() {
    if (cleanerTimer) return

    cleanNow('interval') 

    cleanerTimer = setInterval(() => cleanNow('interval'), CLEAN_INTERVAL)
    if (cleanerTimer.unref) cleanerTimer.unref()

    sizeWatcherTimer = setInterval(() => {
        const size = getDirsSize()
        if (size > SIZE_LIMIT) cleanNow('size')
    }, SIZE_CHECK_INTERVAL)
    if (sizeWatcherTimer.unref) sizeWatcherTimer.unref()

    logger.success('temp', `auto-clean every ${CLEAN_INTERVAL / 60000}m, or instantly if >${(SIZE_LIMIT / 1024 / 1024).toFixed(0)}MB (rekursif)`)
}

function stopTempCleaner() {
    if (cleanerTimer) {
        clearInterval(cleanerTimer)
        cleanerTimer = null
    }
    if (sizeWatcherTimer) {
        clearInterval(sizeWatcherTimer)
        sizeWatcherTimer = null
    }
}

function getTempCleanerStats() {
    return {
        lastRun,
        lastCleaned,
        lastTrigger,
        totalRuns,
        totalCleanedAllTime,
        intervalMs: CLEAN_INTERVAL,
        sizeLimitBytes: SIZE_LIMIT,
        active: cleanerTimer !== null,
    }
}

export { startTempCleaner, stopTempCleaner, getTempCleanerStats }