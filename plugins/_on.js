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

const handler = async (m, { conn, command, args, isAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '🔒 Este comando solo funciona en grupos.', ...global.rcanal }, { quoted: m })

  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
  const chat = global.db.data.chats[m.chat]
  const type = (args[0] || '').toLowerCase()
  const enable = command === 'on'

  if (!['antilink', 'welcome', 'antiarabe', 'modoadmin', 'alerts'].includes(type)) {
    return conn.sendMessage(m.chat, { text: `✳️ Opciones válidas:\n» *.on antilink* / *.off antilink*\n» *.on welcome* / *.off welcome*\n» *.on antiarabe* / *.off antiarabe*\n» *.on modoadmin* / *.off modoadmin*\n» *.on alerts* / *.off alerts*`, ...global.rcanal }, { quoted: m })
  }

  if (!isAdmin) return conn.sendMessage(m.chat, { text: '❌ Solo *admins* pueden activar o desactivar funciones.', ...global.rcanal }, { quoted: m })

  chat[type] = enable

  if (type === 'antilink' && !enable) chat.antilinkWarns = {}
  if (type === 'antilink' && enable && !chat.antilinkWarns) chat.antilinkWarns = {}

  return conn.sendMessage(m.chat, { text: `✅ *${type.charAt(0).toUpperCase() + type.slice(1)}* ${enable ? '🟢 activado' : '🔴 desactivado'}.`, ...global.rcanal }, { quoted: m })
}

handler.command = ['on', 'off']
handler.group = true
handler.register = false
handler.tags = ['group']
handler.help = ['on welcome', 'off welcome','on antilink', 'off antilink','on modoadmin', 'off modoadmin','on antiarabe', 'off antiarabe','on alerts', 'off alerts']

handler.before = async (m, { conn }) => {
  if (!m.isGroup) return false
  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
  const chat = global.db.data.chats[m.chat]

  const groupMetadata = await conn.groupMetadata(m.chat)
  const senderId = m.sender
  const participant = groupMetadata.participants.find(p => p.id === senderId)
  const isUserAdmin = participant?.admin || false

  if (chat.modoadmin && !isUserAdmin && !m.fromMe) return true

  if (chat.antiarabe && m.messageStubType === 27) {
    const newJid = m.messageStubParameters?.[0]
    if (!newJid) return false
    const number = newJid.split('@')[0].replace(/\D/g, '')
    const arabicPrefixes = ['212','20','971','965','966','974','973','962']
    if (arabicPrefixes.some(p => number.startsWith(p))) {
      await conn.sendMessage(m.chat, { text: `🚷 El usuario *${newJid}* fue detectado con prefijo árabe.\n[Anti-árabe 🟢 Activado]`, ...global.rcanal }, { quoted: m })
      await conn.groupParticipantsUpdate(m.chat, [newJid], 'remove')
      return true
    }
  }

  if (chat.antilink) {
    const text = m?.text || ''
    const allowedLink = 'https://whatsapp.com/channel/0029VbArz9fAO7RGy2915k3O'
    if (!isUserAdmin && !text.includes(allowedLink) && (linkRegex.test(text) || linkRegex1.test(text))) {
      if (!chat.antilinkWarns) chat.antilinkWarns = {}
      if (!chat.antilinkWarns[senderId]) chat.antilinkWarns[senderId] = 0
      chat.antilinkWarns[senderId]++

      const userTag = `@${senderId.split('@')[0]}`
      const msgID = m.key.id
      const delet = m.key.participant

      if (chat.antilinkWarns[senderId] < 3) {
        await conn.sendMessage(m.chat, { text: `⚠️ ${userTag}, los links no están permitidos.\nAdvertencia ${chat.antilinkWarns[senderId]}/3`, mentions: [senderId], ...global.rcanal }, { quoted: m })
        await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: msgID, participant: delet } })
      } else {
        await conn.sendMessage(m.chat, { text: `🚫 ${userTag} llegó al límite de 3 advertencias.\nSerá expulsado.`, mentions: [senderId], ...global.rcanal }, { quoted: m })
        await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: msgID, participant: delet } })
        await conn.groupParticipantsUpdate(m.chat, [senderId], 'remove')
        chat.antilinkWarns[senderId] = 0
      }
      return true
    }
  }

  if (chat.welcome && [27,28,32].includes(m.messageStubType)) {
    const userId = m.messageStubParameters?.[0] || senderId
    const userMention = `@${userId.split('@')[0]}`
    let profilePic = await getGroupPic(conn, userId)
    const groupSize = groupMetadata.participants.length
    const isLeaving = [28,32].includes(m.messageStubType)

    const externalAdReply = {
      forwardingScore: 999,
      isForwarded: true,
      title: `${isLeaving ? '🍿 Adiós' : '🌟 Bienvenido'}`,
      body: `👥 Miembros actuales: ${groupSize}`,
      mediaType: 1,
      renderLargerThumbnail: true,
      thumbnailUrl: profilePic,
      sourceUrl: `https://wa.me/${userId.split('@')[0]}`
    }

    const mensaje = isLeaving
      ? `🥀 » ⟩ ${userMention} salió de *${groupMetadata.subject}*\n👥 » ⟩ Quedamos *${groupSize}* miembros.`
      : `🧃 » ⟩ Hola ${userMention}\n🌿 » ⟩ Bienvenid@ a *${groupMetadata.subject}*\n👥 » ⟩ Ahora somos *${groupSize}* personas.`

    await conn.sendMessage(m.chat, { text: mensaje, contextInfo: { mentionedJid: [userId], externalAdReply } })
    return true
  }

  if (chat.alerts) {
    let updated = false

    if (m.messageStubType === 29) {
      const userId = m.messageStubParameters?.[0]
      let profilePic = await getGroupPic(conn, userId)
      const externalAdReply = { forwardingScore: 999, isForwarded: true, title: '👑 Promoción a Admin', body: `Grupo: ${groupMetadata.subject}`, mediaType:1, renderLargerThumbnail:true, thumbnailUrl: profilePic, sourceUrl:`https://wa.me/${userId.split('@')[0]}` }
      await conn.sendMessage(m.chat, { text: `👑 ${userId} ahora es admin`, contextInfo: { mentionedJid: [userId], externalAdReply } })
      updated = true
    }

    if (m.messageStubType === 30) {
      const userId = m.messageStubParameters?.[0]
      let profilePic = await getGroupPic(conn, userId)
      const externalAdReply = { forwardingScore: 999, isForwarded: true, title: '🔻 Remoción de Admin', body: `Grupo: ${groupMetadata.subject}`, mediaType:1, renderLargerThumbnail:true, thumbnailUrl: profilePic, sourceUrl:`https://wa.me/${userId.split('@')[0]}` }
      await conn.sendMessage(m.chat, { text: `🔻 ${userId} ya no es admin`, contextInfo: { mentionedJid: [userId], externalAdReply } })
      updated = true
    }

    if (m.messageStubType === 21 && chat.lastGroupDesc !== groupMetadata.desc) {
      chat.lastGroupDesc = groupMetadata.desc || ''
      let profilePic = await getGroupPic(conn, m.chat)
      const externalAdReply = { forwardingScore: 999, isForwarded: true, title: '📝 Descripción Actualizada', body:`Grupo: ${groupMetadata.subject}`, mediaType:1, renderLargerThumbnail:true, thumbnailUrl: profilePic, sourceUrl:`https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}` }
      await conn.sendMessage(m.chat, { text: `📝 Nueva descripción:\n${chat.lastGroupDesc}`, contextInfo: { externalAdReply } })
      updated = true
    }

    if (m.messageStubType === 22 && chat.lastGroupName !== groupMetadata.subject) {
      chat.lastGroupName = groupMetadata.subject
      let profilePic = await getGroupPic(conn, m.chat)
      const externalAdReply = { forwardingScore: 999, isForwarded: true, title: '🏷️ Nombre cambiado', body:`Nuevo nombre: ${chat.lastGroupName}`, mediaType:1, renderLargerThumbnail:true, thumbnailUrl: profilePic, sourceUrl:`https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}` }
      await conn.sendMessage(m.chat, { text: `🏷️ Nombre actualizado a *${chat.lastGroupName}*`, contextInfo: { externalAdReply } })
      updated = true
    }

    if (m.messageStubType === 25) {
      let profilePic = await getGroupPic(conn, m.chat)
      if (chat.lastGroupPic !== profilePic) {
        chat.lastGroupPic = profilePic
        const externalAdReply = { forwardingScore: 999, isForwarded: true, title: '🖼️ Foto actualizada', body:`Grupo: ${groupMetadata.subject}`, mediaType:1, renderLargerThumbnail:true, thumbnailUrl: profilePic, sourceUrl:`https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}` }
        await conn.sendMessage(m.chat, { text: `🖼️ La foto del grupo ha cambiado`, contextInfo: { externalAdReply } })
        updated = true
      }
    }

    if (updated) return true
  }

  return false
}

export default handler
