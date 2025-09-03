//[##] Creado por GianPoolS (github.con/GianPoolS)
//[##] No quites los créditos

import fetch from 'node-fetch'
import fs from 'fs'
import pkg from '@whiskeysockets/baileys'
const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = pkg

let handler = async (m, { conn }) => {
  // Escribe el numero antes del @
  const destinatario = '50@s.whatsapp.net'
  try {

    // === USAR LINK ===
    //const res = await fetch('https://ejemplo.com/imagen.jpg')
    //const imagenBuffer = await res.buffer()

    // === USAR LOCAL ===
    const imagenBuffer = fs.readFileSync('./storage/img/menu.jpg')

    // Prepara el media (imagen)
    const media = await prepareWAMessageMedia(
      { image: imagenBuffer },
      { upload: conn.waUploadToServer }
    )

    // Crea el mensaje con botones
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.create({
        text: 'hola'
      }),
      footer: proto.Message.InteractiveMessage.Footer.create({
        text: 'by GP'
      }),
      header: proto.Message.InteractiveMessage.Header.create({
        hasMediaAttachment: true,
        imageMessage: media.imageMessage
      }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: 'Si',
              id: 'tes5_si'
            })
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: 'No',
              id: 'tes5_no'
            })
          }
        ]
      })
    })

    // Genera el mensaje final
    const msg = generateWAMessageFromContent(destinatario, {
      viewOnceMessage: {
        message: { interactiveMessage }
      }
    }, {})

    // Envia al destinatario
    await conn.relayMessage(destinatario, msg.message, { messageId: msg.key.id })

    await m.reply('mensaje enviado ✅ con botones')
  } catch (e) {
    await m.reply(`❌ error: ${e?.message || e}`)
  }
}

handler.command = ['tes5','msg']
//handler.owner = true

export default handler
