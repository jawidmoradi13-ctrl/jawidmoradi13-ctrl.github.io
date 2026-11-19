import socketio
from aiohttp import web
import random
import math
import asyncio
import time
import socket

sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='aiohttp')
app = web.Application()
sio.attach(app)

rooms = {}

def create_room_code():
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        code = ''.join(random.choices(chars, k=6))
        if code not in rooms:
            return code

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return 'localhost'

async def api_ip(request):
    return web.json_response({'ip': get_local_ip()})

app.router.add_get('/api/ip', api_ip)
app.router.add_get('/', lambda req: web.FileResponse('public/index.html'))

async def serve_static(request):
    path = request.match_info.get('tail', '')
    if not path or path.endswith('/'): path = 'index.html'
    full = f'public/{path}'
    return web.FileResponse(full)

app.router.add_get('/{tail:.*}', serve_static)
