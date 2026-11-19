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

async def index(request):
    return web.FileResponse('public/index.html')

async def serve_static(request):
    path = request.match_info.get('tail', '')
    if not path or path.endswith('/'):
        path = 'index.html'
    return web.FileResponse(f'public/{path}')

app.router.add_get('/api/ip', api_ip)
app.router.add_get('/', index)
app.router.add_get('/{tail:.*}', serve_static)

async def emit_state(room_code):
    if room_code not in rooms: return
    r = rooms[room_code]
    await sio.emit('state:update', {
        'players': r['players'],
        'bots': r['bots'],
        'loots': r['loots'],
        'zone': r['zone'],
        'kills': r['kills'],
        'game_over': r['game_over']
    }, room=room_code)

@sio.event
async def connect(sid, environ):
    pass

@sio.event
async def create_room(sid, data):
    code = create_room_code()
    rooms[code] = {
        'players': {}, 'bots': [], 'kills': {}, 'loots': [],
        'zone': {'x':800,'y':500,'r':800,'active':False},
        'game_started': False, 'game_over': False
    }
    await sio.emit('room:created', {'code': code}, room=sid)

@sio.event
async def join_room(sid, data):
    code = (data.get('code','') or '').upper().strip()
    if code not in rooms:
        await sio.emit('error', {'msg':'Raum nicht gefunden'}, room=sid); return
    r = rooms[code]
    if r['game_started']:
        await sio.emit('error', {'msg':'Spiel läuft bereits'}, room=sid); return
    name = (data.get('name','Spieler') or 'Spieler')[:12]
    r['players'][sid] = {
        'id': sid, 'name': name,
        'x': random.randint(120,1480), 'y': random.randint(120,880),
        'angle': 0, 'hp': 100, 'maxHp': 100,
        'weapon': 'pistol', 'ammo': 12, 'maxAmmo': 12,
        'kills': 0, 'alive': True
    }
    await sio.enter_room(sid, code)
    await sio.emit('joined', {'code': code}, room=sid)
    await emit_state(code)

@sio.event
async def start_game(sid, data):
    code = data.get('code')
    if code not in rooms: return
    r = rooms[code]
    if r['game_started'] or len(r['players'])==0: return
    r['game_started'] = True
    for i in range(min(8, 12-len(r['players']))):
        r['bots'].append({
            'id': f'bot{i}', 'x': random.randint(150,1450), 'y': random.randint(150,850),
            'angle': 0, 'hp': 100, 'alive': True, 'weapon': 'smg', 'ammo': 30, 'kills': 0
        })
    for i in range(24):
        r['loots'].append({
            'id': f'l{i}', 'x': random.randint(100,1500), 'y': random.randint(100,900),
            'type': random.choice(['ammo','smg','rifle','ammo','smg'])
        })
    await sio.emit('game:started', {}, room=code)
    await emit_state(code)
    asyncio.create_task(game_loop(code))

@sio.event
async def input(sid, data):
    code = data.get('code')
    if code not in rooms: return
    r = rooms[code]
    if sid in r['players'] and r['players'][sid]['alive']:
        p = r['players'][sid]
        p['x'] = max(30,min(1570,data.get('x',p['x'])))
        p['y'] = max(30,min(970,data.get('y',p['y'])))
        p['angle'] = data.get('angle',p['angle'])

@sio.event
async def shoot(sid, data):
    code = data.get('code')
    if code not in rooms: return
    r = rooms[code]
    if sid not in r['players']: return
    s = r['players'][sid]
    if not s['alive'] or s['ammo'] <= 0: return
    s['ammo'] -= 1
    dmg = 18
    if s['weapon']=='smg': dmg=14
    if s['weapon']=='rifle': dmg=32
    for b in r['bots']:
        if not b['alive']: continue
        if math.hypot(b['x']-s['x'], b['y']-s['y']) < 280:
            b['hp'] -= dmg*0.8
            if b['hp'] <= 0:
                b['alive']=False; s['kills']+=1
    await emit_state(code)

@sio.event
async def pickup(sid, data):
    code = data.get('code')
    if code not in rooms: return
    r = rooms[code]
    if sid not in r['players']: return
    p = r['players'][sid]
    lid = data.get('lootId')
    for l in list(r['loots']):
        if l['id']==lid and math.hypot(l['x']-p['x'],l['y']-p['y']) < 48:
            if l['type']=='ammo': p['ammo'] = min(p['maxAmmo']+15, p['ammo']+20)
            if l['type']=='smg': p['weapon']='smg'; p['ammo']=30; p['maxAmmo']=30
            if l['type']=='rifle': p['weapon']='rifle'; p['ammo']=25; p['maxAmmo']=25
            r['loots'].remove(l); break
    await emit_state(code)

@sio.event
async def disconnect(sid):
    for code,r in rooms.items():
        if sid in r['players']: r['players'].pop(sid); break

async def game_loop(code):
    r = rooms.get(code)
    if not r: return
    t0 = time.time()
    while True:
        if time.time()-t0 > 95 and not r['zone']['active']:
            r['zone']['active'] = True
            asyncio.create_task(zone_loop(code))
        alive_players = [p for p in r['players'].values() if p['alive']]
        alive_bots = [b for b in r['bots'] if b['alive']]
        alive = alive_players + alive_bots
        if len(alive) <= 1:
            r['game_over'] = True
            await emit_state(code)
            await sio.emit('game:over', {'winner': alive[0]['id'] if alive else 'Niemand'}, room=code)
            break
        await asyncio.sleep(0.6)

async def zone_loop(code):
    r = rooms.get(code)
    if not r: return
    x=random.randint(300,1300); y=random.randint(250,750); rad=650
    for _ in range(36):
        rad = max(70, rad-15)
        r['zone'] = {'x':x,'y':y,'r':rad,'active':True}
        await emit_state(code)
        for p in r['players'].values():
            if p['alive']:
                dx=p['x']-x; dy=p['y']-y
                if dx*dx+dy*dy > rad*rad: p['hp']=max(0,p['hp']-3)
        for b in r['bots']:
            if b['alive']:
                dx=b['x']-x; dy=b['y']-y
                if dx*dx+dy*dy > rad*rad: b['hp']=max(0,b['hp']-3)
        await asyncio.sleep(1)

async def start_server():
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 2000)
    await site.start()
    print('Server läuft: http://localhost:3000 | http://' + get_local_ip() + ':3000')

if __name__ == '__main__':
    asyncio.run(start_server())
