// TODO: Create the function for the "MessageDelete" event

import {
    Client,
    Events,
    GatewayIntentBits,
    Message,
    Partials,
} from "discord.js"
import {
    DATABASES,
    LogLevel,
    SLASH_COMMANDS_COLLECTION,
} from "./const"
import {
    checkVersion,
    log,
    registerSlashCommand,
    reloadDatabase,
    sendDeadChatMessage,
    updateLeaderboard,
    updateStatus
} from "./function"
import { config } from "dotenv"
import { SLASH_COMMANDS } from "./slashCommand"
config()

//? ----- Variable and constant -----

var ready = false

const CLIENT = new Client({
    "intents": [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ],
    "partials": [
        Partials.Message, Partials.Channel
    ]
})

//? ----- Events -----

CLIENT.on(Events.MessageCreate, async (e) => {
    if (!ready) return
    if (e.guildId == null) return

    const CONFIG = await DATABASES.config.value.get(e.guildId)
    if (CONFIG == undefined) return
    if (!(await DATABASES.status.value.get(e.guildId))) return

    await log(`New message with ID: ${e.id} from channel: ${e.channelId} in server: ${e.guildId}.`)

    if (!CONFIG.allow_bot_to_revive && e.author.bot) {
        await log(`Ignoring the new messages since it's from a bot`)
        return
    }

    if (CONFIG.exclude_channel.includes(e.channelId)) {
        await log(`Channel ${e.channelId} has been excluded from DCT`)
        return
    }

    var channels = (await DATABASES.lastMessage.value.get(e.guildId))
    const MESSAGE = channels[e.channelId]

    if (MESSAGE == undefined) {
        await log(`This is a new message.`)
        channels[e.channelId] = {
            last_id: e.id,
            timestamp: e.createdTimestamp
        }
    } else {
        const NEW_MESSAGE: LastMessage = {
            last_id: e.id,
            timestamp: e.createdTimestamp
        }

        const DELTA_TIME = NEW_MESSAGE.timestamp - MESSAGE.timestamp
        await log(`Time between last and new message was: ${DELTA_TIME}ms`)
        if (DELTA_TIME > CONFIG.min_timeout) {
            await sendDeadChatMessage(CLIENT, e, DELTA_TIME)
            await updateLeaderboard(e.guildId, {
                channel: e.channelId,
                duration: DELTA_TIME,
                reviver: e.author.id
            })
        }

        channels[e.channelId] = NEW_MESSAGE
    }

    await DATABASES.lastMessage.value.put(e.guildId, channels)
})

CLIENT.on(Events.MessageDelete, async (e) => {
    // const CONFIG = await DATABASES.config.value.get(e.guildId || "")
    // if (CONFIG == undefined) return
    // if (CONFIG.include_deleted_message) return

    // await log(`Deleted message with ID: ${e.id} from channel: ${e.channelId} in server: ${e.guildId}. Database will now be updated to the last message still exist in channel.`)

    // var lastMsg: Message | undefined = undefined
    // var lastMessageData: LastMessageChannels = await DATABASES.lastMessage.value.get(e.guildId || "")

    // try {
    //     lastMsg = (await e.channel.messages.fetch({ "limit": 1, "cache": false })).at(0)
    // } catch {
    //     await log(`Something has gone wrong while trying to fetch messages from channel: ${e.channel.id} from server with ID: ${e.guild?.id}.`, LogLevel.WARNING)
    // }

    // if (lastMsg == undefined) return

    // lastMessageData[e.channelId] = {
    //     last_id: lastMsg.id,
    //     timestamp: lastMsg.createdTimestamp
    // }

    // await DATABASES.lastMessage.value.put(e.guildId || "", lastMessageData)
})

//* When the bot joined a guild
CLIENT.on(Events.GuildCreate, async (e) => {
    await log(`Bot has been added to server with ID: ${e.id}`)
    await reloadDatabase(CLIENT, "", `+${e.id}`)
})

CLIENT.on(Events.GuildDelete, async (e) => {
    await log(`Bot has been removed off of server with ID: ${e.id}`)
    await reloadDatabase(CLIENT, "", `-${e.id}`)
})

CLIENT.on(Events.InteractionCreate, async (e) => {
    if (!e.isChatInputCommand()) return

    if (!ready) {
        e.reply("Bot isn't ready yet, please wait.")
        return
    }

    const COMMAND = SLASH_COMMANDS_COLLECTION.get(e.commandName)
    if (!COMMAND) {
        log(`No command matching: ${e.commandName} was found`, LogLevel.ERROR)
        return
    }

    if (!(await DATABASES.status.value.get(e.guildId || ""))) {
        if (e.isChatInputCommand() && (e.commandName != "enable")) {
            await e.reply({
                content: "Bot has been disabled. To enable it, please run `/enable`",
                ephemeral: true
            })
            return
        }
    }

    try {
        await COMMAND(e)
    }
    catch (_) {
        log(`Unable to run the command: ${e.commandName}`, LogLevel.ERROR)
        return
    }
})

CLIENT.once(Events.ClientReady, async () => {
    await updateStatus(CLIENT, "dnd")
    await log(`Loading data`)

    await log(`Checking for latest update`)
    await checkVersion()

    await log(`Registering ${SLASH_COMMANDS.length} slash commands`)
    await registerSlashCommand(SLASH_COMMANDS)

    await log(`Reloading database`)
    await reloadDatabase(CLIENT)

    await log(`Updating bot status`)
    setInterval(updateStatus, 300000, CLIENT, "online")
    await updateStatus(CLIENT, "online")

    await log(`Ready!`)
    ready = true
})

;
(async () => {
    await log(`Initializing`)

    await log(`Logging in`)
    await CLIENT.login(process.env.TOKEN)
})()
