import fetch from 'node-fetch'

let linkRegex = /chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i
let linkRegex1 = /whatsapp\.com\/channel\/[0-9A-Za-z]{20,24}/i
const defaultImage = 'https://files.catbox.moe/ubftco.jpg'

async function getGroupPic(conn, chatId) {
  try {
    return await conn.profilePictureUrl(chatId, 'image')
  } catch {
    return defaultImage
  }
}

const fkontak = {
  key: { participant: '0@s.whatsapp.net', remoteJid: 'status@broadcast', fromMe: false, id: 'B' },
  message: {
    contactMessage: {
      displayName: 'WhatsApp Bot',
      vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;WhatsApp;;;\nFN:Bot\nORG:WhatsApp\nTITLE:\nitem1.TEL;waid=5491112345678:+54 9 11 1234-5678\nitem1.X-ABLabel:📞 WhatsApp\nitem2.EMAIL;type=INTERNET:bot@whatsapp.com\nitem2.X-ABLabel:📧 Email\nitem3.URL:https://web.whatsapp.com\nitem3.X-ABLabel:🌐 Sitio Web\nitem4.ADR;type=HOME:;;🇦🇷 Argentina;;;;\nitem4.X-ABLabel:🏠 Ubicación\nEND:VCARD`
    }
  },
  participant: '0@s.whatsapp.net'
}

const handler = async (m, { conn, command, args, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { 
    text: '🔒 Este comando solo funciona en grupos.', 
    ...global.rcanal 
  }, { quoted: m })

  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
  const chat = global.db.data.chats[m.chat]
  const type = (args[0] || '').toLowerCase()
  const enable = command === 'on'

  if (!['antilink', 'welcome', 'antiarabe', 'modoadmin', 'alerts'].includes(type)) {
    return conn.sendMessage(m.chat, { 
      text: `⚙️ *CONFIGURACIÓN DEL GRUPO*\n\n` +
            `📌 Activa o desactiva funciones importantes con:\n\n` +
            `✅ *.on antilink* — Bloquea enlaces\n` +
            `✅ *.on welcome* — Mensajes de bienvenida\n` +
            `✅ *.on antiarabe* — Expulsa números árabes\n` +
            `✅ *.on modoadmin* — Solo admins escriben\n` +
            `✅ *.on alerts* — Alertas de cambios en el grupo\n\n` +
            `📌 Usa *.off* para desactivar.\n\n` +
            `🛡️ Solo administradores pueden usar estos comandos.`,
      ...global.rcanal 
    }, { quoted: m })
  }

  if (!isAdmin) return conn.sendMessage(m.chat, { 
    text: '❌ *Acceso denegado*\n\nSolo los *administradores* del grupo pueden activar o desactivar funciones.', 
    ...global.rcanal 
  }, { quoted: m })

  if (type === 'modoadmin' && isBotAdmin) {
    await conn.groupSettingUpdate(m.chat, enable ? 'announcement' : 'not_announcement')
  }

  chat[type] = enable

  if (type === 'antilink' && !enable) chat.antilinkWarns = {}
  if (type === 'antilink' && enable && !chat.antilinkWarns) chat.antilinkWarns = {}

  const statusText = enable ? '🟢 *Activado*' : '🔴 *Desactivado*'
  const emojis = {
    antilink: '🔗',
    welcome: '👋',
    antiarabe: '🚫',
    modoadmin: '🛡️',
    alerts: '📢'
  }

  return conn.sendMessage(m.chat, { 
    text: `✅ *${emojis[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}* ${statusText}\n\n` +
          `> El sistema ha sido actualizado correctamente.\n` +
          `> Estado: *${m.pushName || 'Admin'}*`,
    ...global.rcanal 
  }, { quoted: m })
}

handler.command = ['on', 'off']
handler.group = true
handler.admin = true
handler.tags = ['group']
handler.help = [
  'on antilink', 'off antilink',
  'on welcome', 'off welcome',
  'on antiarabe', 'off antiarabe',
  'on modoadmin', 'off modoadmin',
  'on alerts', 'off alerts'
]

handler.before = async (m, { conn }) => {
  if (!m.isGroup) return false
  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
  const chat = global.db.data.chats[m.chat]

  const groupMetadata = await conn.groupMetadata(m.chat)
  const senderId = m.sender
  const isBot = m.key.fromMe
  const isUserAdmin = groupMetadata.participants.find(p => p.id === senderId)?.admin || false
  const isBotAdmin = groupMetadata.participants.find(p => p.id === conn.user.jid)?.admin || false

  if (chat.modoadmin && !isUserAdmin && !isBot && m.message) {
    await conn.sendMessage(m.chat, { delete: m.key })
    return true
  }

  if (chat.antiarabe && m.messageStubType === 27) {
    const newJid = m.messageStubParameters?.[0]
    if (!newJid) return false
    const number = newJid.split('@')[0].replace(/\D/g, '')
    const arabicPrefixes = ['212','20','971','965','966','974','973','962']
    if (arabicPrefixes.some(p => number.startsWith(p))) {
      await conn.sendMessage(m.chat, { 
        text: `🚷 *Usuario bloqueado por Anti-Árabe*\n\n` +
              `• Usuario: @${newJid.split('@')[0]}\n` +
              `• Acción: *Expulsado automáticamente*\n` +
              `• Motivo: Número con prefijo árabe detectado.`,
        mentions: [newJid],
        ...global.rcanal 
      }, { quoted: fkontak })
      await conn.groupParticipantsUpdate(m.chat, [newJid], 'remove')
      return true
    }
  }

  if (chat.antilink && m.messageStubType !== 27 && !isUserAdmin && m.text) {
    const text = m.text
    const allowedLink = 'https://whatsapp.com/channel/0029VbArz9fAO7RGy2915k3O'
    if (!text.includes(allowedLink) && (linkRegex.test(text) || linkRegex1.test(text))) {
      if (!chat.antilinkWarns) chat.antilinkWarns = {}
      if (!chat.antilinkWarns[senderId]) chat.antilinkWarns[senderId] = 0
      chat.antilinkWarns[senderId]++

      const userTag = `@${senderId.split('@')[0]}`
      const msgID = m.key.id
      const participant = m.key.participant

      if (chat.antilinkWarns[senderId] < 3) {
        await conn.sendMessage(m.chat, { 
          text: `⚠️ *Advertencia de Enlace* ⚠️\n\n` +
                `• Usuario: ${userTag}\n` +
                `• Motivo: Envío de enlace no permitido\n` +
                `• Advertencias: ${chat.antilinkWarns[senderId]}/3`,
          mentions: [senderId],
          ...global.rcanal 
        }, { quoted: m })
        await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: msgID, participant } })
      } else {
        await conn.sendMessage(m.chat, { 
          text: `🚨 *Límite de advertencias alcanzado*\n\n` +
                `• Usuario: ${userTag}\n` +
                `• Acción: *Expulsado del grupo*\n` +
                `• Motivo: 3 advertencias por enlaces.`,
          mentions: [senderId],
          ...global.rcanal 
        }, { quoted: m })
        await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: msgID, participant } })
        await conn.groupParticipantsUpdate(m.chat, [senderId], 'remove')
        chat.antilinkWarns[senderId] = 0
      }
      return true
    }
  }

  if (chat.welcome && [27, 28, 32].includes(m.messageStubType)) {
    const userId = m.messageStubParameters?.[0] || senderId
    const userMention = `@${userId.split('@')[0]}`
    const profilePic = await getGroupPic(conn, userId)
    const groupSize = groupMetadata.participants.length
    const isLeaving = [28, 32].includes(m.messageStubType)

    const externalAdReply = {
      forwardingScore: 999,
      isForwarded: true,
      title: isLeaving ? '❌ Adiós' : '✅ Bienvenido',
      body: `👥 Miembros: ${groupSize}`,
      mediaType: 1,
      renderLargerThumbnail: true,
      thumbnailUrl: profilePic,
      sourceUrl: `https://wa.me/${userId.split('@')[0]}`
    }

    const mensaje = isLeaving
      ? `👋 *${userMention}* ha salido del grupo.\n📉 Quedamos *${groupSize}* miembros.`
      : `🌟 ¡Bienvenido/a, *${userMention}*!\n🎊 Disfruta del grupo *${groupMetadata.subject}*.\n👥 Ahora somos *${groupSize}* miembros.`

    await conn.sendMessage(m.chat, { 
      text: mensaje, 
      contextInfo: { mentionedJid: [userId], externalAdReply } 
    })
    return true
  }

  if (chat.alerts && m.messageStubType) {
    const usuario = `@${senderId.split('@')[0]}`
    const pp = await getGroupPic(conn, m.chat)

    let text = ''
    let mentions = [senderId]
    let image = null

    switch (m.messageStubType) {
      case 21:
        text = `📌 *${usuario}* ha cambiado el nombre del grupo.\n\n> ✅ Nuevo nombre:\n> *${m.messageStubParameters[0]}*`
        break

      case 22:
        text = `📝 *${usuario}* ha actualizado la descripción del grupo.\n\n> ✅ Nueva descripción:\n> ${m.messageStubParameters[0]}`
        break

      case 25:
        text = `🖼️ *${usuario}* ha cambiado la foto del grupo.`
        image = { url: pp }
        break

      case 29:
        const promotedUser = m.messageStubParameters?.[0]
        if (promotedUser) {
          mentions.push(promotedUser)
          text = `👑 *@${promotedUser.split('@')[0]}* ahora es *admin* del grupo.\n\n> ✅ Acción realizada por: *${usuario}*`
        }
        break

      case 30:
        const demotedUser = m.messageStubParameters?.[0]
        if (demotedUser) {
          mentions.push(demotedUser)
          text = `🛡️ *@${demotedUser.split('@')[0]}* ya no es *admin* del grupo.\n\n> ✅ Acción realizada por: *${usuario}*`
        }
        break

      default:
        return false
    }

    if (text) {
      await conn.sendMessage(m.chat, {
        text: text,
        mentions: mentions,
        ...(image ? { image: image } : {})
      }, { quoted: fkontak })
    }
    return true
  }

  return false
}

export default handler
