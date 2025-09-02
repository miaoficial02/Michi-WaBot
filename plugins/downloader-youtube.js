import fetch from 'node-fetch'
import yts from 'yt-search'

let handler = async (m, { conn, args, command }) => {
    if (!args[0]) return m.reply('✐ Escribe el nombre de la canción o el enlace de YouTube.')

    let query = args.join(' ')
    let url

    if (query.startsWith('http')) {
        url = query
    } else {
        let search = await yts(query)
        if (!search || !search.videos || !search.videos.length) return m.reply('✐ No encontré la canción.')
        url = search.videos[0].url
    }

    try {
        await conn.sendMessage(m.chat, { react: { text: '🕓', key: m.key } })

        let format = (command === 'play2') ? 'mp4' : 'audio'
        let apiUrl = `https://myapiadonix.vercel.app/download/yt?url=${encodeURIComponent(url)}&format=${format}`
        let res = await fetch(apiUrl)
        let json = await res.json()
        if (!json.status || !json.result) return m.reply('✐ No se pudo descargar el recurso.')

        let {
            title,
            download,
            thumbnail,
            duration,
            channel,
            views,
            published
        } = json.result

        
        if (!title || !thumbnail || !duration || !channel || !views || !published) {
            let info = await yts({ videoId: url.split('v=')[1] || url.split('/').pop() })
            let video = info.videos && info.videos.length ? info.videos[0] : null
            title     = title     || (video && video.title)     || "Sin título"
            thumbnail = thumbnail || (video && video.thumbnail) || ""
            duration  = duration  || (video && video.timestamp) || "Desconocido"
            channel   = channel   || (video && video.author.name) || "Desconocido"
            views     = views     || (video && video.views)     || "Desconocido"
            published = published || (video && video.ago)       || "Desconocido"
        }

        let details = 
`*🌱 Detalles del video:*
> *────────────────*
*🌿 Título:* ${title}
*🌳 Canal:* ${channel}
*🍂 Duración:* ${duration}
*🌞 Vistas:* ${views}
*🌲 Publicado:* ${published}
> *────────────────*
`

        await conn.sendMessage(m.chat, {
            image: { url: thumbnail },
            caption: details,
        }, { quoted: m })

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

        let fkontak = {
            key: { fromMe: false, participant: "0@s.whatsapp.net" },
            message: {
                contactMessage: { displayName: (format === 'audio' ? "YOUTUBE AUDIO" : "YOUTUBE VIDEO") }
            }
        }

        if (format === 'audio') {
            await conn.sendMessage(m.chat, {
                audio: { url: download },
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
                ptt: true
            }, { quoted: fkontak })
        } else {
            await conn.sendMessage(m.chat, {
                video: { url: download },
                mimetype: 'video/mp4',
                fileName: `${title}.mp4`
            }, { quoted: fkontak })
        }

    } catch (e) {
        console.error(e)
        m.reply('✐ Ocurrió un error, intenta otra vez.')
    }
}

handler.command = ['play', 'ytmp3', 'play2']
handler.help = ['play', 'ytmp3', 'play2']
handler.tags = ['downloader']
export default handler
