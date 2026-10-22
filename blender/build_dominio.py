# ─────────────────────────────────────────────────────────────────────────────
# DOMINIO — diorama 3D della città (mappa, truppe, ambientazione)
# Blender 4.5 · EEVEE Next
# Coordinate: 1 unità Blender = 20 px SVG. L'area SVG 720x520 corrisponde a
# x ∈ [-18, 18], y ∈ [-13, 13]: la camera "Cam_Alto" (ortografica) inquadra
# esattamente quell'area, quindi il render dall'alto si sovrappone 1:1 alla
# mappa SVG del gioco (src/data/territories.ts → svgPosition).
#
# Uso (Scripting di Blender):
#   exec(open(".../blender/build_dominio.py").read()); build(); save()
#   lighting('giorno') | lighting('tramonto')
# ─────────────────────────────────────────────────────────────────────────────
import bpy, bmesh, math, random, os
from mathutils import Matrix, Vector, noise

ROOT = "/Users/cristiandisalvo/Documents/GitHub/riskio/riskio/dominio-game/blender"
rnd = random.Random(7)
PI = math.pi

# ── Dati di gioco (da src/data) ─────────────────────────────────────────────
TERR = {
 'CS1':('Piazza Grande','CS',400,290,True),  'CS2':('Cattedrale','CS',365,252,False),
 'CS3':('Palazzo del Potere','CS',435,252,False),'CS4':('Mercato Centrale','CS',400,362,False),
 'PV1':('Banchine','PV',202,355,False),      'PV2':('Magazzini','PV',157,400,True),
 'PV3':('Q. Pescatori','PV',120,452,False),  'PV4':('Dogana','PV',202,455,False),
 'PN1':('Fabbriche','PN',132,130,False),     'PN2':('Q. Operaio','PN',232,100,False),
 'PN3':('Aeroporto Civile','PN',152,70,False),'PN4':('Raccordo Nord','PN',232,175,True),
 'CR1':('Villette','CR',562,160,False),      'CR2':('Q. Universitario','CR',572,250,False),
 'CR3':('Parco Regionale','CR',502,175,False),'CR4':('Ospedale Centrale','CR',563,295,True),
 'SE1':('Palazzi Popolari','SE',507,432,False),'SE2':('Centro Commerciale','SE',572,457,False),
 'SE3':('Stazione Ferroviaria','SE',537,387,True),'SE4':('Zona Ind. Est','SE',638,407,False),
}
CONN = {
 'CS1':['CS2','CS3','CS4','PV1','CR4'],'CS2':['CS1','CS3','CR1'],'CS3':['CS1','CS2','CS4'],
 'CS4':['CS1','CS3','SE3','SE1'],'PV1':['CS1','PV2','PV4'],'PV2':['PV1','PV3','PV4','PN4'],
 'PV3':['PV2','PV4','PN1'],'PV4':['PV1','PV2','PV3'],'PN1':['PV3','PN2','PN3'],
 'PN2':['PN1','PN3','PN4','CR3'],'PN3':['PN1','PN2','PN4'],'PN4':['PV2','PN2','PN3','SE4'],
 'CR1':['CS2','CR2','CR4'],'CR2':['CR1','CR3','CR4','SE3'],'CR3':['PN2','CR2','CR4'],
 'CR4':['CS1','CR1','CR2','CR3'],'SE1':['CS4','SE2','SE3'],'SE2':['SE1','SE3','SE4'],
 'SE3':['CS4','CR2','SE1','SE2'],'SE4':['PN4','SE2'],
}
ZONES = {  # svgBounds x,y,w,h + colore
 'CS':(293,208,212,188,'#4a7acd'),'PV':(58,308,234,188,'#cd4a4a'),
 'PN':(58,28,274,198,'#4acd4a'),'CR':(488,88,224,234,'#cdcd4a'),'SE':(448,338,274,178,'#cd4acd'),
}
FACTIONS = {
 'BIANCHI':('I Colletti Bianchi','#4a7acd','CS'),'MANO_NERA':('La Mano Nera','#cd4a4a','PV'),
 'STRADA':('I Figli della Strada','#c0561a','SE'),'ORDINE':("L'Ordine Civico",'#4acd4a','CR'),
}

def S(x, y): return Vector(((x-360)/20.0, -(y-260)/20.0))
TPOS = {k: S(v[2], v[3]) for k, v in TERR.items()}
def zone_rect(z):
    x, y, w, h, _ = ZONES[z]
    return ((x-360)/20, (x+w-360)/20, -(y+h-260)/20, -(y-260)/20)  # x0,x1,y0,y1

# ── Colori ──────────────────────────────────────────────────────────────────
def lin(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def hexc(h, a=1.0):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(ch*2 for ch in h)
    return (lin(int(h[0:2],16)/255), lin(int(h[2:4],16)/255), lin(int(h[4:6],16)/255), a)
def mixc(a, b, t): return tuple(a[i]*(1-t)+b[i]*t for i in range(3)) + (1.0,)

# ── Scena pulita ────────────────────────────────────────────────────────────
def fresh_scene(name):
    sc = bpy.data.scenes.new(name + "__tmp")
    for w in bpy.context.window_manager.windows: w.scene = sc
    for s in list(bpy.data.scenes):
        if s != sc: bpy.data.scenes.remove(s)
    for _ in range(4):
        bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    sc.name = name
    return sc

SC = None
def coll(name, parent=None, sc=None):
    c = bpy.data.collections.new(name)
    (parent.children if parent else (sc or SC).collection.children).link(c)
    return c

# ── Materiali ───────────────────────────────────────────────────────────────
MATS = {}

def _night(nt, strength):
    v = nt.nodes.new('ShaderNodeValue'); v.label = 'Notte'; v.outputs[0].default_value = 1.0
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = strength
    nt.links.new(v.outputs[0], mul.inputs[0])
    return mul.outputs[0]

def mat(name, color, rough=0.7, metal=0.0, emit=None, estr=0.0, night=True):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    col = hexc(color) if isinstance(color, str) else color
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = hexc(emit) if isinstance(emit, str) else emit
        if night: m.node_tree.links.new(_night(m.node_tree, estr), b.inputs['Emission Strength'])
        else: b.inputs['Emission Strength'].default_value = estr
    m.diffuse_color = col
    MATS[name] = m; return m

def mat_objcolor(name, rough=0.8):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    nt.links.new(oi.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    MATS[name] = m; return m

def sock(node, ident, out=False):
    for s in (node.outputs if out else node.inputs):
        if s.identifier == ident: return s
    raise KeyError(ident)

def mat_facade():
    """Muri col colore dell'oggetto + finestre procedurali (accese a caso)."""
    m = bpy.data.materials.new('Facciata'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']
    def math_(op, a=None, bb=None, c=None):
        n = N.new('ShaderNodeMath'); n.operation = op
        for i, v in enumerate((a, bb, c)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: L.new(v, n.inputs[i])
        return n.outputs[0]
    geo = N.new('ShaderNodeNewGeometry')
    sn = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Normal'], sn.inputs[0])
    sp = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sp.inputs[0])
    ax = math_('ABSOLUTE', sn.outputs[0]); ay = math_('ABSOLUTE', sn.outputs[1]); az = math_('ABSOLUTE', sn.outputs[2])
    fx = math_('GREATER_THAN', ax, ay)
    u = math_('ADD', sp.outputs[0], math_('MULTIPLY', fx, math_('SUBTRACT', sp.outputs[1], sp.outputs[0])))
    cmb = N.new('ShaderNodeCombineXYZ'); L.new(u, cmb.inputs[0]); L.new(sp.outputs[2], cmb.inputs[1])
    br = N.new('ShaderNodeTexBrick'); br.offset = 0.0
    br.inputs['Color1'].default_value = (0,0,0,1); br.inputs['Color2'].default_value = (1,1,1,1)
    br.inputs['Mortar'].default_value = (1,1,1,1)
    br.inputs['Scale'].default_value = 1.0; br.inputs['Mortar Size'].default_value = 0.06
    br.inputs['Brick Width'].default_value = 0.16; br.inputs['Row Height'].default_value = 0.18
    br.inputs['Bias'].default_value = 0.0
    L.new(cmb.outputs[0], br.inputs['Vector'])
    window = math_('MULTIPLY', math_('SUBTRACT', 1.0, br.outputs['Fac']), math_('LESS_THAN', az, 0.5))
    bw = N.new('ShaderNodeRGBToBW'); L.new(br.outputs['Color'], bw.inputs[0])
    lit = math_('MULTIPLY', window, math_('GREATER_THAN', bw.outputs[0], 0.74))
    oi = N.new('ShaderNodeObjectInfo')
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    L.new(window, sock(mx, 'Factor_Float'))
    L.new(oi.outputs['Color'], sock(mx, 'A_Color'))
    sock(mx, 'B_Color').default_value = (0.02, 0.03, 0.05, 1)
    L.new(sock(mx, 'Result_Color', True), b.inputs['Base Color'])
    L.new(math_('MULTIPLY_ADD', window, -0.7, 0.85), b.inputs['Roughness'])
    b.inputs['Emission Color'].default_value = hexc('#ffc978')
    L.new(math_('MULTIPLY', lit, _night(nt, 3.5)), b.inputs['Emission Strength'])
    MATS['Facciata'] = m; return m

def mat_ground():
    m = bpy.data.materials.new('Terreno'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'Col'
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
    sock(mx, 'Factor_Float').default_value = 0.25
    nt.links.new(a.outputs['Color'], sock(mx, 'A_Color'))
    nt.links.new(nz.outputs['Color'], sock(mx, 'B_Color'))
    nt.links.new(sock(mx, 'Result_Color', True), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.92
    MATS['Terreno'] = m; return m

def mat_water():
    m = bpy.data.materials.new('Mare'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc('#123f4c')
    b.inputs['Roughness'].default_value = 0.06
    b.inputs['Specular IOR Level'].default_value = 0.6
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 9.0
    nz.inputs['Detail'].default_value = 4.0
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.12
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    MATS['Mare'] = m; return m

# ── Mesh builder (bmesh, flat shading low-poly) ─────────────────────────────
class MB:
    def __init__(self): self.bm = bmesh.new(); self.mats = []
    def _tag(self, verts, m):
        if m not in self.mats: self.mats.append(m)
        idx = self.mats.index(m)
        for f in {f for v in verts for f in v.link_faces}: f.material_index = idx
    @staticmethod
    def _R(rx, ry, rz):
        return Matrix.Rotation(rz,4,'Z') @ Matrix.Rotation(ry,4,'Y') @ Matrix.Rotation(rx,4,'X')
    def box(self, x, y, z, sx, sy, sz, m, rz=0.0, rx=0.0, ry=0.0):
        M = Matrix.Translation((x,y,z+sz/2)) @ self._R(rx,ry,rz) @ Matrix.Diagonal((sx,sy,sz,1))
        self._tag(bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)['verts'], m)
    def cyl(self, x, y, z, r1, r2, h, m, seg=12, rx=0.0, ry=0.0, rz=0.0, sx=1.0, sy=1.0):
        M = Matrix.Translation((x,y,z)) @ self._R(rx,ry,rz) @ Matrix.Translation((0,0,h/2)) @ Matrix.Diagonal((sx,sy,1,1))
        r = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                  radius1=r1, radius2=r2, depth=h, matrix=M)
        self._tag(r['verts'], m)
    def sph(self, x, y, z, r, m, sub=1, sx=1.0, sy=1.0, sz=1.0):
        M = Matrix.Translation((x,y,z)) @ Matrix.Diagonal((sx,sy,sz,1))
        self._tag(bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r, matrix=M)['verts'], m)
    def gable(self, x, y, z, sx, sy, h, m, rz=0.0, ridge=0.0):
        M = Matrix.Translation((x,y,z)) @ Matrix.Rotation(rz,4,'Z')
        P = [(-sx/2,-sy/2,0),(sx/2,-sy/2,0),(sx/2,sy/2,0),(-sx/2,sy/2,0),(-sx/2,ridge,h),(sx/2,ridge,h)]
        vs = [self.bm.verts.new(M @ Vector(p)) for p in P]
        for f in [(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(3,2,1,0)]:
            self.bm.faces.new([vs[i] for i in f])
        self._tag(vs, m)
    def mesh(self, name):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        for m in self.mats: me.materials.append(m)
        return me

def obj(name, me, c, loc=(0,0,0), rz=0.0, s=1.0, color=None):
    o = bpy.data.objects.new(name, me); c.objects.link(o)
    o.location = loc; o.rotation_euler[2] = rz
    o.scale = (s, s, s) if isinstance(s, (int, float)) else s
    if color: o.color = color
    return o

# ── Terreno: costa, colline, altezze ────────────────────────────────────────
LAND = [(-15.5,16.6),(23,16.6),(23,-16.6),(2.0,-16.6),(0.3,-14.6),(-2.6,-13.7),(-5.0,-13.2),
        (-5.1,-9.5),(-5.4,-7.0),(-6.0,-6.2),(-6.6,-6.6),(-6.7,-9.0),(-6.8,-13.0),(-10.0,-12.7),
        (-13.2,-12.4),(-14.4,-11.0),(-14.6,-8.0),(-15.0,-4.0),(-15.6,0.5),(-15.2,5.0),(-15.9,10.0)]
HILLS = [(13.5,3.5,0.7,2.2),(15.8,-0.6,0.5,1.8),(8.6,7.4,0.45,1.6),(16.6,7.2,0.6,2.0),
         (20.0,13.5,1.4,2.8),(4.0,14.5,0.8,2.4),(-11.5,14.5,0.6,2.2),(19.5,-12.5,0.7,2.4)]
def _segd(px, py, ax, ay, bx, by):
    dx, dy = bx-ax, by-ay; L2 = dx*dx+dy*dy
    t = max(0.0, min(1.0, ((px-ax)*dx+(py-ay)*dy)/L2)) if L2 else 0.0
    return math.hypot(px-ax-t*dx, py-ay-t*dy)
def coast_d(x, y):
    inside = False; dmin = 1e9; n = len(LAND)
    for i in range(n):
        ax, ay = LAND[i]; bx, by = LAND[(i+1) % n]
        if (ay > y) != (by > y) and x < (bx-ax)*(y-ay)/(by-ay)+ax: inside = not inside
        dmin = min(dmin, _segd(x, y, ax, ay, bx, by))
    return dmin if inside else -dmin
def sm(e0, e1, x):
    t = max(0.0, min(1.0, (x-e0)/(e1-e0))); return t*t*(3-2*t)
def base_h(x, y):
    v = sum(a*math.exp(-((x-cx)**2+(y-cy)**2)/(2*s*s)) for cx, cy, a, s in HILLS)
    return v + 0.04*noise.noise(Vector((x*0.35, y*0.35, 0.0)))
def H(x, y):
    s = sm(-0.6, 0.6, coast_d(x, y))
    return s*base_h(x, y) + (1-s)*(-0.75)
WATER_Z = -0.14

# ═════════════════════════════════════════════════════════════════════════════
def build():
    global SC
    SC = fresh_scene("Dominio_Mappa")
    MATS.clear()

    C_PL = coll('Plancia'); C_ZO = coll('Zone'); C_ST = coll('Strade')
    C_TE = coll('Territori'); C_CI = coll('Citta'); C_TR = coll('Truppe')
    C_AM = coll('Ambiente'); C_CA = coll('Camere')

    M = dict(
        stone=mat('Pietra','#d8d0c0',.8), marble=mat('Marmo','#ece6da',.45), terracotta=mat('Coppi','#a84a30',.8),
        lead=mat('Piombo','#5f676d',.55,.3), glass_lit=mat('Vetro_Acceso','#3a3020',.1,emit='#ffc978',estr=3.0),
        glass_dark=mat('Vetro_Scuro','#1b2836',.08,.2), concrete=mat('Cemento','#a9a49a',.9),
        asphalt=mat('Asfalto','#232327',.85), metal=mat('Metallo','#9aa0a6',.35,.8), metal_dark=mat('Ferro','#2b2d31',.5,.6),
        rust=mat('Ruggine','#8a4a2a',.85), yellow=mat('Giallo_Gru','#e0a818',.5), red=mat('Rosso','#b8302a',.6),
        white=mat('Bianco','#f0efe9',.6), grass=mat('Prato','#4f7a36',.95), wood=mat('Legno','#7a5534',.8),
        brick=mat('Mattone','#9a5040',.9), brick_dark=mat('Mattone_Scuro','#6e4034',.9), gold=mat('Oro','#d4a840',.3,1.0),
        corr=mat('Lamiera','#7d858c',.5,.5), green_roof=mat('Rame_Verde','#5a8a78',.6,.3),
        ochre=mat('Ocra','#d9b77a',.8), customs=mat('Dogana','#c9b98f',.8), sand=mat('Ghiaia','#cdbb94',.95),
        red_emit=mat('Croce_Rossa','#ff2020',.5,emit='#ff2020',estr=6.0), neon_mag=mat('Neon_Magenta','#ff40d0',.4,emit='#ff40d0',estr=8.0),
        neon_grn=mat('Neon_Verde','#40ff70',.4,emit='#40ff70',estr=6.0), flame=mat('Fiamma','#ff8a20',.5,emit='#ff7a10',estr=12.0),
        lamp=mat('Lampada','#ffe0a0',.3,emit='#ffd38a',estr=10.0), pool=mat('Piscina','#30b8d0',.1,emit='#30b8d0',estr=0.6),
        water=mat_water(), black=mat('Nero','#101012',.6), skin=mat('Pelle','#e0b08c',.7), leather=mat('Cuoio','#5a3520',.6),
        tracks=mat('Binari','#4a4a4a',.4,.8),
    )
    FAC = mat_facade(); ROOF = mat_objcolor('Tetti', .8); FOL = mat_objcolor('Fogliame', .9); TINT = mat_objcolor('Tinta', .7)
    ZM = {z: mat('Zona_'+z, ZONES[z][4], .5, emit=ZONES[z][4], estr=2.5) for z in ZONES}
    FM = {f: mat('Fazione_'+f, FACTIONS[f][1], .45, emit=FACTIONS[f][1], estr=0.8) for f in FACTIONS}
    CONT = [mat('Container_'+str(i), c, .6, .3) for i, c in enumerate(['#b8352a','#2a5fa8','#2f8a4a','#d07a1a','#7a7a80'])]
    PASTEL = [mat('Casa_'+str(i), c, .85) for i, c in enumerate(['#e8b8a0','#a8c8d8','#e8d890','#c8e0b8','#f0e0d0','#d8a8c0'])]

    # ── Plancia: base in legno, terreno, mare ───────────────────────────────
    mb = MB(); mb.box(0,0,-1.6,44.8,32.8,0.8, mat('Legno_Base','#3a2416',.55))
    mb.box(0,0,-0.86,44.9,32.9,0.054, M['gold'])  # sotto il piano della cornice: niente sfarfallio
    obj('Base_Diorama', mb.mesh('Base_Diorama'), C_PL)

    X0, X1, Y0, Y1, ST = -22.0, 22.0, -16.0, 16.0, 0.2
    nx, ny = int(round((X1-X0)/ST))+1, int(round((Y1-Y0)/ST))+1
    verts, cols, faces = [], [], []
    land = hexc('#6f6c52'); grassc = hexc('#5d7a3e'); sandc = hexc('#cdb88e'); seab = hexc('#2e4a4e'); soil = hexc('#3e3024')
    ztint = {z: mixc(hexc(ZONES[z][4]), land, 0.45) for z in ZONES}
    zr = {z: zone_rect(z) for z in ZONES}
    for j in range(ny):
        for i in range(nx):
            x, y = X0+i*ST, Y0+j*ST
            d = coast_d(x, y); s = sm(-0.6, 0.6, d); bh = base_h(x, y)
            verts.append((x, y, s*bh + (1-s)*(-0.75)))
            c = mixc(land, grassc, min(1.0, max(0.0, bh*1.4)))
            for zz, (a0, a1, b0, b1) in zr.items():
                dout = math.hypot(max(a0-x, 0, x-a1), max(b0-y, 0, y-b1))
                mk = 1.0 - sm(0.0, 0.35, dout)
                if mk > 0: c = mixc(c, ztint[zz], 0.55*mk)
            c = mixc(c, sandc, 1.0 - sm(0.15, 0.7, d))
            c = mixc(c, seab, 1.0 - sm(-0.4, 0.05, d))
            cols.append(c)
    for j in range(ny-1):
        for i in range(nx-1):
            a = j*nx+i; faces.append((a, a+1, a+nx+1, a+nx))
    def skirt(idx):
        base = len(verts)
        for k in idx:
            x, y, _ = verts[k]; verts.append((x, y, -0.8)); cols.append(soil)
        for t in range(len(idx)-1):
            faces.append((idx[t], idx[t+1], base+t+1, base+t))
    skirt([i for i in range(nx)])
    skirt([(ny-1)*nx+i for i in range(nx)][::-1])
    skirt([j*nx for j in range(ny)][::-1])
    skirt([j*nx+nx-1 for j in range(ny)])
    me = bpy.data.meshes.new('Terreno'); me.from_pydata(verts, [], faces); me.update()
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for k, c in enumerate(cols): ca.data[k].color = c
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    me.materials.append(mat_ground())
    obj('Terreno', me, C_PL)

    mb = MB(); mb.box(0, 0, -0.8, 44.0, 32.0, 0.8+WATER_Z, M['water'])
    obj('Mare', mb.mesh('Mare'), C_PL)

    # ── Contorni zone (curve luminose) ──────────────────────────────────────
    for z, (a0, a1, b0, b1) in zr.items():
        a0, a1, b0, b1 = a0+0.15, a1-0.15, b0+0.15, b1-0.15
        r = 0.6; pts = []
        for cx, cy, ang in [(a1-r, b1-r, 0), (a0+r, b1-r, 90), (a0+r, b0+r, 180), (a1-r, b0+r, 270)]:
            for k in range(7):
                t = math.radians(ang + k*15); pts.append((cx+r*math.cos(t), cy+r*math.sin(t)))
        dense = []
        for k in range(len(pts)):
            p, q = Vector(pts[k]), Vector(pts[(k+1) % len(pts)])
            n = max(1, int((q-p).length/0.25))
            for t in range(n): dense.append(p.lerp(q, t/n))
        cu = bpy.data.curves.new('Confine_'+z, 'CURVE'); cu.dimensions = '3D'
        cu.bevel_depth = 0.035; cu.bevel_resolution = 1
        sp = cu.splines.new('POLY'); sp.points.add(len(dense)-1); sp.use_cyclic_u = True
        for k, p in enumerate(dense):
            sp.points[k].co = (p.x, p.y, max(H(p.x, p.y), WATER_Z)+0.05, 1)
        cu.materials.append(ZM[z])
        o = bpy.data.objects.new('Confine_'+z, cu); C_ZO.objects.link(o)

    # ── Strade (con deviazioni attorno ai territori) e superstrada ──────────
    def route(a, b, excl):
        pts = [a.copy(), b.copy()]
        for _ in range(5):
            changed = False
            for i in range(len(pts)-1):
                p, q = pts[i], pts[i+1]; d = q-p; L2 = d.length_squared
                for tid, c in TPOS.items():
                    if tid in excl: continue
                    t = max(0.0, min(1.0, (c-p).dot(d)/L2)); cl = p+d*t; dist = (c-cl).length
                    if dist < 1.2 and 0.02 < t < 0.98:
                        nrm = cl-c
                        if nrm.length < 1e-4: nrm = Vector((-d.y, d.x))
                        nrm.normalize(); pts.insert(i+1, c+nrm*1.45); changed = True; break
                if changed: break
            if not changed: break
        pts[0] = pts[0] + (pts[1]-pts[0]).normalized()*0.95
        pts[-1] = pts[-1] + (pts[-2]-pts[-1]).normalized()*0.95
        return pts
    def sample(pts, step):
        out = []
        for i in range(len(pts)-1):
            p, q = pts[i], pts[i+1]; n = max(1, int((q-p).length/step))
            for k in range(n): out.append(p.lerp(q, k/n))
        out.append(pts[-1]); return out
    def ribbon(name, smp, zs, width, thick, m, c):
        V, F, N = [], [], len(smp)
        for i, p in enumerate(smp):
            t = smp[min(i+1, N-1)] - smp[max(i-1, 0)]; t.normalize()
            n = Vector((-t.y, t.x))*width/2; z = zs[i]
            for pp, zz in ((p+n, z), (p-n, z), (p-n, z-thick), (p+n, z-thick)): V.append((pp.x, pp.y, zz))
        for i in range(N-1):
            a, b = i*4, (i+1)*4
            F += [(a,a+1,b+1,b),(a+1,a+2,b+2,b+1),(a+2,a+3,b+3,b+2),(a+3,a,b,b+3)]
        F += [(0,3,2,1), ((N-1)*4, (N-1)*4+1, (N-1)*4+2, (N-1)*4+3)]
        me = bpy.data.meshes.new(name); me.from_pydata(V, [], F); me.update()
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
        me.materials.append(m); return obj(name, me, c)

    mb = MB(); mb.cyl(0,0,0,.012,.01,.28,M['metal_dark'],seg=6); mb.box(.03,0,.265,.07,.014,.014,M['metal_dark'])
    mb.sph(.065,0,.25,.026,M['lamp'],sub=1); LAMP = mb.mesh('U_Lampione')
    ROAD_SEGS = []; seen = set(); lamp_n = 0
    for a, lst in CONN.items():
        for b in lst:
            key = tuple(sorted((a, b)))
            if key in seen: continue
            seen.add(key)
            elevated = key == ('PN4', 'SE4')
            pts = route(TPOS[a], TPOS[b], set(TPOS) if elevated else {a, b})
            for i in range(len(pts)-1): ROAD_SEGS.append((pts[i], pts[i+1]))
            smp = sample(pts, 0.25)
            gz = [max(H(p.x, p.y), WATER_Z)+0.035 for p in smp]
            if not elevated:
                ribbon(f'Strada_{a}_{b}', smp, gz, 0.32, 0.08, M['asphalt'], C_ST)
                acc = 0.0; side = 1
                for i in range(1, len(smp)):
                    acc += (smp[i]-smp[i-1]).length
                    if acc >= 1.5:
                        acc = 0.0; side = -side
                        t = (smp[min(i+1, len(smp)-1)]-smp[i-1]).normalized(); n = Vector((-t.y, t.x))*side
                        p = smp[i] + n*0.24
                        obj(f'Lampione_{lamp_n:03d}', LAMP, C_ST, (p.x, p.y, H(p.x, p.y)), math.atan2(-n.y, -n.x)); lamp_n += 1
            else:
                tot = sum((smp[i]-smp[i-1]).length for i in range(1, len(smp))); acc = 0.0; zs = []
                for i, p in enumerate(smp):
                    if i: acc += (smp[i]-smp[i-1]).length
                    e = 1.15*sm(0.0, 1.8, min(acc, tot-acc))
                    zs.append(max(gz[i], (gz[0] if acc < tot/2 else gz[-1]) + e))
                ribbon('Superstrada_Raccordo', smp, zs, 0.5, 0.1, M['concrete'], C_ST)
                ribbon('Superstrada_Asfalto', smp, [z+0.005 for z in zs], 0.42, 0.02, M['asphalt'], C_ST)
                acc = 0.0
                for i in range(1, len(smp)):
                    acc += (smp[i]-smp[i-1]).length
                    p = smp[i]; g = H(p.x, p.y)
                    if acc >= 1.4 and zs[i]-g > 0.45:
                        acc = 0.0; mbp = MB(); mbp.cyl(0,0,0,.07,.07,zs[i]-g,M['concrete'],seg=8)
                        obj('Pilone', mbp.mesh('Pilone'), C_ST, (p.x, p.y, g-0.1))

    # ── Territori: esagoni + monumenti ──────────────────────────────────────
    def lm_CS1(m):
        m.cyl(0,0,0,.85,.85,.02,M['stone'],seg=24); m.cyl(0,0,.02,.3,.3,.1,M['marble'],seg=16)
        m.cyl(0,0,.1,.26,.26,.025,M['water'],seg=16); m.cyl(0,0,.1,.05,.05,.35,M['marble'],seg=8)
        m.cyl(0,0,.45,.12,.08,.04,M['marble'],seg=12); m.cyl(0,0,.49,.03,.03,.12,M['marble'],seg=8)
        m.sph(0,0,.66,.06,M['gold'],sub=2)
        for k in range(4):
            a = PI/4 + k*PI/2
            m.box(.55*math.cos(a), .55*math.sin(a), .02, .22, .06, .05, M['wood'], rz=a+PI/2)
            b = k*PI/2
            m.cyl(.72*math.cos(b), .72*math.sin(b), .02, .015, .015, .38, M['metal_dark'], seg=6)
            m.sph(.72*math.cos(b), .72*math.sin(b), .42, .04, M['lamp'], sub=1)
    def lm_CS2(m):
        m.box(0,0,0,1.0,.42,.48,M['marble']); m.gable(0,0,.48,1.04,.46,.2,M['lead'])
        m.box(-.1,0,0,.28,.72,.42,M['marble']); m.gable(-.1,0,.42,.76,.32,.18,M['lead'],rz=PI/2)
        m.cyl(-.1,0,.58,.15,.15,.14,M['marble'],seg=12); m.sph(-.1,0,.72,.15,M['green_roof'],sub=2,sz=.9)
        m.cyl(-.1,0,.84,.02,0,.12,M['gold'],seg=6)
        m.box(.42,.27,0,.2,.2,1.05,M['marble']); m.cyl(.42,.27,1.05,.15,0,.3,M['lead'],seg=4,rz=PI/4)
        m.cyl(.501,0,.32,.08,.08,.01,M['glass_lit'],seg=12,ry=PI/2)
        m.box(.505,0,.02,.02,.12,.2,M['glass_lit'])
    def lm_CS3(m):
        m.box(0,0,0,1.15,.75,.08,M['stone']); m.box(0,.1,.08,1.05,.5,.45,M['ochre'])
        for i in range(6): m.cyl(-.45+.18*i,-.27,.08,.035,.035,.42,M['marble'],seg=8)
        m.box(0,-.27,.5,1.0,.12,.05,M['marble']); m.gable(0,-.27,.55,.14,1.0,.16,M['marble'],rz=PI/2)
        m.box(0,.1,.53,1.07,.52,.03,M['terracotta'])
        m.box(0,.22,.53,.24,.24,.45,M['ochre']); m.cyl(0,.099,.86,.07,.07,.01,M['white'],seg=16,rx=PI/2)
        m.cyl(0,.22,.98,.18,0,.16,M['terracotta'],seg=4,rz=PI/4)
        m.cyl(0,.22,1.1,.01,.01,.35,M['metal']); m.box(.08,.22,1.33,.16,.01,.1,M['gold'])
        for i in range(5): m.box(-.4+.2*i,-.151,.2,.08,.01,.14,M['glass_lit'])
    def lm_CS4(m):
        m.box(0,.2,0,1.0,.42,.3,M['brick']); m.cyl(-.52,.2,.3,.21,.21,1.04,M['green_roof'],seg=16,ry=PI/2)
        m.box(0,-.011,.06,.6,.01,.18,M['glass_lit'])
        aw = [M['red'], M['white'], M['yellow'], M['red'], M['white']]
        for i in range(5):
            x = -.5+.25*i
            m.box(x,-.4,0,.17,.14,.12,M['wood']); m.box(x,-.42,.15,.21,.22,.02,aw[i],rx=.3)
            m.box(x+.06,-.25,0,.06,.06,.05,M['wood'])
    def lm_PV1(m):
        m.box(0,0,0,1.25,1.05,.05,M['concrete'])
        for dx in (-.15,.15):
            for dy in (-.22,.02): m.box(dx,dy-.1,.05,.04,.04,.6,M['yellow'])
        m.box(0,-.2,.62,.42,.32,.12,M['yellow']); m.box(.1,-.2,.74,.14,.14,.1,M['glass_lit'])
        m.box(.42,-.2,.7,.95,.06,.06,M['yellow']); m.box(-.3,-.2,.68,.16,.22,.12,M['concrete'])
        m.box(.8,-.2,.38,.01,.01,.32,M['metal']); m.box(.8,-.2,.34,.06,.04,.04,M['metal_dark'])
        for i in range(3):
            for j in range(2):
                for k in range(rnd.randint(1, 3)):
                    m.box(-.35+j*.29, .15+i*.13, .05+k*.11, .28, .11, .11, CONT[rnd.randrange(len(CONT))])
        for k in range(4): m.cyl(.55, -.45+k*.3, .05, .025, .03, .06, M['metal_dark'], seg=6)
    def lm_PV2(m):
        for i, y in enumerate((-.38, 0, .38)):
            m.box(0,y,0,.95,.3,.28,[M['brick'],M['rust'],M['brick_dark']][i])
            m.gable(0,y,.28,.98,.32,.12,M['corr']); m.box(.48,y,0,.01,.14,.17,M['wood'])
            m.box(.481,y,.2,.01,.2,.03,M['glass_lit'])
    def lm_PV3(m):
        for i, (x, y, h) in enumerate([(-.45,.3,.24),(-.15,.36,.3),(.15,.32,.22),(.45,.28,.27),(-.32,-.12,.25),(.05,-.08,.2)]):
            m.box(x,y,0,.24,.22,h,PASTEL[i % len(PASTEL)]); m.gable(x,y,h,.27,.25,.1,M['terracotta'])
            m.box(x,y-.111,.06,.05,.01,.07,M['glass_lit'])
        m.box(.38,-.45,0,.55,.14,.03,M['wood'])
        for k in range(3): m.cyl(-.6+k*.12,-.45,0,.008,.008,.22,M['wood'],seg=5)
    def lm_PV4(m):
        m.box(0,0,0,.85,.5,.42,M['customs']); m.box(0,0,.42,.89,.54,.04,M['lead'])
        m.box(-.3,.1,.42,.22,.22,.45,M['customs']); m.cyl(-.3,.1,.87,.16,0,.22,M['lead'],seg=4,rz=PI/4)
        for x in (-.2, 0, .2): m.box(x,-.251,.12,.1,.01,.16,M['glass_lit'])
        m.cyl(.3,.1,.46,.01,.01,.4,M['metal']); m.box(.37,.1,.76,.14,.01,.09,M['white'])
    def lm_PN1(m):
        m.box(0,0,0,1.0,.7,.35,M['brick_dark'])
        for i in range(4): m.gable(-.375+.25*i,0,.35,.7,.25,.14,M['corr'],rz=PI/2,ridge=.125)
        for cx, cy, hh in ((.32,.28,1.2),(.45,-.15,1.0)):
            for k in range(5):
                r1 = .08-.004*k
                m.cyl(cx,cy,k*hh/5,r1,r1-.004,hh/5,M['red'] if k % 2 else M['white'],seg=10)
            m.cyl(cx,cy,hh,.03,.03,.02,M['flame'],seg=8)
        m.cyl(-.48,-.42,0,.12,.12,.5,M['concrete'],seg=12); m.cyl(-.48,-.42,.5,.12,.03,.1,M['concrete'],seg=12)
        m.box(-.2,-.351,.05,.5,.01,.08,M['glass_lit'])
    def lm_PN2(m):
        for x, y, sx, sy, h in ((-.38,.2,.28,.55,.75),(0,.25,.28,.55,.95),(.38,.2,.28,.55,.65),(0,-.4,.62,.22,.55)):
            m.box(x,y,0,sx,sy,h,FAC); m.box(x,y,h,sx+.02,sy+.02,.03,M['concrete'])
    def lm_PN3(m):
        a = .35; u = Vector((math.cos(a), math.sin(a)))
        m.box(0,0,0,1.85,.3,.02,M['asphalt'],rz=a)
        for k in range(7):
            p = u*(-.75+k*.25); m.box(p.x,p.y,.02,.1,.02,.005,M['white'],rz=a)
        m.cyl(.32,.45,0,.06,.05,.6,M['concrete'],seg=8); m.cyl(.32,.45,.6,.14,.16,.12,M['glass_lit'],seg=8)
        m.cyl(.32,.45,.72,.17,.1,.04,M['lead'],seg=8)
        m.cyl(-.62,.42,0,.2,.2,.55,M['corr'],seg=14,ry=PI/2)
        c = u*(-.25)
        b0 = c - u*.27; m.cyl(b0.x,b0.y,.09,.045,.045,.5,M['white'],seg=8,ry=PI/2,rz=a)
        nn = c + u*.23; m.cyl(nn.x,nn.y,.09,.045,0,.09,M['white'],seg=8,ry=PI/2,rz=a)
        m.box(c.x,c.y,.075,.16,.64,.015,M['white'],rz=a)
        t = c - u*.24; m.box(t.x,t.y,.1,.1,.012,.14,M['red'],rz=a); m.box(t.x,t.y,.12,.07,.24,.01,M['white'],rz=a)
    def lm_PN4(m):
        m.cyl(0,0,0,.42,.42,.025,M['grass'],seg=20)
        for k in range(20):
            a = k*2*PI/20; m.box(.52*math.cos(a),.52*math.sin(a),0,.18,.15,.03,M['asphalt'],rz=a+PI/2)
        for k in range(4):
            a = PI/4+k*PI/2; m.box(.78*math.cos(a),.78*math.sin(a),0,.42,.15,.03,M['asphalt'],rz=a)
        m.cyl(0,0,.025,.015,.015,.5,M['metal'],seg=6); m.box(0,0,.5,.3,.03,.12,M['neon_grn'])
        for k, cc in enumerate((M['red'], M['white'], M['yellow'])):
            a = k*2.1; m.box(.52*math.cos(a),.52*math.sin(a),.03,.09,.05,.04,cc,rz=a+PI/2)
    def lm_CR1(m):
        for x, y, r in ((-.4,.3,0),(.35,.35,.3),(-.3,-.35,-.2),(.4,-.3,.1)):
            m.box(x,y,0,.32,.26,.22,M['white'],rz=r); m.gable(x,y,.22,.35,.29,.13,M['terracotta'],rz=r)
            m.box(x,y-.131,.06,.06,.01,.08,M['glass_lit'],rz=r)
        m.box(0,0,0,.25,.18,.03,M['pool'])
        for x, y in ((-.05,.5),(.1,-.55),(-.6,0),(.62,.05)):
            m.cyl(x,y,0,.025,.02,.1,M['wood'],seg=5); m.sph(x,y,.17,.1,M['grass'],sub=1)
    def lm_CR2(m):
        m.box(0,.3,0,1.0,.25,.4,FAC); m.box(-.38,-.05,0,.25,.5,.4,FAC); m.box(.38,-.05,0,.25,.5,.4,FAC)
        m.box(0,.3,.4,1.02,.27,.03,M['terracotta']); m.box(-.38,-.05,.4,.27,.52,.03,M['terracotta'])
        m.box(.38,-.05,.4,.27,.52,.03,M['terracotta'])
        m.box(0,.3,.4,.18,.18,.4,M['stone']); m.cyl(0,.3,.8,.14,0,.2,M['green_roof'],seg=4,rz=PI/4)
        m.cyl(0,.209,.66,.06,.06,.01,M['white'],seg=16,rx=PI/2)
        m.box(0,-.05,0,.5,.45,.015,M['grass']); m.cyl(0,-.1,.015,.04,.04,.18,M['stone'],seg=8)
        m.sph(0,-.1,.24,.05,M['gold'],sub=1)
    def lm_CR3(m):
        m.cyl(0,0,0,.85,.85,.015,M['grass'],seg=24); m.cyl(.15,-.1,.0,.3,.3,.03,M['water'],seg=16,sx=1.4)
        m.box(-.2,.05,.0,.9,.06,.02,M['sand'],rz=.5)
        m.cyl(-.4,.38,0,.15,.15,.03,M['stone'],seg=8)
        for k in range(6):
            a = k*PI/3; m.cyl(-.4+.12*math.cos(a),.38+.12*math.sin(a),.03,.01,.01,.2,M['white'],seg=4)
        m.cyl(-.4,.38,.23,.19,0,.14,M['green_roof'],seg=8)
        for x, y, kind in ((.5,.4,0),(.65,.1,1),(-.65,-.2,0),(-.4,-.55,1),(.1,.55,1),(.45,-.6,0),(-.7,.15,1),(.25,.25,0)):
            m.cyl(x,y,0,.025,.02,.12,M['wood'],seg=5)
            if kind: m.sph(x,y,.2,.11,M['grass'],sub=1)
            else: m.cyl(x,y,.1,.12,0,.32,M['grass'],seg=7)
    def lm_CR4(m):
        m.box(-.36,0,0,.25,.9,.55,FAC); m.box(.36,0,0,.25,.9,.55,FAC); m.box(0,0,0,.5,.26,.45,FAC)
        for x in (-.36,.36): m.box(x,0,.55,.27,.92,.03,M['white'])
        m.box(0,0,.45,.52,.28,.03,M['white'])
        m.box(0,0,.48,.22,.06,.03,M['red_emit']); m.box(0,0,.48,.06,.22,.03,M['red_emit'])
        m.cyl(.36,.25,.58,.11,.11,.01,M['asphalt'],seg=16)
        m.box(.33,.25,.59,.015,.1,.004,M['white']); m.box(.39,.25,.59,.015,.1,.004,M['white']); m.box(.36,.25,.59,.06,.015,.004,M['white'])
        m.box(0,-.35,0,.16,.08,.08,M['white']); m.box(0,-.35,.03,.162,.082,.015,M['red'])
    def lm_SE1(m):
        for x, y, h in ((-.4,.1,1.8),(0,.25,2.2),(.4,0,1.6)):
            m.box(x,y,0,.28,.7,h,FAC); m.box(x,y,h,.3,.72,.03,M['concrete'])
            m.cyl(x,y+.15,h+.03,.05,.05,.1,M['metal'],seg=8)
    def lm_SE2(m):
        m.box(0,.2,0,1.1,.6,.32,M['white']); m.box(0,.2,.32,1.12,.62,.03,M['concrete'])
        m.box(0,-.101,.03,.5,.01,.22,M['glass_lit']); m.box(0,-.115,.26,.62,.02,.06,M['neon_mag'])
        m.box(0,-.5,0,1.05,.34,.012,M['asphalt'])
        for k in range(7): m.box(-.45+.15*k,-.5,.012,.012,.2,.002,M['white'])
        for k in range(5):
            m.box(-.38+.15*k+rnd.uniform(-.01,.01),-.5,.012,.07,.12,.05,CONT[rnd.randrange(len(CONT))])
    def lm_SE3(m):
        m.box(0,-.15,0,1.1,.4,.3,M['stone']); m.box(0,-.15,.3,.4,.4,.14,M['stone'])
        m.cyl(0,-.35,.36,.06,.06,.01,M['white'],seg=16,rx=PI/2)
        for x in (-.4,-.2,.2,.4): m.box(x,-.351,.06,.1,.01,.18,M['glass_lit'])
        m.box(0,.3,0,1.25,.3,.04,M['concrete']); m.cyl(-.62,.3,.04,.2,.2,1.24,M['glass_dark'],seg=12,ry=PI/2)
        for y in (.53,.63): m.box(0,y,0,1.5,.012,.02,M['tracks'])
        for k in range(3):
            m.box(-.4+.38*k,.58,.02,.36,.11,.13,M['red']); m.box(-.4+.38*k,.524,.08,.3,.01,.04,M['glass_lit'])
    def lm_SE4(m):
        for x, y in ((-.35,.25),(.05,.35),(.42,.2)):
            m.cyl(x,y,0,.2,.2,.32,M['white'],seg=14); m.cyl(x,y,.32,.2,.05,.06,M['white'],seg=14)
        m.box(0,.3,.2,.9,.03,.03,M['metal']); m.box(.1,-.35,0,.8,.35,.28,M['rust']); m.box(.1,-.35,.28,.82,.37,.03,M['corr'])
        m.cyl(-.55,-.3,0,.025,.02,.9,M['metal'],seg=6); m.cyl(-.55,-.3,.9,.04,.02,.06,M['flame'],seg=6)
    LMS = {'CS1':lm_CS1,'CS2':lm_CS2,'CS3':lm_CS3,'CS4':lm_CS4,'PV1':lm_PV1,'PV2':lm_PV2,'PV3':lm_PV3,'PV4':lm_PV4,
           'PN1':lm_PN1,'PN2':lm_PN2,'PN3':lm_PN3,'PN4':lm_PN4,'CR1':lm_CR1,'CR2':lm_CR2,'CR3':lm_CR3,'CR4':lm_CR4,
           'SE1':lm_SE1,'SE2':lm_SE2,'SE3':lm_SE3,'SE4':lm_SE4}
    LM_COLOR = {'PN2': hexc('#9b7462'), 'CR2': hexc('#d9c6a5'), 'CR4': hexc('#efefea'), 'SE1': hexc('#bdb3a0')}

    for tid, (name, zone, sx, sy, bott) in TERR.items():
        p = TPOS[tid]; hc = max(H(p.x, p.y), WATER_Z)
        tc = coll(f'{tid}_{name}', C_TE)
        mb = MB(); mb.cyl(0,0,-0.6,.95,.95,.66,ZM[zone],seg=6); mb.cyl(0,0,.06,.9,.9,.06,M['stone'],seg=6)
        obj(f'Esagono_{tid}', mb.mesh(f'Esagono_{tid}'), tc, (p.x, p.y, hc), PI/6)
        mb = MB(); LMS[tid](mb)
        obj(f'Monumento_{tid}', mb.mesh(f'Monumento_{tid}'), tc, (p.x, p.y, hc+0.12), 0.0, 0.8, color=LM_COLOR.get(tid))
        if bott:  # strettoia: barriere bianco/rosse sul bordo
            mb = MB()
            for k in range(12):
                a = k*2*PI/12 + PI/12
                mb.box(.86*math.cos(a), .86*math.sin(a), 0, .16, .05, .07, M['red'] if k % 2 else M['white'], rz=a+PI/2)
            obj(f'Strettoia_{tid}', mb.mesh(f'Strettoia_{tid}'), tc, (p.x, p.y, hc+0.12))

    # ── Città di riempimento ────────────────────────────────────────────────
    mb = MB(); mb.box(0,0,0,1,1,1,FAC); U_BOX = mb.mesh('U_Edificio')
    mb = MB(); mb.box(0,0,0,1,1,1,TINT); U_PLAIN = mb.mesh('U_Blocco')
    mb = MB(); mb.gable(0,0,0,1,1,1,ROOF); U_GABLE = mb.mesh('U_Tetto')
    mb = MB(); mb.cyl(0,0,0,.03,.025,.12,M['wood'],seg=6); mb.cyl(0,0,.1,.14,0,.3,FOL,seg=7); mb.cyl(0,0,.25,.1,0,.25,FOL,seg=7)
    U_PINE = mb.mesh('U_Pino')
    mb = MB(); mb.cyl(0,0,0,.03,.025,.15,M['wood'],seg=6); mb.sph(0,0,.25,.13,FOL,sub=1); U_OAK = mb.mesh('U_Albero')
    mb = MB(); mb.cyl(0,0,0,.05,.04,.6,M['brick_dark'],seg=8); U_CHIM = mb.mesh('U_Ciminiera')
    FOLC = [hexc(c) for c in ('#3f6a2e','#4e7a34','#5a8a3a','#36592a','#6a8a3a')]

    STYLE = {
     'CS': dict(h=(.35,.9), fp=(.32,.5), roof=.15, walls=['#d9a066','#e8c39e','#c97b4a','#e0d2b4','#b5654a'], roofc=['#a0472e','#8c3b26','#b35a3a'], rot=.15, dens=.92, trees=.03),
     'PV': dict(h=(.22,.5), fp=(.3,.55), roof=.12, walls=['#7d8b99','#a65e4e','#d8cdb8','#5f7f8c','#c2a477'], roofc=['#555a60','#6e4b3a'], rot=.05, dens=.8, trees=.05),
     'PN': dict(h=(.3,1.2), fp=(.35,.55), roof=0, walls=['#8a8a85','#9b9488','#6f7378','#a39a8a'], roofc=['#555555'], rot=0, dens=.75, trees=.08),
     'CR': dict(h=(.2,.38), fp=(.25,.38), roof=.14, walls=['#f2ead8','#e9dcc0','#f5f0e6','#dcc9a8'], roofc=['#b0442c','#9a3a25'], rot=.4, dens=.55, trees=.45),
     'SE': dict(h=(.8,2.4), fp=(.35,.5), roof=0, walls=['#c8bfae','#a8a295','#d6cdb9','#9a9a9a','#b49c86'], roofc=['#777777'], rot=0, dens=.85, trees=.04),
    }
    def seg_clear(x, y, r):
        for p, q in ROAD_SEGS:
            if _segd(x, y, p.x, p.y, q.x, q.y) < r: return False
        return True
    def tree(x, y, s=1.0):
        obj('Albero', U_PINE if rnd.random() < .5 else U_OAK, C_CI, (x, y, H(x, y)-0.02),
            rnd.uniform(0, 2*PI), s*rnd.uniform(.75, 1.3), color=rnd.choice(FOLC))
    GS = 0.62; nb = 0; nt_ = 0
    gx = -21.4
    while gx < 21.5:
        gy = -15.4
        while gy < 15.5:
            x = gx + rnd.uniform(-.07, .07); y = gy + rnd.uniform(-.07, .07); gy += GS
            if coast_d(x, y) < 0.45: continue
            if min((Vector((x, y))-c).length for c in TPOS.values()) < 1.3: continue
            zone = next((z for z in ('CS','SE','CR','PV','PN') if zr[z][0] < x < zr[z][1] and zr[z][2] < y < zr[z][3]), None)
            if zone is None:  # campagna: boschi e qualche cascina
                if not seg_clear(x, y, .35): continue
                nv = noise.noise(Vector((x*.18, y*.18, 3.0)))
                if nv > -0.05 and rnd.random() < .7:
                    for _ in range(rnd.randint(1, 3)):
                        tree(x+rnd.uniform(-.25,.25), y+rnd.uniform(-.25,.25)); nt_ += 1
                elif rnd.random() < .04:
                    z0 = H(x, y)-.1; r = rnd.uniform(0, PI)
                    obj('Cascina', U_BOX, C_CI, (x, y, z0), r, (.4, .28, .32), color=hexc('#e6d6b8'))
                    obj('Cascina_Tetto', U_GABLE, C_CI, (x, y, z0+.32), r, (.44, .32, .14), color=hexc('#a0472e'))
                continue
            st = STYLE[zone]
            if not seg_clear(x, y, .5): continue
            if rnd.random() > st['dens']: continue
            if rnd.random() < st['trees']: tree(x, y); nt_ += 1; continue
            w = rnd.uniform(*st['fp']); dd = rnd.uniform(*st['fp']); hh = rnd.uniform(*st['h'])
            if zone == 'SE' and rnd.random() < .35: hh *= .5
            z0 = H(x, y) - 0.12; r = rnd.uniform(-st['rot'], st['rot'])
            obj(f'Edificio_{zone}', U_BOX, C_CI, (x, y, z0), r, (w, dd, hh+.12), color=hexc(rnd.choice(st['walls'])))
            top = z0 + hh + .12
            if st['roof']:
                big, small = (dd, w) if dd > w else (w, dd)
                obj(f'Tetto_{zone}', U_GABLE, C_CI, (x, y, top), r + (PI/2 if dd > w else 0),
                    (big*1.08, small*1.08, st['roof']), color=hexc(rnd.choice(st['roofc'])))
            else:
                obj(f'Cornicione_{zone}', U_PLAIN, C_CI, (x, y, top), r, (w+.02, dd+.02, .03), color=hexc('#8f8a80'))
                if rnd.random() < .5:
                    obj(f'Impianto_{zone}', U_PLAIN, C_CI, (x+rnd.uniform(-.08,.08), y+rnd.uniform(-.08,.08), top+.03), r,
                        (w*.35, dd*.35, .08), color=hexc('#9a9a9a'))
                if zone == 'PN' and rnd.random() < .18:
                    obj('Ciminiera', U_CHIM, C_CI, (x+w*.25, y, top))
            nb += 1
            if zone == 'CR' and rnd.random() < .6:
                tree(x+rnd.choice((-.3,.3)), y+rnd.uniform(-.2,.2), .8); nt_ += 1
        gx += GS

    # ── Truppe (pedine delle 4 fazioni) ─────────────────────────────────────
    def figure(fid):
        m = MB(); fc = FM[fid]; sk = M['skin']
        m.cyl(0,0,0,.3,.3,.06,fc,seg=10); m.cyl(0,0,.06,.26,.26,.012,M['gold'],seg=10)
        def body(legs, shoes, torso, arms, hands=sk, torso_h=.36):
            for sx in (-.07, .07):
                m.box(sx,0,.072,.1,.12,.38,legs); m.box(sx,-.02,.072,.11,.16,.05,shoes)
            m.box(0,0,.45,.31,.18,torso_h,torso)
            for sx in (-.195, .195):
                m.box(sx,0,.47,.08,.1,.33,arms); m.sph(sx,0,.45,.045,hands,sub=1)
            m.cyl(0,0,.81,.05,.05,.05,sk,seg=8); m.sph(0,0,.93,.11,sk,sub=2)
        if fid == 'BIANCHI':
            suit = mat('Abito_Blu','#1f2f55',.55); hair = mat('Capelli','#2a1e16',.6)
            body(suit, M['black'], suit, suit)
            m.box(0,-.086,.6,.09,.012,.2,M['white']); m.box(0,-.094,.57,.035,.012,.2,M['red'])
            m.sph(0,.025,.99,.115,hair,sub=2,sz=.6)
            m.box(.25,0,.22,.06,.22,.16,M['leather']); m.box(.25,0,.38,.02,.07,.03,M['leather'])
        elif fid == 'MANO_NERA':
            coat = mat('Cappotto_Nero','#17171a',.5)
            body(mat('Pantaloni_Grigi','#3a3a40',.6), M['black'], coat, coat)
            m.box(0,0,.2,.33,.2,.62,coat); m.box(0,-.101,.66,.12,.012,.12,M['red'])
            m.cyl(0,0,1.0,.17,.17,.015,coat,seg=16); m.cyl(0,0,1.015,.105,.09,.1,coat,seg=12)
            m.cyl(0,0,1.015,.108,.108,.025,M['red'],seg=12)
        elif fid == 'STRADA':
            hood = mat('Felpa','#c0561a',.85); jeans = mat('Jeans','#2d4a7a',.8)
            body(jeans, M['white'], hood, hood)
            m.box(0,-.092,.5,.18,.012,.1,mat('Felpa_Tasca','#a8481a',.85))
            m.sph(0,.06,.96,.135,hood,sub=2)
            m.cyl(.23,-.03,.07,.045,.022,.42,M['wood'],seg=8)
        elif fid == 'ORDINE':
            arm = mat('Armatura_Verde','#2f5a32',.45,.2); dk = mat('Tuta_Scura','#1c1f22',.6)
            visor = mat('Visiera','#101820',.05,.3,emit='#60ff90',estr=0.4)
            body(dk, M['black'], arm, arm, hands=dk, torso_h=.37)
            for sx in (-.19, .19): m.sph(sx,0,.79,.075,arm,sub=1,sz=.7)
            m.sph(0,0,.95,.132,arm,sub=2,sz=.95); m.box(0,-.115,.91,.17,.035,.075,visor)
            m.box(-.21,-.18,.16,.3,.03,.55,mat('Scudo','#8ea3b0',.2,.4)); m.box(-.21,-.197,.62,.3,.006,.05,fc)
        return m.mesh(f'Truppa_{fid}')
    FIG = {f: figure(f) for f in FACTIONS}
    FLAG = {}
    for f in FACTIONS:
        m = MB(); m.cyl(0,0,0,.012,.012,.75,M['metal'],seg=6); m.sph(0,0,.76,.022,M['gold'],sub=1)
        m.box(.13,0,.6,.25,.012,.15,FM[f]); FLAG[f] = m.mesh(f'Bandiera_{f}')
    owner = {FACTIONS[f][2]: f for f in FACTIONS}
    for tid, (name, zone, *_r) in TERR.items():
        f = owner.get(zone)
        if not f: continue
        p = TPOS[tid]; hc = max(H(p.x, p.y), WATER_Z) + 0.12
        for k, a in enumerate((-122, -90, -58)):
            t = math.radians(a)
            obj(f'Truppa_{f}_{tid}_{k}', FIG[f], C_TR, (p.x+.72*math.cos(t), p.y+.72*math.sin(t), hc),
                rnd.uniform(-.25, .25), 0.42)
        t = math.radians(140)
        obj(f'Bandiera_{f}_{tid}', FLAG[f], C_TR, (p.x+.8*math.cos(t), p.y+.8*math.sin(t), hc), 0.0)

    # ── Ambiente: barche, nave cargo, faro, titolo ──────────────────────────
    m = MB(); m.box(0,0,-.05,.42,.15,.1,M['white']); m.box(0,0,.035,.43,.152,.02,M['red'])
    m.box(-.06,0,.05,.14,.11,.08,M['white']); m.box(-.06,-.056,.07,.1,.002,.03,M['glass_lit'])
    m.cyl(.08,0,.05,.008,.008,.28,M['wood'],seg=5); BOAT = m.mesh('U_Peschereccio')
    for x, y, r in ((-15.6,-9.0,.4),(-15.0,-13.4,-.3),(-16.9,-3.0,1.2),(-5.85,-11.6,1.57),(-5.95,-8.6,1.5),(-17.5,6.0,.2)):
        obj('Peschereccio', BOAT, C_AM, (x, y, WATER_Z), r)
    m = MB(); m.box(0,0,-.12,3.0,.55,.34,mat('Scafo','#5a1e1a',.6)); m.box(0,0,.2,3.0,.56,.03,M['black'])
    m.box(-1.1,0,.22,.4,.45,.42,M['white']); m.box(-.899,0,.5,.01,.4,.05,M['glass_lit'])
    m.box(-1.1,0,.64,.3,.6,.04,M['white']); m.cyl(-1.2,0,.64,.07,.07,.22,M['red'],seg=10)
    for i in range(6):
        for j in (-.14, .14):
            for k in range(rnd.randint(1, 3)):
                m.box(-.6+i*.36,j,.23+k*.12,.33,.13,.12,CONT[rnd.randrange(len(CONT))])
    obj('Nave_Cargo', m.mesh('Nave_Cargo'), C_AM, (-1.8,-15.25,WATER_Z), 0.06)
    m = MB(); m.cyl(0,0,-.3,.2,.16,.4,M['stone'],seg=10)
    for k in range(5): m.cyl(0,0,.1+k*.2,.15-.01*k,.14-.01*k,.2,M['red'] if k % 2 else M['white'],seg=10)
    m.cyl(0,0,1.1,.11,.11,.14,M['lamp'],seg=10); m.cyl(0,0,1.24,.13,0,.14,M['red'],seg=10)
    obj('Faro', m.mesh('Faro'), C_AM, (-13.5,-11.6,H(-13.5,-11.6)))
    tx = bpy.data.curves.new('Titolo', 'FONT'); tx.body = 'DOMINIO'; tx.align_x = 'CENTER'; tx.align_y = 'CENTER'
    tx.size = 0.55; tx.extrude = 0.02; tx.materials.append(M['gold'])
    o = bpy.data.objects.new('Titolo', tx); C_AM.objects.link(o)
    o.location = (0, -16.42, -1.2); o.rotation_euler = (PI/2, 0, 0)

    # ── Luci, mondo, camere, render ─────────────────────────────────────────
    sun = bpy.data.lights.new('Sole', 'SUN'); so = bpy.data.objects.new('Sole', sun); C_AM.objects.link(so)
    sun.angle = math.radians(2.0)
    w = bpy.data.worlds.new('Cielo'); w.use_nodes = True; SC.world = w
    wn = w.node_tree.nodes; wl = w.node_tree.links   # cielo: gradiente orizzonte → zenit
    tc = wn.new('ShaderNodeTexCoord'); spz = wn.new('ShaderNodeSeparateXYZ'); wl.new(tc.outputs['Generated'], spz.inputs[0])
    mr = wn.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -0.05; mr.inputs['From Max'].default_value = 0.7
    wl.new(spz.outputs[2], mr.inputs['Value'])
    ramp = wn.new('ShaderNodeValToRGB'); ramp.color_ramp.elements.new(0.35)
    wl.new(mr.outputs['Result'], ramp.inputs['Fac'])
    bg = wn['Background']; wl.new(ramp.outputs['Color'], bg.inputs[0])

    def cam(name, loc, target, lens=35, ortho=None):
        cd = bpy.data.cameras.new(name); co = bpy.data.objects.new(name, cd); C_CA.objects.link(co)
        co.location = loc
        co.rotation_euler = (Vector(target)-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        cd.lens = lens; cd.clip_end = 300
        if ortho: cd.type = 'ORTHO'; cd.ortho_scale = ortho; cd.sensor_fit = 'HORIZONTAL'
        return co
    top = cam('Cam_Alto', (0, 0, 40), (0, 0, 0), ortho=36.0); top.rotation_euler = (0, 0, 0)
    hero = cam('Cam_Eroe', (3.0, -29.0, 20.0), (1.0, -1.5, 0.0), 32)
    cam('Cam_Porto', (-3.5, -17.5, 3.2), (-9.5, -7.5, 0.0), 30)
    cam('Cam_Centro', (6.5, -8.0, 4.0), (1.8, -0.5, 0.4), 28)
    SC.camera = hero

    r = SC.render; r.engine = 'BLENDER_EEVEE_NEXT'; r.resolution_x = 1920; r.resolution_y = 1080
    ee = SC.eevee; ee.taa_render_samples = 64
    for k, v in (('use_raytracing', True), ('use_shadows', True), ('shadow_ray_count', 2)):
        try: setattr(ee, k, v)
        except Exception: pass
    try:
        SC.view_settings.view_transform = 'AgX'; SC.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    SC.use_nodes = True; nt = SC.node_tree
    rl = nt.nodes.get('Render Layers'); cp = nt.nodes.get('Composite')
    gl = nt.nodes.new('CompositorNodeGlare'); gl.glare_type = 'FOG_GLOW'; gl.quality = 'HIGH'
    try: gl.threshold = 1.2; gl.mix = -0.6
    except Exception: pass
    nt.links.new(rl.outputs['Image'], gl.inputs['Image']); nt.links.new(gl.outputs['Image'], cp.inputs['Image'])
    lighting('tramonto')
    return dict(buildings=nb, trees=nt_, lamps=lamp_n, objects=len(bpy.data.objects))

def lighting(preset):
    """'tramonto' = sera con finestre accese · 'giorno' = luce piena (per la mappa dall'alto)."""
    sc = bpy.data.scenes['Dominio_Mappa']
    so = bpy.data.objects['Sole']; sun = so.data
    ramp = next(n for n in sc.world.node_tree.nodes if n.type == 'VALTORGB')
    bg = sc.world.node_tree.nodes['Background']
    if preset == 'giorno':
        el, az, col, st, sky_s, night, expo = 48, -35, (1.0, .93, .84), 4.0, 1.0, 0.12, 0.0
        skyc = ('#e6eef2', '#9cc4e4', '#4a86c8')
    else:
        el, az, col, st, sky_s, night, expo = 11, -62, (1.0, .56, .32), 4.0, 0.7, 1.0, 0.75
        skyc = ('#f0905a', '#6a4a7a', '#141c3a')
    so.rotation_euler = (math.radians(90-el), 0, math.radians(az))
    sun.color = col; sun.energy = st
    for e, c in zip(ramp.color_ramp.elements, skyc): e.color = hexc(c)
    bg.inputs['Strength'].default_value = sky_s
    for m in bpy.data.materials:
        if not m.node_tree: continue
        for n in m.node_tree.nodes:
            if n.type == 'VALUE' and n.label == 'Notte': n.outputs[0].default_value = night
    sc.view_settings.exposure = expo

def save():
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'dominio_citta.blend'))


def build_troops():
    """Scena vetrina 'Dominio_Truppe': le 4 pedine a grandezza piena, su piedistalli."""
    for s in [s for s in bpy.data.scenes if s.name == 'Dominio_Truppe']: bpy.data.scenes.remove(s)
    sc = bpy.data.scenes.new('Dominio_Truppe')
    c = bpy.data.collections.new('Vetrina'); sc.collection.children.link(c)
    floor = mat('Pavimento_Studio', '#17181c', .35); ped = mat('Piedistallo', '#26272d', .3, .2)
    mb = MB(); mb.cyl(0, 0, -0.05, 12, 12, 0.05, floor, seg=48); obj('Pavimento', mb.mesh('Pavimento'), c)
    order = ['BIANCHI', 'MANO_NERA', 'STRADA', 'ORDINE']
    for i, f in enumerate(order):
        x = (i - 1.5) * 1.15
        mb = MB(); mb.cyl(0, 0, 0, .42, .45, .22, ped, seg=8); mb.cyl(0, 0, .22, .43, .43, .015, MATS['Fazione_'+f], seg=8)
        obj(f'Piedistallo_{f}', mb.mesh(f'Piedistallo_{f}'), c, (x, 0, 0), PI/8)
        obj(f'Vetrina_{f}', bpy.data.meshes[f'Truppa_{f}'], c, (x, 0, .235), rnd.uniform(-.15, .15) + (0.0 if i % 2 else 0.1))
        tx = bpy.data.curves.new(f'Nome_{f}', 'FONT'); tx.body = FACTIONS[f][0]; tx.align_x = 'CENTER'
        tx.size = .085; tx.extrude = .004; tx.materials.append(MATS['Fazione_'+f])
        o = bpy.data.objects.new(f'Nome_{f}', tx); c.objects.link(o)
        o.location = (x, -.62, .002); o.rotation_euler = (math.radians(70), 0, 0)
    def area(name, loc, target, energy, size, color):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size; ld.color = color
        lo = bpy.data.objects.new(name, ld); c.objects.link(lo); lo.location = loc
        lo.rotation_euler = (Vector(target)-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    area('Key', (-2.5, -3.5, 3.5), (0, 0, .6), 600, 2.5, (1, .92, .85))
    area('Fill', (3.5, -2.5, 1.5), (0, 0, .6), 150, 3.0, (.75, .85, 1))
    area('Rim', (0, 3.0, 2.5), (0, 0, .8), 500, 4.0, (1, .7, .5))
    w = bpy.data.worlds.get('Studio') or bpy.data.worlds.new('Studio'); w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = hexc('#0c0d12'); sc.world = w
    cd = bpy.data.cameras.new('Cam_Truppe'); cd.lens = 42; co = bpy.data.objects.new('Cam_Truppe', cd); c.objects.link(co)
    co.location = (0, -6.4, 1.9); co.rotation_euler = (Vector((0, 0, .62))-co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    r = sc.render; r.engine = 'BLENDER_EEVEE_NEXT'; r.resolution_x = 1920; r.resolution_y = 1080
    sc.eevee.taa_render_samples = 64
    try: sc.eevee.use_raytracing = True
    except Exception: pass
    try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    return sc
