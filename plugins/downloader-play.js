import fetch from 'node-fetch'
import yts from 'yt-search'

let handler = async (m, { conn, args }) => {
    if (!args[0]) return m.reply('✐ Pon un nombre de video o enlace de YouTube wey')

    let query = args.join(' ')
    let url

    if (query.startsWith('http')) {
        url = query
    } else {
        let search = await yts(query)
        if (!search || !search.videos || !search.videos.length) return m.reply('✐ No encontré el video wey')
        url = search.videos[0].url
    }

    try {
        await conn.sendMessage(m.chat, { react: { text: '🕓', key: m.key } })

        let apiUrl = `https://myapiadonix.vercel.app/download/yt?url=${encodeURIComponent(url)}&format=video`
        let res = await fetch(apiUrl)
        let json = await res.json()

        if (!json.status) return m.reply('✐ No se pudo descargar el video wey')

        let { title, download } = json.result

        // bajamos el video como buffer
        let vidRes = await fetch(download)
        let buffer = await vidRes.buffer()

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

        await conn.sendMessage(m.chat, {
            video: buffer,
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`
        }, { quoted: m })

    } catch (e) {
        console.log(e)
        m.reply('✐ Ocurrió un error wey, intenta otra vez')
    }
}

handler.command = ['play2'] 
export default handler