import {
    ConfigType,
    RESET_VALUE,
    CHANNEL_REGEX,
    LogLevel,
    SLASH_COMMANDS_COLLECTION,
    DATABASES
} from "./const"
import {
    updateConfigDB,
    updateLastMessageDB,
    updateLeaderboardDB,
    updateStatusDB
} from "./updateDatabase"
import chalk from "chalk"
import { ActivityType, Client, Message, PresenceStatusData, REST, Routes } from "discord.js"
import { join } from "path"
import { upgradeConfig } from "./configUpgrader"
import { Level } from "level"

function configValueValidator(type: ConfigType, value: string) {
    var good = true, regex: RegExp | null = null, v = value
    switch (type) {
        case ConfigType.BOOLEAN:
            regex = /^(true|false)$/
            break
        case ConfigType.CHANNEL:
            regex = CHANNEL_REGEX
            break
        case ConfigType.CHANNEL_LIST:
            v = v.split(",").map(v => v.trim()).filter(v => v != "").join(",")
            regex = /^(<#\d+>(,)?)*$/
            break
        case ConfigType.NUMBER:
            regex = /^\d+$/
            break
        case ConfigType.STRING:
            regex = /^.*$/
            break
    }
    if (!regex.test(v)) good = false
    if (value == RESET_VALUE) good = true

    return good
}

function configValueConverter(type: ConfigType, value: string) {
    var returnValue = null
    switch (type) {
        case ConfigType.BOOLEAN:
            returnValue = (value == "true")
            break
        case ConfigType.CHANNEL:
            returnValue = value.replace(CHANNEL_REGEX, "$1")
            break
        case ConfigType.CHANNEL_LIST:
            returnValue = value.split(",")
                .map(v => v.trim().replace(CHANNEL_REGEX, "$1"))
                .filter(v => v != "")
            break
        case ConfigType.NUMBER:
            returnValue = Number(value)
            break
        case ConfigType.STRING:
            returnValue = value
            break
    }
    if (value == RESET_VALUE) returnValue = value

    return returnValue
}

function findInsertPosition<T>(arr: T[], a: T) {
    let left = 0
    let right = arr.length - 1

    while (left <= right) {
        const mid = Math.floor((left + right) / 2)

        if (arr[mid] === a) {
            return mid
        }

        if (arr[mid] < a) {
            right = mid - 1
        } else {
            left = mid + 1
        }
    }

    return left
}

async function log(message: string, level: LogLevel = LogLevel.NORMAL, serverToSend: string = "") {
    var content = "", logColor: chalk.Chalk
    if (serverToSend != "") content += `[SERVER: ${serverToSend}] `

    switch (level) {
        case LogLevel.VERBOSE:
            content += "[VERBOSE] "
            logColor = chalk.cyan
            break
        case LogLevel.NORMAL:
        default:
            content += "[LOG] "
            logColor = chalk.white
            break
        case LogLevel.WARNING:
            content += "[WARNING] "
            logColor = chalk.yellow
            break
        case LogLevel.ERROR:
            content += "[ERROR] "
            logColor = chalk.red
            break
        case LogLevel.NOTICE:
            content += "[NOTICE] "
            logColor = chalk.blue
            break
    }
    content += message

    console.log(logColor(content))
    if (serverToSend != "") {
        // const CONFIG = await DATABASES.config.value.get(serverToSend)
        // if (CONFIG == undefined) return

        // const CHANNEL = CLIENT.channels.cache.get(CONFIG.logging_channel)
        // if (CHANNEL?.isTextBased()) {
        //     CHANNEL.send(content)
        // }
    }
}

function getDifferentElements<T>(a: T[], b: T[]) {
    const setA = new Set(a)
    const setB = new Set(b)

    const diffA = [...setA].filter((element) => !setB.has(element))
    const diffB = [...setB].filter((element) => !setA.has(element))
    const same = [...setA].filter((element) => setB.has(element))

    return { diffA, diffB, same }
}

async function getServerDiff<T>(CLIENT: Client, DB: Level<string, T>, guildID: string = "") {
    //? diffA: arrA - arrB (server joined by bot but not updated)
    //? diffB: arrB - arrA (server no longer exist but still in the last message db)
    //? same: intersection(arrA, arrB)

    const JOINED_SERVERS = CLIENT.guilds.cache.map(v => v.id) //? arrA
    const DATABASE_TO_CHECK = (await DB.iterator({ valueEncoding: "json" }).all()).map(v => v[0]) //? arrB

    const { diffA, diffB, same } = getDifferentElements<string>(JOINED_SERVERS, DATABASE_TO_CHECK)
    var newAndExistServer = new Set([...diffA, ...same])
    var removeServer = diffB

    if (guildID != "") {
        if (guildID[0] == "+") newAndExistServer = new Set([guildID.slice(1)])
        else if (guildID[0] == "-") removeServer = [guildID.slice(1)]
    }

    return { newAndExistServer, removeServer }
}

async function reloadDatabase(CLIENT: Client, database: keyof typeof DATABASES | "" = "", guildId: string = "") {
    switch (database) {
        case "":
        case "lastMessage":
            await log(`Updating last message database`)
            await updateLastMessageDB(CLIENT, guildId)
            if (database == "lastMessage") break
        case "config":
            await log(`Updating config database`)
            await updateConfigDB(CLIENT, guildId)
            if (database == "config") break
        case "status":
            await log(`Updating status database`)
            await updateStatusDB(CLIENT, guildId)
            if (database == "status") break
        case "leaderboard":
            await log(`Updating leaderboard database`)
            await updateLeaderboardDB(CLIENT, guildId)
            if (database == "leaderboard") break
        case "info":
            if (database == "info") break
        default:
            break
    }

    await log(`All database has been updated`)
}

async function sendDeadChatMessage(CLIENT: Client, messageData: Message, delta_time: number) {
    if (messageData.guildId == null) return
    const CONFIG = await DATABASES.config.value.get(messageData.guildId)
    if (CONFIG == undefined) return
    const ID = CONFIG.notification_channel == "" ? messageData.channelId : CONFIG.notification_channel

    const CHANNEL = CLIENT.channels.cache.get(ID)
    if (!CHANNEL?.isTextBased()) return

    var stringContent = CONFIG.message_to_print
    stringContent = stringContent.replace(/<.*?>/g, (matched) => {
        switch (matched) {
            case "<channel>":
                return `<#${messageData.channelId}>`
            case "<time_in_seconds>":
                return Math.round(delta_time / 1000).toString()
            case "<reviver>":
                return `<@!${messageData.author.id}>`
            default:
                return matched
        }
    })

    CHANNEL.send(stringContent)
}

async function updateStatus(CLIENT: Client, status: PresenceStatusData) {
    await log(`Updating bot status`)
    var count = 0
    for await (const _ of DATABASES.lastMessage.value.keys()) { count++ }
    CLIENT.user?.setPresence({
        activities: [
            {
                name: `for dead chats on ${count} servers`,
                type: ActivityType.Watching
            }
        ],
        status: status
    })
}

async function registerSlashCommand(SLASH_COMMANDS: SlashCommands) {
    const COMMANDS = []
    for (const i of SLASH_COMMANDS) {
        COMMANDS.push(i.commands.toJSON())
    }

    const REST_REQ = new REST().setToken(process.env.TOKEN || "")

    try {
		await REST_REQ.put(
			Routes.applicationCommands(process.env.APPLICATION_ID || ""),
			{ body: COMMANDS },
		)

	} catch (error) {
		console.error(error)
	}

    for (const i of SLASH_COMMANDS) {
        SLASH_COMMANDS_COLLECTION.set(i.commands.name, i.execute)
    }
}

async function checkVersion() {
    //? Check if info db is created
    try {
        await DATABASES.info.value.get(0)
    }
    catch {
        const { version, config_version } = require(join(__dirname, "../package.json"))
        await DATABASES.info.value.put(0, {
            config_version: config_version,
        })
    }

    const INFO_FROM_DB = await DATABASES.info.value.get(0)
    const { config_version } = require(join(__dirname, "../package.json"))
    const INFO_FROM_PACKAGE_JSON: Info = {
        config_version: config_version
    }

    // if (version != some_source_on_the_internet) {
    //     log(`An update is available (${INFO_FROM_DB.version} -> ${INFO_FROM_PACKAGE_JSON.version}). To update, run: "git pull".`, LogLevel.NOTICE)
    // }

    if (INFO_FROM_DB.config_version != INFO_FROM_PACKAGE_JSON.config_version) {
        log(`Now upgrading config`)
        await upgradeConfig(INFO_FROM_DB.config_version, INFO_FROM_PACKAGE_JSON.config_version, DATABASES.config.value)
    }
}

async function updateLeaderboard(guildID: string, item: Leaderboard[number] | null = null) {
    var leaderboard = await DATABASES.leaderboard.value.get(guildID)
    const CONFIG = await DATABASES.config.value.get(guildID)
    if (CONFIG == undefined) return
    if (!CONFIG.leaderboard_enable) return

    if (item == null) {
        await log(`Refreshing the leaderboard`)
        leaderboard = leaderboard.slice(0, CONFIG.leaderboard_limit)
    } else {
        await log(`Adding entry to the leaderboard`)
        const POS = findInsertPosition<number>(leaderboard.map(v => v.duration), item.duration)
        leaderboard.splice(POS, 0, item)
        if (leaderboard.length > CONFIG.leaderboard_limit) leaderboard.pop()
    }

    await DATABASES.leaderboard.value.put(guildID, leaderboard)
}

function splitStringIntoBlocks(str: string, blockSize: number) {
    var blocks = []
    var length = str.length

    for (var i = 0; i < length; i += blockSize) {
        blocks.push(str.substring(i, i + blockSize))
    }

    return blocks
}

export {
    configValueValidator,
    configValueConverter,
    log,
    getDifferentElements,
    reloadDatabase,
    sendDeadChatMessage,
    updateStatus,
    registerSlashCommand,
    checkVersion,
    splitStringIntoBlocks,
    getServerDiff,
    updateLeaderboard,
}