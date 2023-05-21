import { SlashCommandBuilder, Interaction } from "discord.js"

declare global {
    type LastMessage = {
        last_id: string
        timestamp: number
    }

    type LastMessageChannels = {
        [channel_id in string]: LastMessage
    }

    type Config = {
        logging_channel: string
        min_timeout: number
        exclude_channel: string[]
        message_to_print: string
        // include_deleted_message: boolean
        notification_channel: string
        allow_bot_to_revive: boolean
        leaderboard_enable: boolean
        leaderboard_limit: number
        leaderboard_show_reviver: boolean
    } | undefined

    type ConfigPerServer = {
        [server in string]: Config
    }

    type SlashCommands = {
        commands: Omit<SlashCommandBuilder>,
        execute: (interaction: Interaction) => Promise<void>
    }[]

    type Info = {
        config_version: number
    }

    type Leaderboard = {
        duration: number,
        reviver: string,
        channel: string
    }[]
}