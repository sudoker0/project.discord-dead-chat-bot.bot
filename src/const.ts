import { ButtonBuilder, ButtonStyle, Collection, Interaction } from "discord.js"
import { Level } from "level"
import { join } from "path"

//? ----- Type and enum definition -----

enum LogLevel {
    VERBOSE = "VERBOSE",
    NORMAL = "NORMAL",
    WARNING = "WARNING",
    ERROR = "ERROR",
    NOTICE = "NOTICE",
}

enum ConfigType {
    BOOLEAN = "boolean (true/false)",
    NUMBER = "number",
    STRING = "string",
    CHANNEL = "channel (format: #<channel_name>)",
    CHANNEL_LIST = "list of channel (format: #<channel_name_1>,#<channel_name_2>,..."
}

//? ----- Variable and constant -----

const REPO_URL = "https://github.com/sudoker0/project.discord-dead-chat-bot.bot"

const CHANNEL_REGEX = /^<#(\d+)>$/
const RESET_VALUE = "<reset>"
const THEME_COLOR = 0x5865f2
const MODAL_LIMIT = 2048
const STARTUP_TIME = new Date()

const DEFAULT_CONFIG: Config = {
    allow_bot_to_revive: false,
    exclude_channel: [],
    //include_deleted_message: true,
    leaderboard_enable: true,
    leaderboard_limit: 10,
    leaderboard_show_reviver: false,
    logging_channel: "",
    message_to_print: "The channel <channel> has died for <time_in_seconds> seconds, and <reviver> has revived the chat.",
    min_timeout: 10000,
    notification_channel: "",
}

const CONFIG_EXPLAIN: {
    [x in keyof typeof DEFAULT_CONFIG]: [string, ConfigType]
} = {
    allow_bot_to_revive: [
        "Should the message of some bot revive (un-dead) the chat",
        ConfigType.BOOLEAN
    ],
    exclude_channel: [
        "List of channels to be excluded from dead chat tracking (by default, this is empty)",
        ConfigType.CHANNEL_LIST
    ],
    // include_deleted_message: [
    //     "Should the last messages of a channel, which has been deleted, still be considered as the last message",
    //     ConfigType.BOOLEAN
    // ],
    leaderboard_enable: [
        "Should the leaderboard for top dead channel in the server be enabled",
        ConfigType.BOOLEAN
    ],
    leaderboard_limit: [
        "Limit for the amount of entry in the leaderboard",
        ConfigType.NUMBER
    ],
    leaderboard_show_reviver: [
        "Should the reviver be shown on the leaderboard",
        ConfigType.BOOLEAN
    ],
    logging_channel: [
        "Channel to receive warning/error info of the bot (by default, no logging message will be sent unless the bot was configured to send to a specific channel)",
        ConfigType.CHANNEL
    ],
    message_to_print: [
        "Message to print when the chat is revived (for more information on how to write messages, please refer to the bot's README's repository.)",
        ConfigType.STRING
    ],
    min_timeout: [
        "Minimum time in milliseconds before the chat is considered 'dead' (min value: 1)",
        ConfigType.NUMBER
    ],
    notification_channel: [
        "Channel to receive the 'chat is revived' messages (by default, the message will be sent to the channel that has been 'revived')",
        ConfigType.CHANNEL
    ],
}

const INTERACTION_BACK_BUTTON = () => new ButtonBuilder()
    .setCustomId("back")
    .setLabel("Back")
    .setStyle(ButtonStyle.Primary)
const INTERACTION_NEXT_BUTTON = () => new ButtonBuilder()
    .setCustomId("next")
    .setLabel("Next")
    .setStyle(ButtonStyle.Primary)

const SLASH_COMMANDS_COLLECTION = new Collection<string, (interaction: Interaction) => Promise<void>>()

const LAST_MESSAGE_DB = new Level<string, LastMessageChannels>(join(__dirname, "db/lastMessage"), { valueEncoding: "json" })
const CONFIG_DB = new Level<string, Config>(join(__dirname, "db/config"), { valueEncoding: "json" })
const STATUS_DB = new Level<string, boolean>(join(__dirname, "db/status"), { valueEncoding: "json" })
const INFO_DB = new Level<number, Info>(join(__dirname, "db/info"), { valueEncoding: "json" })
const LEADERBOARD_DB = new Level<string, Leaderboard>(join(__dirname, "db/leaderboard"), { valueEncoding: "json" })

const DATABASES = {
    "lastMessage": {
        value: LAST_MESSAGE_DB,
        resettable: false
    },
    "config": {
        value: CONFIG_DB,
        resettable: true
    },
    "status": {
        value: STATUS_DB,
        resettable: false
    },
    "info": {
        value: INFO_DB,
        resettable: false
    },
    "leaderboard": {
        value: LEADERBOARD_DB,
        resettable: true
    }
}

export {
    LogLevel,
    ConfigType,
    CHANNEL_REGEX,
    RESET_VALUE,
    THEME_COLOR,
    DEFAULT_CONFIG,
    CONFIG_EXPLAIN,
    SLASH_COMMANDS_COLLECTION,
    MODAL_LIMIT,
    INTERACTION_BACK_BUTTON,
    INTERACTION_NEXT_BUTTON,
    STARTUP_TIME,
    REPO_URL,
    DATABASES,
}