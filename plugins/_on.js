import fetch from 'node-fetch'

let linkRegex = /chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i
let linkRegex1 = /whatsapp\.com\/channel\/[0-9A-Za-z]{20,24}/i
const defaultImage = 'https://files.catbox.moe/ubftco.jpg'

async function isAdminOrOwner(m, conn) {
  try {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const participant = groupMetadata.participants.find(p => p.id === m.sender)
    return participant?.admin || m.fromMe
  } catch {
    return false
  }
}

const handler = async (m, { conn, command, args, isAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '🔒 Este comando solo funciona en grupos.', ...global.rcanal }, { quoted: m })

  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
  const chat = global.db.data.chats[m.chat]
  const type = (args[0] || '').toLowerCase()
  const enable = command === 'on'

  if (!['antilink', 'welcome', 'antiarabe', 'modoadmin'].includes(type)) {
    return conn.sendMessage(m.chat, { text: `✳️ Opciones válidas:\n\n🌾 •⟩ *.on antilink* / *.off antilink*\n🌾 •⟩ *.on welcome* / *.off welcome*\n🌾 •⟩ *.on antiarabe* / *.off antiarabe*\n🌾 •⟩ *.on modoadmin* / *.off modoadmin*`, ...global.rcanal }, { quoted: m })
  }

  if (!isAdmin) return conn.sendMessage(m.chat, { text: '❌ Solo *admins* pueden activar o desactivar funciones.', ...global.rcanal }, { quoted: m })

  if (type === 'antilink') {
    chat.antilink = enable
    if(!chat.antilinkWarns) chat.antilinkWarns = {}
    if(!enable) chat.antilinkWarns = {}
    return conn.sendMessage(m.chat, { text: `✅ *Antilink* ${enable ? '🟢 activado' : '🔴 desactivado'}.`, ...global.rcanal }, { quoted: m })
  }

  if (type === 'welcome') {
    chat.welcome = enable
    return conn.sendMessage(m.chat, { text: `✅ *Welcome* ${enable ? '🟢 activado' : '🔴 desactivado'}.`, ...global.rcanal }, { quoted: m })
  }

  if (type === 'antiarabe') {
    chat.antiarabe = enable
    return conn.sendMessage(m.chat, { text: `✅ *Anti-árabe* ${enable ? '🟢 activado' : '🔴 desactivado'}.`, ...global.rcanal }, { quoted: m })
  }

  if (type === 'modoadmin') {
    chat.modoadmin = enable
    return conn.sendMessage(m.chat, { text: `✅ *Modo Admin* ${enable ? '🟢 activado' : '🔴 desactivado'}.`, ...global.rcanal }, { quoted: m })
  }
}

handler.command = ['on', 'off']
handler.group = true
handler.register = false
handler.tags = ['group']
handler.help = ['on welcome', 'off welcome', 'on antilink', 'off antilink', 'on modoadmin', 'off modoadmin']

handler.before = async (m, { conn }) => {
  if (!m.isGroup) return
  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
  const chat = global.db.data.chats[m.chat]

  // Modo Admin
  if (chat.modoadmin) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const isUserAdmin = groupMetadata.participants.find(p => p.id === m.sender)?.admin
    if (!isUserAdmin && !m.fromMe) return
  }

  // Anti árabe
  if (chat.antiarabe && m.messageStubType === 27) {
    const newJid = m.messageStubParameters?.[0]
    if (!newJid) return

    const number = newJid.split('@')[0].replace(/\D/g, '')
    const arabicPrefixes = ['212', '20', '971', '965', '966', '974', '973', '962']
    const isArab = arabicPrefixes.some(prefix => number.startsWith(prefix))

    if (isArab) {
      await conn.sendMessage(m.chat, { text: `🚷 El usuario *${newJid}* fue detectado con prefijo árabe.\n\n> [ Anti-árabe 🟢 Activado ]`, ...global.rcanal }, { quoted: m })
      await conn.groupParticipantsUpdate(m.chat, [newJid], 'remove')
      return true
    }
  }

  // Anti link
  if (chat.antilink) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const isUserAdmin = groupMetadata.participants.find(p => p.id === m.sender)?.admin
    const text = m?.text || ''
    const allowedLink = 'https://whatsapp.com/channel/0029VbArz9fAO7RGy2915k3O'

    if (isUserAdmin || text.includes(allowedLink)) return

    if (linkRegex.test(text) || linkRegex1.test(text)) {
      const userTag = `@${m.sender.split('@')[0]}`
      const delet = m.key.participant
      const msgID = m.key.id

      try {
        const ownGroupLink = `https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}`
        if (text.includes(ownGroupLink)) return
      } catch { }

      if (!chat.antilinkWarns) chat.antilinkWarns = {}
      if (!chat.antilinkWarns[m.sender]) chat.antilinkWarns[m.sender] = 0

      chat.antilinkWarns[m.sender]++

      if (chat.antilinkWarns[m.sender] < 3) {
        try {
          await conn.sendMessage(m.chat, { 
            text: `⚠️ Hey ${userTag}, los *links* no están permitidos.\n\n> Advertencia ${chat.antilinkWarns[m.sender]}/3`, 
            mentions: [m.sender], 
            ...global.rcanal 
          }, { quoted: m })

          await conn.sendMessage(m.chat, {
            delete: { remoteJid: m.chat, fromMe: false, id: msgID, participant: delet }
          })
        } catch {
          await conn.sendMessage(m.chat, { text: `⚠️ No pude eliminar el mensaje de ${userTag}.`, mentions: [m.sender], ...global.rcanal }, { quoted: m })
        }
      } else {
        try {
          await conn.sendMessage(m.chat, { 
            text: `🚫 ${userTag} llegó al límite de 3 advertencias por links.\n> Será *expulsado* del grupo.`, 
            mentions: [m.sender], 
            ...global.rcanal 
          }, { quoted: m })

          await conn.sendMessage(m.chat, { 
            delete: { remoteJid: m.chat, fromMe: false, id: msgID, participant: delet } 
          })

          await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
          chat.antilinkWarns[m.sender] = 0
        } catch {
          await conn.sendMessage(m.chat, { text: `⚠️ No pude expulsar a ${userTag}. Puede que no tenga permisos.`, mentions: [m.sender], ...global.rcanal }, { quoted: m })
        }
      }

      return true
    }
  }

  // Bienvenida y despedida
  if (chat.welcome && [27, 28, 32].includes(m.messageStubType)) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const groupSize = groupMetadata.participants.length
    const userId = m.messageStubParameters?.[0] || m.sender
    const userMention = `@${userId.split('@')[0]}`
    let profilePic

    try {
      profilePic = await conn.profilePictureUrl(userId, 'image')
    } catch {
      profilePic = defaultImage
    }

    const isLeaving = [28, 32].includes(m.messageStubType)
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

    if (!isLeaving) {
      const bienvenida = `
🧃ㅤHola ${userMention}  

🌿 Bienvenid@ a *${groupMetadata.subject}*  
👥 Ahora somos *${groupSize}* personas en el grupo.  
📌 Respeta las reglas para que la pasemos chido ✨  
`.trim()

      await conn.sendMessage(m.chat, { text: bienvenida, contextInfo: { mentionedJid: [userId], externalAdReply } })
    } else {
      const despedida = `
🥀ㅤ${userMention} salió de *${groupMetadata.subject}*  

👥 Quedamos *${groupSize}* miembros.  
🙏 Gracias por estar aquí, vuelve cuando quieras 🌸  
`.trim()

      await conn.sendMessage(m.chat, { text: despedida, contextInfo: { mentionedJid: [userId], externalAdReply } })
    }

    return true 
  }

  return false
}

export default handler
