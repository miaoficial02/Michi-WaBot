import fetch from "node-fetch"
import yts from 'yt-search'

const youtubeRegexID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/

const handler = async (m, { conn, text, command }) => {
  try {
    if (!text.trim()) return conn.reply(m.chat, `✐ Escribe el nombre o link del video para descargarlo.`, m)

    let videoIdToFind = text.match(youtubeRegexID) || null
    let ytplay2 = await yts(videoIdToFind === null ? text : 'https://youtu.be/' + videoIdToFind[1])

    if (videoIdToFind) {
      const videoId = videoIdToFind[1]  
      ytplay2 = ytplay2.all.find(item => item.videoId === videoId) || ytplay2.videos.find(item => item.videoId === videoId)
    } 
    ytplay2 = ytplay2.all?.[0] || ytplay2.videos?.[0] || ytplay2  
    if (!ytplay2 || ytplay2.length == 0) return m.reply('✧ No se encontraron resultados para tu búsqueda.')

    let { title, thumbnail, timestamp, views, ago, url, author } = ytplay2
    title = title || 'No encontrado'
    thumbnail = thumbnail || ''
    timestamp = timestamp || 'Desconocido'
    views = views || 'Desconocido'
    ago = ago || 'Desconocido'
    url = url || 'No encontrado'
    author = author || { name: 'Desconocido' }

    const vistas = formatViews(views)
    const canal = author.name || 'Desconocido'

    const infoMessage = 
`🌱 *Detalles del video* 
────────────────────
🌿 *Título:* ${title}
🌳 *Canal:* ${canal}
🍂 *Duración:* ${timestamp}
🌞 *Vistas:* ${vistas}
🌲 *Publicado:* ${ago}
🐢 *Link:* ${url}
────────────────────
`

    await conn.reply(m.chat, infoMessage, m)

    if (['play','yta','ytmp3','playaudio'].includes(command)) {
      try {
        const api = await (await fetch(`https://myapiadonix.vercel.app/download/yt?url=${encodeURIComponent(url)}&format=audio`)).json()
        const result = api.result.download
        if (!result) throw new Error('⚠ El enlace de audio no se generó correctamente.')
        await conn.sendMessage(m.chat, { audio: { url: result }, fileName: `${title}.mp3`, mimetype: 'audio/mpeg', ptt: true }, { quoted: m })
      } catch (e) {
        return conn.reply(m.chat, '⚠︎ No se pudo enviar el audio. Archivo pesado o error en la URL.', m)
      }
    } else if (['play2','ytv','ytmp4','mp4'].includes(command)) {
      try {
        const api = await (await fetch(`https://myapiadonix.vercel.app/download/yt?url=${encodeURIComponent(url)}&format=video`)).json()
        const result = api.result.download
        if (!result) throw new Error('⚠ El enlace de video no se generó correctamente.')
        await conn.sendMessage(m.chat, { video: { url: result }, fileName: `${title}.mp4`, mimetype: 'video/mp4', caption: infoMessage }, { quoted: m })
      } catch (e) {
        return conn.reply(m.chat, '⚠︎ No se pudo enviar el video. Archivo pesado o error en la URL.', m)
      }
    } else {
      return conn.reply(m.chat, '✧︎ Comando no reconocido.', m)
    }

  } catch (error) {
    return m.reply(`⚠︎ Ocurrió un error: ${error}`)
  }
}

handler.command = handler.help = ['play','yta','ytmp3','play2','ytv','ytmp4','playaudio','mp4']
handler.tags = ['downloader']


export default handler

function formatViews(views) {
  if (views === undefined) return "No disponible"
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B (${views.toLocaleString()})`
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M (${views.toLocaleString()})`
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k (${views.toLocaleString()})`
  return views.toString()
}
