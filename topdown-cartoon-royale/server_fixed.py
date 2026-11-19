from aiohttp import web
import asyncio, socketio, socket, random, math, time

sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='aiohttp')
app = web.Application()
sio.attach(app)

rooms = {}

def create_room_code():
    chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        c=''.join(random.choices(chars,k=6))
        if c not in rooms: return c

def get_local_ip():
    try:
        s=socket.socket(socket.AF_INET,socket.SOCK_DUDP); s.connect(('8.8.8.8',80)); ip=s.getsockname()[0]; s.close(); return ip
    except: return 'localhost'

async def api_ip(r): return web.json_response({'ip':get_local_ip()})
async def index(r): return web.FileResponse('public/index.html')
async def serve_static(r):
    p=r.match_info.get('tail','')
    if not p or p.endswith('/'): p='index.html'
    return web.FileResponse(f'public/{p}')
app.router.add_get('/api/ip', api_ip); app.router.add_get('/', index); app.router.add_get('/{tail:.*}', serve_static)

async def emit_state(code):
    if code not in rooms: return
    r=rooms[code]
    await sio.emit('state:update', {'players':r['players'],'bots':r['bots'],'loots':r['loots'],'zone':r['zone'],'kills':r['kills'],'game_over':r['game_over']}, room=code)

@sio.event
async def connect(sid,env): pass
# ... keep short - but write full
