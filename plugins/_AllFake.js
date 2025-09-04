import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

export async function before(m, { conn }) {
  try {

    let nombreBot = global.namebot || 'Bot'
    let bannerFinal = 'https://files.catbox.moe/wp5z1y.jpg'

    const botActual = conn.user?.jid?.split('@')[0].replace(/\D/g, '')
    const configPath = path.join('./JadiBots', botActual, 'config.json')

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath))
        if (config.name) nombreBot = config.name
        if (config.banner) bannerFinal = config.banner
      } catch (err) {
        console.log('⚠️ No se pudo leer config del subbot en rcanal:', err)
      }
    }

    // Archivos falsos random
    const docTypes = [
      'pdf',
      'zip',
      'vnd.openxmlformats-officedocument.presentationml.presentation',
      'vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    const document = docTypes[Math.floor(Math.random() * docTypes.length)]

    const buffer = Buffer.from(`Archivo falso de ${document} generado por ${nombreBot}`)

    const canales = [global.idcanal, global.idcanal2]
    const newsletterJidRandom = canales[Math.floor(Math.random() * canales.length)]

    global.rcanal = {
      document: buffer,
      mimetype: `application/${document}`,
      fileName: `🌾 𝖬𝗂𝖼𝗁𝗂 𝗦𝘂𝗯𝗕𝗼𝘁`,
      fileLength: buffer.length,
      contextInfo: {
        isForwarded: true,
        forwardingScore: 1,
        forwardedNewsletterMessageInfo: {
          newsletterJid: newsletterJidRandom,
          serverMessageId: 100,
          newsletterName: nombreBot,
        },
        externalAdReply: {
          title: nombreBot,
          body: global.author,
          thumbnailUrl: bannerFinal,
          sourceUrl: null,
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }

  } catch (e) {
    console.log('Error al generar rcanal:', e)
  }
}
