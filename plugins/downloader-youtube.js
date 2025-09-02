import fetch from 'node-fetch'
import yts from 'yt-search'

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply('✐ Pon un nombre de canción o enlace de YouTube wey')

    let query = args.join(' ')
    let url

    if (query.startsWith('http')) {
        url = query
    } else {
        let search = await yts(query)
        if (!search || !search.videos || !search.videos.length) return m.reply('✐ No encontré la canción wey')
        url = search.videos[0].url
    }

    try {
        await conn.sendMessage(m.chat, { react: { text: '🕓', key: m.key } })

        let apiUrl = `https://myapiadonix.vercel.app/download/yt?url=${encodeURIComponent(url)}&format=mp3`
        let res = await fetch(apiUrl)
        let json = await res.json()

        if (!json.status) return m.reply('✐ No se pudo descargar el audio wey')

        let { title, download } = json.result

       
        conn.sendMessage(m.chat, {
            audio: { url: download },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`
        }, { quoted: m })

        conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

    } catch (e) {
        console.log(e)
        m.reply('✐ Ocurrió un error wey, intenta otra vez')
    }
}

handler.command = ['play', 'ytmp3'] 
export default handler