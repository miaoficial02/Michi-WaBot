import { smsg } from './lib/simple.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile } from 'fs'
import chalk from 'chalk'
import fetch from 'node-fetch'
import ws from 'ws'
import fs from 'fs'

const { proto, jidDecode, areJidsSameUser } = (await import('@whiskeysockets/baileys')).default
const isNumber = x => typeof x === 'number' && !isNaN(x)

// --- Utilidades obligatorias ---
const DIGITS = v => (v || '').replace(/\D/g, '')
const numberToJid = num => `${DIGITS(num)}@s.whatsapp.net`
const looksPhoneJid = v => typeof v === 'string' && /^\d+@s\.whatsapp\.net$/.test(v)
const normalizeJid = id => {
    if (!id) return ''
    if (isNumber(id)) return numberToJid(id)
    if (typeof id !== 'string') return ''
    if (/^\d+$/.test(id)) return numberToJid(id)
    if (looksPhoneJid(id)) return id
    if (id.includes('@')) {
        let [user, server] = id.split('@')
        if (server === 's.whatsapp.net') return numberToJid(user)
        if (server === 'lid') return numberToJid(DIGITS(user))
        if (user.includes(':')) user = jidDecode(id)?.user || DIGITS(user)
        return numberToJid(DIGITS(user))
    }
    return numberToJid(DIGITS(id))
}
const sameUser = (a, b) => {
    try {
        return areJidsSameUser(normalizeJid(a), normalizeJid(b))
    } catch {
        return DIGITS(a) === DIGITS(b)
    }
}

// --- Estructuras de datos predeterminadas ---
const defaultUser = {
    exp: 0,
    coin: 10,
    joincount: 1,
    diamond: 3,
    lastadventure: 0,
    health: 100,
    lastclaim: 0,
    lastcofre: 0,
    lastdiamantes: 0,
    lastcode: 0,
    lastduel: 0,
    lastpago: 0,
    lastmining: 0,
    lastcodereg: 0,
    muto: false,
    crime: 0,
    registered: false,
    genre: '',
    birth: '',
    marry: '',
    description: '',
    packstickers: null,
    name: '',
    age: -1,
    regTime: -1,
    afk: -1,
    afkReason: '',
    banned: false,
    useDocument: false,
    bank: 0,
    level: 0,
    role: 'Nuv',
    premium: false,
    premiumTime: 0,
}

const defaultChat = {
    isBanned: false,
    sAutoresponder: '',
    welcome: true,
    autolevelup: false,
    autoresponder: false,
    delete: false,
    autoAceptar: false,
    autoRechazar: false,
    detect: true,
    antiBot: false,
    antiBot2: false,
    modoadmin: false,
    antiLink: true,
    antifake: false,
    reaction: false,
    nsfw: false,
    expired: 0,
    antiLag: false,
    per: [],
}

export async function handler(chatUpdate) {
    this.uptime = this.uptime || Date.now()
    if (!chatUpdate) return

    try {
        this.pushMessage(chatUpdate.messages)
    } catch (e) {
        console.error("Error en pushMessage:", e)
    }

    let m = chatUpdate.messages[chatUpdate.messages.length - 1]
    if (!m) return

    if (global.db.data == null) await global.loadDatabase()

    try {
        m = smsg(this, m) || m
        if (!m) return

        // NO modificamos m.chat ni m.sender directamente, sólo referenciamos valores normalizados
        const mChatJid = normalizeJid(m.chat)
        const mSenderJid = normalizeJid(m.sender)
        if (this.user?.id) this.user.jid = normalizeJid(this.user.id)
        if (this.user?.jid) this.user.jid = normalizeJid(this.user.jid)
        m.mentionedJid = (m.mentionedJid || []).map(normalizeJid)
        if (m.quoted) {
            if (m.quoted.sender) m.quoted.sender = normalizeJid(m.quoted.sender)
            if (m.quoted.participant) m.quoted.participant = normalizeJid(m.quoted.participant)
        }

        let prefixRegex = global.prefix
        try {
            const senderNumber = this.user.jid.split('@')[0]
            const botPath = path.join('./JadiBots', senderNumber)
            const configPath = path.join(botPath, 'config.json')

            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath))
                if (config.prefix) {
                    if (config.prefix === 'multi') {
                        prefixRegex = new RegExp('^[#$@*&?,;:+×!_\\-¿.]')
                    } else {
                        let safe = [...config.prefix].map(c =>
                            c.replace(/([.*+?^${}()|\[\]\\])/g, '\\$1')
                        )
                        prefixRegex = new RegExp('^(' + safe.join('|') + ')')
                    }
                }
            }
        } catch (e) {
            console.error('❌ Error cargando prefijo del subbot:', e)
        }

        m.exp = 0
        m.coin = 0

        try {
            let user = global.db.data.users[mSenderJid]
            if (user) {
                global.db.data.users[mSenderJid] = { ...defaultUser, ...user, name: m.name }
            } else {
                global.db.data.users[mSenderJid] = { ...defaultUser, name: m.name }
            }

            let chat = global.db.data.chats[mChatJid]
            if (chat) {
                global.db.data.chats[mChatJid] = { ...defaultChat, ...chat }
            } else {
                global.db.data.chats[mChatJid] = { ...defaultChat }
            }

            let selfJid = normalizeJid(this.user.jid)
            let settings = global.db.data.settings[selfJid]
            if (settings) {
                if (!('self' in settings)) settings.self = false
                if (!('restrict' in settings)) settings.restrict = true
                if (!('jadibotmd' in settings)) settings.jadibotmd = true
                if (!('antiPrivate' in settings)) settings.antiPrivate = false
                if (!('autoread' in settings)) settings.autoread = false
            } else {
                global.db.data.settings[selfJid] = {
                    self: false,
                    restrict: true,
                    jadibotmd: true,
                    antiPrivate: false,
                    autoread: false,
                    status: 0
                }
            }
        } catch (e) {
            console.error("Error inicializando datos de usuario/chat:", e)
        }

        const user = global.db.data.users[mSenderJid]
        const chat = global.db.data.chats[mChatJid]
        const selfJid = normalizeJid(this.user.jid)
        const settings = global.db.data.settings[selfJid]

        if (chat.isBanned) {
            const textLower = m.text?.toLowerCase() || ''
            if (
                !textLower.startsWith('.unbanchat') &&
                !textLower.startsWith('/unbanchat') &&
                !textLower.startsWith('!unbanchat') &&
                !textLower.startsWith('.desbanearbot') &&
                !textLower.startsWith('/desbanearbot') &&
                !textLower.startsWith('!desbanearbot')
            ) {
                return
            }
        }

        // Gate de bot primario por JID
        if (chat.primaryBot) {
            let primaryBot = normalizeJid(chat.primaryBot)
            if (!sameUser(primaryBot, selfJid) && !sameUser(mSenderJid, selfJid)) return
            if (primaryBot !== chat.primaryBot) chat.primaryBot = primaryBot // Migración silenciosa
        }

        // Roles
        const owners = (global.owner || []).map(([number]) => numberToJid(number))
        const mods = (global.mods || []).map(v => numberToJid(v))
        const prems = (global.prems || []).map(v => numberToJid(v))

        const isROwner = owners.some(jid => sameUser(jid, mSenderJid))
        const isOwner = isROwner || m.fromMe
        const isMods = isROwner || mods.some(jid => sameUser(jid, mSenderJid))
        const isPrems = isROwner || prems.some(jid => sameUser(jid, mSenderJid)) || (user && user.premium)

        if (m.isBaileys) return
        if (opts['nyimak']) return
        if (!isOwner && opts['self']) return
        if (opts['swonly'] && mChatJid !== 'status@broadcast') return
        if (typeof m.text !== 'string') m.text = ''

        m.exp += Math.ceil(Math.random() * 10)

        let usedPrefix

        // Grupo: normalización de participantes y admins
        const groupMetadata = m.isGroup ? (this.chats[mChatJid]?.metadata || await this.groupMetadata(mChatJid).catch(_ => null)) : {}
        const participants = m.isGroup ? (groupMetadata.participants || []).map(p => ({
            jid: normalizeJid(p.id || p.jid || p.participant),
            admin: p.admin
        })) : []
        const senderEntry = participants.find(p => sameUser(p.jid, mSenderJid)) || {}
        const botEntry = participants.find(p => sameUser(p.jid, selfJid)) || {}
        const isRAdmin = senderEntry?.admin === "superadmin"
        const isAdmin = isRAdmin || senderEntry?.admin === "admin"
        const isBotAdmin = botEntry?.admin === "superadmin" || botEntry?.admin === "admin"

        const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
        for (let name in global.plugins) {
            let plugin = global.plugins[name]
            if (!plugin || plugin.disabled) continue

            const __filename = join(___dirname, name)
            if (typeof plugin.all === 'function') {
                try {
                    await plugin.all.call(this, m, { chatUpdate, __dirname: ___dirname, __filename })
                } catch (e) {
                    console.error(`Error en plugin.all: ${name}\n`, e)
                }
            }

            if (!opts['restrict'] && plugin.tags && plugin.tags.includes('admin')) continue

            const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
            let _prefix = plugin.customPrefix ? plugin.customPrefix : this.prefix ? this.prefix : prefixRegex
            let match = (_prefix instanceof RegExp ? [[_prefix.exec(m.text), _prefix]] :
                Array.isArray(_prefix) ? _prefix.map(p => {
                    let re = p instanceof RegExp ? p : new RegExp(str2Regex(p))
                    return [re.exec(m.text), re]
                }) :
                typeof _prefix === 'string' ? [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]] :
                [[[], new RegExp]]
            ).find(p => p[1])

            if (typeof plugin.before === 'function') {
                if (await plugin.before.call(this, m, {
                    match, conn: this, participants, groupMetadata, user: senderEntry, bot: botEntry, isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin, isPrems, chatUpdate, __dirname, __filename
                })) continue
            }
            if (typeof plugin !== 'function') continue

            if ((usedPrefix = (match[0] || '')[0])) {
                let noPrefix = m.text.replace(usedPrefix, '')
                let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
                args = args || []
                let _args = noPrefix.trim().split` `.slice(1)
                let text = _args.join` `
                command = (command || '').toLowerCase()

                let isAccept = plugin.command instanceof RegExp ? plugin.command.test(command) :
                    Array.isArray(plugin.command) ? plugin.command.some(cmd => cmd instanceof RegExp ? cmd.test(command) : cmd === command) :
                    typeof plugin.command === 'string' ? plugin.command === command : false

                if (!isAccept) continue

                if (chat.isBanned && !isROwner && !['grupo-unbanchat.js', 'owner-exec.js', 'owner-exec2.js', 'grupo-delete.js'].includes(name)) return
                if (user.banned && !isROwner) {
                    m.reply(`《✦》Estás baneado/a, no puedes usar comandos.\n\n${user.bannedReason ? `✰ *Motivo:* ${user.bannedReason}` : ''}`)
                    return
                }

                if (chat.modoadmin && m.isGroup && !isAdmin && !isOwner) {
                    m.reply('🛡️ | Modo Admin activado. Solo los administradores pueden usar comandos en este grupo.')
                    continue
                }

                m.plugin = name
                let fail = plugin.fail || global.dfail

                if (plugin.rowner && !isROwner) { fail('rowner', m, this, usedPrefix, command); continue }
                if (plugin.owner && !isOwner) { fail('owner', m, this, usedPrefix, command); continue }
                if (plugin.mods && !isMods) { fail('mods', m, this, usedPrefix, command); continue }
                if (plugin.premium && !isPrems) { fail('premium', m, this, usedPrefix, command); continue }
                if (plugin.group && !m.isGroup) { fail('group', m, this, usedPrefix, command); continue }
                if (plugin.botAdmin && !isBotAdmin) { fail('botAdmin', m, this, usedPrefix, command); continue }
                if (plugin.admin && !isAdmin) { fail('admin', m, this, usedPrefix, command); continue }
                if (plugin.private && m.isGroup) { fail('private', m, this, usedPrefix, command); continue }
                if (plugin.register && !user.registered) { fail('unreg', m, this, usedPrefix, command); continue }

                m.isCommand = true
                let xp = 'exp' in plugin ? parseInt(plugin.exp) : 10
                m.exp += xp
                if (!isPrems && plugin.coin && user.coin < plugin.coin) {
                    this.reply(mChatJid, `❮✦❯ Se agotaron tus monedas.`, m)
                    continue
                }
                if (plugin.level > user.level) {
                    this.reply(mChatJid, `❮✦❯ Se requiere el nivel: *${plugin.level}*\n• Tu nivel actual es: *${user.level}*`, m)
                    continue
                }

                let extra = { match, usedPrefix, noPrefix, _args, args, command, text, conn: this, participants, groupMetadata, user: senderEntry, bot: botEntry, isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin, isPrems, chatUpdate, __dirname, __filename }

                try {
                    await plugin.call(this, m, extra)
                    if (!isPrems) m.coin = m.coin || plugin.coin || 0
                } catch (e) {
                    m.error = e
                    console.error(`Error en plugin: ${name}\n`, e)
                    if (e) {
                        let text = format(e)
                        for (let key of Object.values(global.APIKeys)) text = text.replace(new RegExp(key, 'g'), '*******')
                        m.reply(text)
                    }
                } finally {
                    if (typeof plugin.after === 'function') {
                        try {
                            await plugin.after.call(this, m, extra)
                        } catch (e) {
                            console.error(`Error en plugin.after: ${name}\n`, e)
                        }
                    }
                    if (m.coin) {
                        user.coin -= m.coin
                    }
                }
                break
            }
        }
    } catch (e) {
        console.error("Error en el handler principal:", e)
    } finally {
        if (m) {
            let user = global.db.data.users[normalizeJid(m.sender)]
            if (user) {
                user.exp += m.exp
            }

            if (user && user.muto === true) {
                await this.sendMessage(normalizeJid(m.chat), { delete: m.key })
            }

            if (m.plugin) {
                let stats = global.db.data.stats
                let stat = stats[m.plugin]
                if (stat) {
                    stat.total = (stat.total || 0) + 1
                    stat.last = Date.now()
                    if (m.error == null) {
                        stat.success = (stat.success || 0) + 1
                        stat.lastSuccess = Date.now()
                    }
                } else {
                    stats[m.plugin] = {
                        total: 1,
                        success: m.error == null ? 1 : 0,
                        last: Date.now(),
                        lastSuccess: m.error == null ? Date.now() : 0
                    }
                }
            }
        }

        try {
            if (!opts['noprint']) await (await import('./lib/print.js')).default(m, this)
        } catch (e) {
            console.log(m, m.quoted, e)
        }
        if (opts['autoread']) await this.readMessages([m.key])

        const chat = global.db.data.chats[normalizeJid(m.chat)];
        if (chat && chat.reaction && m.text.match(/(ción|dad|aje|oso|izar|mente|pero|tion|age|ous|ate|and|but|ify|ai|yuki|a|s)/gi)) {
            if (!m.fromMe) {
                const emot = ["❤️", "✨", "🔥", "👍", "😂", "🎉", "😊", "🙏", "💯", "🚀"].getRandom()
                this.sendMessage(normalizeJid(m.chat), { react: { text: emot, key: m.key } })
            }
        }
    }
}

Array.prototype.getRandom = function() {
    return this[Math.floor(Math.random() * this.length)]
}

global.dfail = (type, m, conn, usedPrefix, command) => {
    let user2 = m.pushName || 'Anónimo'
    const msg = {
        rowner: `✦ El comando *${command}* solo puede ser usado por mi creador.`,
        owner: `✦ El comando *${command}* solo puede ser usado por los desarrolladores del bot.`,
        mods: `✦ El comando *${command}* solo puede ser usado por los moderadores del bot.`,
        premium: `✦ El comando *${command}* solo puede ser usado por usuarios premium.`,
        group: `✦ El comando *${command}* solo puede ser usado en grupos.`,
        private: `✦ El comando *${command}* solo puede ser usado en mi chat privado.`,
        admin: `✦ El comando *${command}* solo puede ser usado por los administradores del grupo.`,
        botAdmin: `✦ Para ejecutar el comando *${command}*, debo ser administrador del grupo.`,
        unreg: `✦ Aún no estás registrado/a.\nUsa: *${usedPrefix}reg ${user2}.18*`,
        restrict: `✦ Esta característica está desactivada por el desarrollador.`
    }[type]
    if (msg) return m.reply(msg).then(_ => m.react('✖️'))
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
    unwatchFile(file)
    console.log(chalk.magenta("Se actualizó 'handler.js'"))
    if (global.conns && global.conns.length > 0) {
        const users = [...new Set(global.conns.filter(conn => conn.user && conn.ws.socket && conn.ws.socket.readyState !== ws.CLOSED).map(conn => conn))]
        for (const userr of users) {
            if (typeof userr.subreloadHandler === 'function') {
                userr.subreloadHandler(false)
            }
        }
    }
})
