import {
    DATABASES,
    LogLevel,
    DEFAULT_CONFIG,
} from "./const"
import { Client, Message } from "discord.js"
import { log } from "./function"
import { getServerDiff } from "./function"

async function updateLastMessageDB(CLIENT: Client, guildID: string) {
    const { newAndExistServer, removeServer } = await getServerDiff(CLIENT, DATABASES.lastMessage.value, guildID)

    for (const i of newAndExistServer) {
        try {
            await DATABASES.lastMessage.value.get(i)
        }
        catch {
            await log(`Server with ID: ${i} hasn't been registered in the "lastMessage" database. The server will now be registered.`, LogLevel.WARNING)
            await DATABASES.lastMessage.value.put(i, {})
        }

        const SERVER = CLIENT.guilds.cache.get(i)
        const CHANNELS = SERVER?.channels.cache

        if (CHANNELS == undefined) {
            await log(`Something has gone wrong while trying to fetch the list of channels from server with ID: ${SERVER?.id}.`, LogLevel.ERROR)
            return
        } else {
            var dataToAdd: LastMessageChannels = {}
            for (const c of CHANNELS) {
                const CHANNEL = c[1]
                if (!CHANNEL.isTextBased()) continue

                var lastMsg: Message | undefined = undefined

                try {
                    lastMsg = (await CHANNEL.messages.fetch({ "limit": 1, "cache": false })).at(0)
                } catch {
                    await log(`Something has gone wrong while trying to fetch messages from channel: ${CHANNEL.id} from server with ID: ${SERVER?.id}.`, LogLevel.WARNING)
                }

                if (lastMsg == undefined) continue
                dataToAdd[CHANNEL.id] = {
                    last_id: lastMsg.id,
                    timestamp: lastMsg.createdTimestamp
                }
            }
            await DATABASES.lastMessage.value.put(i, dataToAdd)
        }
    }
    for (const i of removeServer) {
        try {
            await DATABASES.lastMessage.value.del(i)
        }
        catch {
            await log(`Unable to remove sever with ID: ${i} from lastMessage database. This is likely because the bot have been removed from the server but have not updated it's database accordingly.`, LogLevel.WARNING)
            continue
        }
    }
}

async function updateConfigDB(CLIENT: Client, guildID: string) {
    const { newAndExistServer, removeServer } = await getServerDiff(CLIENT, DATABASES.config.value, guildID)

    for (const i of newAndExistServer) {
        try {
            await DATABASES.config.value.get(i)
        }
        catch {
            await log(`Server with ID: ${i} hasn't been registered in the "config" database. The server will now be registered.`, LogLevel.WARNING)
            await DATABASES.config.value.put(i, DEFAULT_CONFIG)
        }
    }

    for (const i of removeServer) {
        try {
            await DATABASES.config.value.del(i)
        }
        catch {
            await log(`Unable to remove sever with ID: ${i} from DATABASES.config.value database. This is likely because the bot have been removed from the server but have not updated it's database accordingly.`, LogLevel.WARNING)
            continue
        }
    }
}

async function updateStatusDB(CLIENT: Client, guildID: string) {
    const { newAndExistServer, removeServer } = await getServerDiff(CLIENT, DATABASES.status.value, guildID)

    for (const i of newAndExistServer) {
        try {
            await DATABASES.status.value.get(i)
        }
        catch {
            await log(`Server with ID: ${i} hasn't been registered in the "status" database. The server will now be registered.`, LogLevel.WARNING)
            await DATABASES.status.value.put(i, false)
        }
    }

    for (const i of removeServer) {
        try {
            await DATABASES.status.value.del(i)
        }
        catch {
            await log(`Unable to remove sever with ID: ${i} from DATABASES.status.value database. This is likely because the bot have been removed from the server but have not updated it's database accordingly.`, LogLevel.WARNING)
            continue
        }
    }
}

async function updateLeaderboardDB(CLIENT: Client, guildID: string) {
    const { newAndExistServer, removeServer } = await getServerDiff(CLIENT, DATABASES.leaderboard.value, guildID)

    for (const i of newAndExistServer) {
        const CONFIG = await DATABASES.config.value.get(i)
        if (CONFIG == undefined) continue
        if (!CONFIG.leaderboard_enable) continue

        try {
            await DATABASES.leaderboard.value.get(i)
        }
        catch {
            await log(`Server with ID: ${i} hasn't been registered in the "leaderboard" database. The server will now be registered.`, LogLevel.WARNING)
            await DATABASES.leaderboard.value.put(i, [])
        }
    }

    for (const i of removeServer) {
        try {
            await DATABASES.leaderboard.value.del(i)
        }
        catch {
            await log(`Unable to remove sever with ID: ${i} from DATABASES.leaderboard.value database. This is likely because the bot have been removed from the server but have not updated it's database accordingly.`, LogLevel.WARNING)
            continue
        }
    }
}

export {
    updateConfigDB,
    updateLastMessageDB,
    updateStatusDB,
    updateLeaderboardDB,
}