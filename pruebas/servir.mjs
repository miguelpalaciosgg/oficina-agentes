// servir.mjs — Servidor estático mínimo para ver el simulador en local (los módulos ES no cargan
// desde file://). Sin dependencias. Solo escucha en 127.0.0.1.
//   node pruebas/servir.mjs [puerto]     (por defecto 8090)
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, normalize, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs')
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' }
const puerto = Number(process.argv[2]) || 8090

createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const archivo = normalize(join(RAIZ, ruta.endsWith('/') ? ruta + 'index.html' : ruta))
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end(); return }
  try {
    const datos = await readFile(archivo)
    res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(datos)
  } catch { res.writeHead(404).end('No encontrado') }
}).listen(puerto, '127.0.0.1', () => console.log(`Simulador en http://127.0.0.1:${puerto}/`))
