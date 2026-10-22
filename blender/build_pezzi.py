# ─────────────────────────────────────────────────────────────────────────────
# DOMINIO — pezzi di gioco v2: truppe dettagliate, bandiere al vento, dadi,
# arena dello scontro e stemmi delle fazioni (UI).
# Blender 4.5+ / 5.x (anche headless:  blender -b -P build_pezzi.py
#                                      oppure  python3 build_pezzi.py  con il modulo bpy)
#
# Riusa gli helper di build_dominio.py (MB, mat, hexc, FACTIONS) e produce:
#   ../public/models/truppe.glb   4× "Truppa_<F>" + 4× "Bandiera_<F>"  (stessi nomi/scala di prima)
#   ../public/models/dadi.glb     "Dado_Attacco", "Dado_Difesa"  (lato 1, centrati)
#   ../public/models/arena.glb    "Arena" (piazza dello scontro, origine al centro del piano)
#                                 + 4× "Stemma_<F>" (insegne 3D sopra gli schieramenti)
#   ../public/ui/stemma_<f>.png   stemmi renderizzati per l'interfaccia HTML (256 px, sfondo trasparente)
#   renders/truppe_v2.png         vetrina delle nuove pedine
#
# Facce dei dadi (coordinate Blender → three.js):
#   1:+Z→+Y   6:-Z→-Y   2:-Y→+Z   5:+Y→-Z   3:+X→+X   4:-X→-X
# ─────────────────────────────────────────────────────────────────────────────
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else \
    "/Users/cristiandisalvo/Documents/GitHub/riskio/riskio/dominio-game/blender"
GAME = os.path.dirname(HERE)
_ns = {'__file__': os.path.join(HERE, 'build_dominio.py')}
exec(open(os.path.join(HERE, 'build_dominio.py')).read(), _ns)
MB, mat, hexc, FACTIONS, MATS = _ns['MB'], _ns['mat'], _ns['hexc'], _ns['FACTIONS'], _ns['MATS']
PI = math.pi

FACTION_ORDER = ('BIANCHI', 'MANO_NERA', 'STRADA', 'ORDINE')


# ── Mesh builder esteso: spigoli smussati, teli, prismi ─────────────────────
class MB2(MB):
    def _idx(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)

    def bbox(self, x, y, z, sx, sy, sz, m, r=0.02, seg=2, rz=0.0, rx=0.0, ry=0.0):
        """Box con spigoli smussati (origine alla base, come MB.box)."""
        M = Matrix.Translation((x, y, z + sz / 2)) @ self._R(rx, ry, rz) @ Matrix.Diagonal((sx, sy, sz, 1))
        vs = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)['verts']
        faces = {f for v in vs for f in v.link_faces}
        edges = list({e for v in vs for e in v.link_edges})
        r = min(r, sx * .45, sy * .45, sz * .45)
        res = bmesh.ops.bevel(self.bm, geom=edges, offset=r, offset_type='OFFSET', segments=seg,
                              profile=0.5, affect='EDGES', clamp_overlap=True)
        mi = self._idx(m)
        for f in list(faces) + list(res['faces']):
            if f.is_valid: f.material_index = mi

    def prism(self, pts, z0, z1, m, M=Matrix.Identity(4)):
        """Estrude un poligono 2D (x, y) da z0 a z1."""
        lo = [self.bm.verts.new(M @ Vector((x, y, z0))) for x, y in pts]
        hi = [self.bm.verts.new(M @ Vector((x, y, z1))) for x, y in pts]
        n = len(pts); fs = [self.bm.faces.new(hi), self.bm.faces.new(list(reversed(lo)))]
        for i in range(n):
            j = (i + 1) % n
            fs.append(self.bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
        mi = self._idx(m)
        for f in fs: f.material_index = mi

    def cloth(self, x0, z0, w, h, m, nx=10, nz=5, amp=.035, waves=1.6, thick=.008):
        """Telo della bandiera, ondulato lungo X, attaccato all'asta in x0."""
        mi = self._idx(m)
        def y_at(u): return amp * math.sin(u * waves * PI) * u
        for side in (-1, 1):
            grid = [[self.bm.verts.new((x0 + w * i / nx, y_at(i / nx) + side * thick / 2,
                                        z0 + h * k / nz - .015 * math.sin(i / nx * PI) * (i / nx)))
                     for k in range(nz + 1)] for i in range(nx + 1)]
            for i in range(nx):
                for k in range(nz):
                    q = (grid[i][k], grid[i + 1][k], grid[i + 1][k + 1], grid[i][k + 1])
                    f = self.bm.faces.new(q if side > 0 else tuple(reversed(q)))
                    f.material_index = mi

    def mesh(self, name):
        me = super().mesh(name)
        return me


# ── Materiali condivisi ─────────────────────────────────────────────────────
def materials():
    M = {
        'skin': mat('Pelle', '#d9a07a', .6), 'skin2': mat('Pelle_Scura', '#9a6644', .6),
        'black': mat('Nero', '#121214', .5), 'white': mat('Bianco', '#eeeae2', .6),
        'red': mat('Rosso', '#b3261e', .5), 'gold': mat('Oro', '#d4a640', .3, .8),
        'metal': mat('Metallo', '#9aa3ab', .3, .7), 'wood': mat('Legno', '#7a4a26', .7),
        'leather': mat('Cuoio', '#5a3420', .6), 'eye': mat('Occhi', '#0c0c0e', .2),
        'stone': mat('Pietra', '#6d6a64', .85), 'stone2': mat('Pietra_Chiara', '#8d877c', .85),
        'cobble': mat('Porfido', '#3e3a37', .9), 'lamp': mat('Lampione_Luce', '#ffd27a', .4, emit='#ffcf73', estr=6, night=False),
        'iron': mat('Ghisa', '#1d2125', .5, .5), 'felt': mat('Panno', '#5b1a1c', .95),
        'pip_dark': mat('Punto_Scuro', '#16233f', .4), 'pip_light': mat('Punto_Chiaro', '#f4efe6', .4),
        'die_atk': mat('Dado_Rosso', '#b0221c', .25), 'die_def': mat('Dado_Avorio', '#ece4d2', .3),
    }
    FM = {f: mat('Fazione_' + f, FACTIONS[f][1], .5) for f in FACTIONS}
    FD = {f: mat('FazioneScuro_' + f, tuple(c * .2 for c in hexc(FACTIONS[f][1])[:3]) + (1,), .6) for f in FACTIONS}
    return M, FM, FD


# ── Truppe v2 ───────────────────────────────────────────────────────────────
def figure(fid, M, FM, FD):
    m = MB2(); fc = FM[fid]; fd = FD[fid]; sk = M['skin']
    # basetta: ottagono scuro, anello d'oro, piano in pietra, targhetta frontale
    m.cyl(0, 0, 0, .31, .3, .045, fd, seg=16)
    m.cyl(0, 0, .045, .3, .3, .012, M['gold'], seg=16)
    m.cyl(0, 0, .057, .275, .275, .01, fc, seg=16)
    m.bbox(0, -.3, .012, .12, .02, .03, M['gold'], r=.006)

    def body(legs, shoes, torso, arms, hands=sk, torso_h=.34, sleeve_r=.048, skin=sk, pose=0.0):
        for sx in (-1, 1):
            m.cyl(sx * .07, 0, .1, .052, .062, .34, legs, seg=8)
            m.bbox(sx * .07, -.025, .067, .1, .17, .055, shoes, r=.02)
        m.bbox(0, 0, .40, .27, .17, .09, legs, r=.03)
        m.cyl(0, 0, .47, .145, .165, torso_h, torso, seg=12, sy=.62)
        for sx in (-1, 1):
            m.sph(sx * .17, 0, .775, .052, arms, sub=2)
            m.cyl(sx * .2, 0, .5, sleeve_r * .9, sleeve_r, .29, arms, seg=8, ry=-sx * .1, rx=pose * sx)
            m.sph(sx * .215, 0, .485, .043, hands, sub=1)
        m.cyl(0, 0, .8, .045, .045, .06, skin, seg=8)
        m.sph(0, 0, .945, .112, skin, sub=2, sx=.95)
        for sx in (-1, 1): m.sph(sx * .038, -.1, .955, .014, M['eye'], sub=1)
        m.bbox(0, -.108, .91, .022, .02, .04, skin, r=.008)

    if fid == 'BIANCHI':
        suit = mat('Abito_Blu', '#1f2f55', .55); hair = mat('Capelli', '#2a1e16', .6)
        body(suit, M['black'], suit, suit)
        m.prism([(-.06, 0), (0, -.02), (.06, 0), (0, .02)], .62, .79, M['white'], Matrix.Translation((0, -.078, 0)))
        m.bbox(0, -.1, .58, .032, .012, .2, M['red'], r=.004)                      # cravatta
        m.bbox(0, -.1, .76, .045, .014, .03, M['red'], r=.006)                     # nodo
        for sx in (-1, 1): m.bbox(sx * .06, -.092, .66, .045, .012, .13, suit, r=.004, ry=sx * .25)  # risvolti
        m.sph(0, .02, 1.0, .118, hair, sub=2, sz=.55)                              # capelli pettinati
        m.bbox(.27, -.02, .22, .055, .25, .18, M['leather'], r=.015)              # valigetta
        m.bbox(.27, -.02, .40, .02, .08, .03, M['gold'], r=.006)
        for sx in (-1, 1): m.bbox(sx * .04, -.112, .943, .045, .008, .03, M['eye'], r=.004)   # occhiali
        m.bbox(0, -.112, .955, .04, .006, .008, M['gold'], r=.002)
    elif fid == 'MANO_NERA':
        coat = mat('Cappotto_Nero', '#17171a', .5)
        body(mat('Pantaloni_Grigi', '#3a3a40', .6), M['black'], coat, coat)
        m.cyl(0, 0, .2, .2, .16, .5, coat, seg=12, sy=.7)                          # falde del cappotto
        m.bbox(0, -.098, .62, .1, .012, .14, mat('Gilet', '#3b0f0f', .6), r=.004)
        m.bbox(.08, -.1, .7, .04, .01, .03, M['red'], r=.004)                      # fazzoletto
        m.cyl(0, 0, .79, .075, .085, .05, M['red'], seg=10)                         # sciarpa
        m.cyl(0, 0, 1.0, .175, .17, .015, coat, seg=18)                             # fedora: tesa
        m.cyl(0, 0, 1.012, .108, .085, .075, coat, seg=14)                          # cupola
        m.sph(0, 0, 1.085, .085, coat, sub=2, sz=.3)
        m.cyl(0, 0, 1.015, .11, .106, .026, M['red'], seg=14)                       # fascia rossa
        m.cyl(.13, -.11, .87, .006, .006, .06, M['white'], seg=5, rx=PI / 2.4)     # sigaro
        m.sph(.13, -.165, .89, .009, M['lamp'], sub=1)
    elif fid == 'STRADA':
        hood = mat('Felpa', '#c0561a', .85); jeans = mat('Jeans', '#2d4a7a', .8)
        body(jeans, M['white'], hood, hood, skin=M['skin2'], hands=M['skin2'])
        m.bbox(0, -.094, .5, .19, .014, .1, mat('Felpa_Tasca', '#a8481a', .85), r=.01)
        for sx in (-1, 1): m.cyl(sx * .03, -.095, .62, .006, .006, .14, M['white'], seg=5)   # lacci
        m.sph(0, .075, .965, .128, hood, sub=2, sy=.9)                              # cappuccio (sulla nuca)
        m.cyl(0, -.02, 1.02, .118, .12, .045, mat('Cappellino', '#1a1a1a', .7), seg=12)
        m.bbox(0, -.12, 1.03, .13, .1, .015, mat('Cappellino', '#1a1a1a', .7), r=.006)  # visiera
        m.cyl(0, 0, .865, .1, .095, .045, FD['STRADA'], seg=10)                     # bandana
        m.cyl(.25, -.04, .05, .05, .022, .48, M['wood'], seg=8, rx=.12)           # mazza
        m.cyl(.25, -.035, .44, .024, .024, .06, M['black'], seg=8, rx=.12)
    elif fid == 'ORDINE':
        arm = mat('Armatura_Verde', '#2f5a32', .45, .2); dk = mat('Tuta_Scura', '#1c1f22', .6)
        visor = mat('Visiera', '#101820', .05, .3, emit='#60ff90', estr=0.6, night=False)
        body(dk, M['black'], arm, dk, hands=dk, torso_h=.35, sleeve_r=.055)
        for sx in (-1, 1):
            m.sph(sx * .19, 0, .79, .08, arm, sub=2, sz=.7)                        # spallacci
            m.bbox(sx * .07, -.06, .22, .09, .03, .12, arm, r=.01)                 # ginocchiere
        m.bbox(0, -.09, .55, .22, .04, .22, arm, r=.02)                            # pettorale
        m.bbox(0, -.11, .63, .07, .01, .05, M['gold'], r=.004)                     # distintivo
        m.sph(0, 0, .955, .135, arm, sub=2, sz=.95)                                 # casco
        m.bbox(0, -.118, .905, .18, .035, .08, visor, r=.01)
        sh = mat('Scudo', '#8ea3b0', .2, .4)                                        # scudo di lato
        m.bbox(-.3, -.05, .12, .045, .26, .52, sh, r=.015, rz=-.35)
        m.bbox(-.325, -.06, .55, .01, .26, .05, fc, r=.004, rz=-.35)
        m.bbox(-.325, -.06, .32, .01, .12, .04, M['white'], r=.004, rz=-.35)
        m.cyl(.23, -.02, .3, .016, .016, .32, M['black'], seg=6, rx=.25)          # manganello
    return m.mesh(f'Truppa_{fid}')


def flag(fid, M, FM, FD):
    m = MB2()
    m.cyl(0, 0, 0, .1, .09, .03, FD[fid], seg=10)
    m.cyl(0, 0, 0, .012, .012, .78, M['iron'], seg=6)
    m.sph(0, 0, .8, .026, M['gold'], sub=1)
    m.cloth(.012, .5, .3, .18, FM[fid])
    m.cloth(.012, .515, .3, .02, M['gold'], nz=1)                                    # banda d'oro
    return m.mesh(f'Bandiera_{fid}')


# ── Dadi ────────────────────────────────────────────────────────────────────
PIPS = {1: [(0, 0)], 2: [(-1, -1), (1, 1)], 3: [(-1, -1), (0, 0), (1, 1)],
        4: [(-1, -1), (1, -1), (-1, 1), (1, 1)], 5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
        6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)]}
FACE_AXIS = {1: ('z', 1), 6: ('z', -1), 2: ('y', -1), 5: ('y', 1), 3: ('x', 1), 4: ('x', -1)}


def die(name, body_m, pip_m):
    m = MB2(); m.bbox(0, 0, -.5, 1, 1, 1, body_m, r=.14, seg=3)
    for val, pts in PIPS.items():
        ax, sgn = FACE_AXIS[val]
        for u, v in pts:
            p = {'x': Vector((sgn * .5, u * .26, v * .26)), 'y': Vector((u * .26, sgn * .5, v * .26)),
                 'z': Vector((u * .26, v * .26, sgn * .5))}[ax]
            scale = {'x': (.25, 1, 1), 'y': (1, .25, 1), 'z': (1, 1, .25)}[ax]
            m.sph(p.x, p.y, p.z, .095, pip_m, sub=2, sx=scale[0], sy=scale[1], sz=scale[2])
    return m.mesh(name)


# ── Arena dello scontro ─────────────────────────────────────────────────────
def arena(M, FD):
    m = MB2()
    m.cyl(0, 0, -.35, 3.35, 3.2, .35, M['stone'], seg=32)                             # basamento
    m.cyl(0, 0, -.02, 3.2, 3.2, .02, M['stone2'], seg=32)                             # cordolo
    for ring in range(3):                                                            # porfido a ventaglio
        r0, r1 = .9 + ring * .75, .9 + (ring + 1) * .75 - .04
        n = 12 + ring * 8
        for k in range(n):
            a0, a1 = 2 * PI * k / n + .01, 2 * PI * (k + 1) / n - .01
            pts = [(r0 * math.cos(a0), r0 * math.sin(a0)), (r1 * math.cos(a0), r1 * math.sin(a0)),
                   (r1 * math.cos(a1), r1 * math.sin(a1)), (r0 * math.cos(a1), r0 * math.sin(a1))]
            m.prism(pts, 0, .03 + .012 * ((k * 7 + ring) % 3), M['cobble'])
    m.cyl(0, 0, 0, .86, .86, .05, M['stone2'], seg=24)                              # tondo centrale
    # vassoio dei dadi (panno rosso scuro con bordo in legno)
    m.bbox(0, 0, .05, 2.3, 1.25, .05, M['wood'], r=.04)
    m.bbox(0, 0, .1, 2.1, 1.05, .01, M['felt'], r=.02)
    for sx in (-1, 1):
        m.bbox(sx * 1.12, 0, .1, .06, 1.25, .1, M['wood'], r=.02)
    for sy in (-1, 1):
        m.bbox(0, sy * .6, .1, 2.3, .06, .1, M['wood'], r=.02)
    # lampioni in ghisa ai quattro angoli diagonali
    for a in (PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4):
        x, y = 2.85 * math.cos(a), 2.85 * math.sin(a)
        m.cyl(x, y, 0, .09, .07, .18, M['iron'], seg=8)
        m.cyl(x, y, .18, .03, .025, 1.7, M['iron'], seg=8)
        m.cyl(x, y, 1.86, .1, .06, .07, M['iron'], seg=8)
        m.cyl(x, y, 1.93, .075, .1, .2, M['lamp'], seg=8)
        m.cyl(x, y, 2.13, .13, 0, .1, M['iron'], seg=8)
    # piedistalli degli schieramenti (sinistra = attacco, destra = difesa)
    for sx in (-1, 1):
        m.cyl(sx * 2.05, 0, .0, .82, .86, .1, M['stone2'], seg=8, rz=PI / 8)
    return m.mesh('Arena')


def emblem(fid, M, FM, FD):
    """Scudo con simbolo della fazione; piano XZ, fronte verso -Y, base all'origine."""
    m = MB2(); fc, fd, g = FM[fid], FD[fid], M['gold']
    R = Matrix.Rotation(PI / 2, 4, 'X')      # (x, y) del profilo → (x, z) del mondo
    def shield(s):
        pts = [(-.5 * s, .62 * s), (.5 * s, .62 * s), (.5 * s, .05 * s)]
        for k in range(1, 8):
            t = k / 8; pts.append((.5 * s * (1 - t) ** 1.2, .05 * s - .62 * s * math.sin(t * PI / 2)))
        pts.append((0, -.57 * s))
        for k in range(7, 0, -1):
            t = k / 8; pts.append((-.5 * s * (1 - t) ** 1.2, .05 * s - .62 * s * math.sin(t * PI / 2)))
        pts.append((-.5 * s, .05 * s))
        return [(x, y + .6) for x, y in pts]
    m.prism(shield(1.0), -.04, .04, g, R)
    m.prism(shield(.88), -.05, .06, fd, R)
    def sym(pts, mm=g, z0=.055, z1=.08): m.prism(pts, z0, z1, mm, R)   # z+ del profilo = fronte (-Y)
    def rect(cx, cy, w, h, mm=g): sym([(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)], mm)
    if fid == 'BIANCHI':        # palazzo a colonne
        rect(0, .98, .56, .06); sym([(-.3, 1.0), (.3, 1.0), (0, 1.15)])
        for x in (-.2, -.067, .067, .2): rect(x, .72, .07, .44)
        rect(0, .47, .6, .06)
    elif fid == 'MANO_NERA':    # mano aperta
        rect(0, .62, .3, .3, M['black'])
        for i, x in enumerate((-.11, -.037, .037, .11)): rect(x, .92 + (.03 if i in (1, 2) else 0), .06, .3 - (.0 if i in (1, 2) else .05), M['black'])
        sym([(-.15, .55), (-.27, .7), (-.22, .76), (-.12, .66)], M['black'])
        rect(0, .62, .07, .07, M['red'])
    elif fid == 'STRADA':       # fulmine
        sym([(.06, 1.17), (-.2, .78), (-.02, .78), (-.1, .4), (.2, .86), (.02, .86), (.13, 1.17)])
    elif fid == 'ORDINE':       # stella-distintivo
        pts = []
        for k in range(10):
            r = .27 if k % 2 == 0 else .11; a = PI / 2 + k * PI / 5
            pts.append((r * math.cos(a), .76 + r * math.sin(a)))
        sym(pts)
    return m.mesh(f'Stemma_{fid}')


# ── Export (stesso formato di export_gltf.py: vertex color + VC/VC_Glow) ────
def bake_to(me_src, name, ns):
    sc = bpy.context.scene
    tmp = bpy.data.objects.new('__tmp', me_src); sc.collection.objects.link(tmp)
    me = ns['bake']([tmp], name)
    bpy.data.objects.remove(tmp)
    return me


def export(objs, path, ns):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ns['export_glb'](objs, path)


def render_emblems(meshes, out_dir):
    """Stemmi PNG per l'interfaccia (Cycles CPU, sfondo trasparente)."""
    os.makedirs(out_dir, exist_ok=True)
    sc = bpy.data.scenes.new('Dominio_Stemmi'); bpy.context.window.scene = sc if bpy.context.window else sc
    r = sc.render; r.engine = 'CYCLES'; r.resolution_x = r.resolution_y = 256
    r.film_transparent = True; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
    try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    w = bpy.data.worlds.new('Stemmi_W'); sc.world = w
    try:
        bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.05, 0.05, 0.07, 1); bg.inputs[1].default_value = .6
    except Exception: pass
    cd = bpy.data.cameras.new('Cam_Stemma'); cd.type = 'ORTHO'; cd.ortho_scale = 1.42
    co = bpy.data.objects.new('Cam_Stemma', cd); sc.collection.objects.link(co)
    co.location = (0, -5, .6); co.rotation_euler = (PI / 2, 0, 0); sc.camera = co
    for nm, loc, en, size in (('K', (-2, -3, 2.5), 450, 2.5), ('F', (2.5, -3, .5), 160, 3), ('Rm', (0, 2, 2), 250, 2)):
        ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = en; ld.size = size
        lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.location = loc
        lo.rotation_euler = (Vector((0, 0, .6)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    for f, me in meshes.items():
        o = bpy.data.objects.new('S_' + f, me); sc.collection.objects.link(o)
        o.rotation_euler = (0, 0, .18)
        r.filepath = os.path.join(out_dir, f'stemma_{f.lower()}.png')
        bpy.ops.render.render(write_still=True, scene=sc.name)
        sc.collection.objects.unlink(o)


def render_lineup(figs, flags, path):
    sc = bpy.data.scenes.new('Dominio_Truppe_v2')
    r = sc.render; r.engine = 'CYCLES'; r.resolution_x, r.resolution_y = 1600, 700
    sc.cycles.samples = 64; sc.cycles.device = 'CPU'
    try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    w = bpy.data.worlds.new('V2_W'); sc.world = w
    try: w.node_tree.nodes['Background'].inputs[0].default_value = hexc('#0c0d12')
    except Exception: pass
    fl = MB2(); fl.cyl(0, 0, -.05, 9, 9, .05, mat('Pavimento_Studio', '#17181c', .35), seg=40)
    sc.collection.objects.link(bpy.data.objects.new('Pav', fl.mesh('Pav_v2')))
    for i, f in enumerate(FACTION_ORDER):
        x = (i - 1.5) * 1.05
        o = bpy.data.objects.new('F_' + f, figs[f]); sc.collection.objects.link(o); o.location = (x, 0, 0); o.rotation_euler[2] = .25 - i * .12
        b = bpy.data.objects.new('B_' + f, flags[f]); sc.collection.objects.link(b); b.location = (x - .38, .3, 0)
    cd = bpy.data.cameras.new('C'); cd.lens = 50; co = bpy.data.objects.new('C', cd); sc.collection.objects.link(co)
    co.location = (0, -6.0, 1.7); co.rotation_euler = (Vector((0, 0, .55)) - co.location).to_track_quat('-Z', 'Y').to_euler(); sc.camera = co
    for nm, loc, en, size, col in (('K', (-2.5, -3.5, 3.5), 700, 2.5, (1, .92, .85)), ('F', (3.5, -2.5, 1.5), 180, 3, (.75, .85, 1)), ('R', (0, 3, 2.5), 600, 4, (1, .7, .5))):
        ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = en; ld.size = size; ld.color = col
        lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.location = loc
        lo.rotation_euler = (Vector((0, 0, .6)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    r.filepath = path
    bpy.ops.render.render(write_still=True, scene=sc.name)


def run(render=True):
    ens = {'__file__': os.path.join(HERE, 'export_gltf.py')}
    exec(open(os.path.join(HERE, 'export_gltf.py')).read(), ens)
    M, FM, FD = materials()
    figs = {f: figure(f, M, FM, FD) for f in FACTION_ORDER}
    flags = {f: flag(f, M, FM, FD) for f in FACTION_ORDER}
    dice = {'Dado_Attacco': die('Dado_Attacco_src', M['die_atk'], M['pip_light']),
            'Dado_Difesa': die('Dado_Difesa_src', M['die_def'], M['pip_dark'])}
    arena_me = arena(M, FD)
    emblems = {f: emblem(f, M, FM, FD) for f in FACTION_ORDER}

    sc = bpy.context.scene
    made = []
    def obj_of(me, name, loc=(0, 0, 0)):
        o = bpy.data.objects.new(name, bake_to(me, name, ens)); sc.collection.objects.link(o); o.location = loc
        made.append(o); return o

    models = os.path.join(GAME, 'public', 'models')
    export([obj_of(figs[f], f'Truppa_{f}') for f in FACTION_ORDER] +
           [obj_of(flags[f], f'Bandiera_{f}') for f in FACTION_ORDER], os.path.join(models, 'truppe.glb'), ens)
    export([obj_of(me, n) for n, me in dice.items()], os.path.join(models, 'dadi.glb'), ens)
    export([obj_of(arena_me, 'Arena')] + [obj_of(emblems[f], f'Stemma_{f}') for f in FACTION_ORDER],
           os.path.join(models, 'arena.glb'), ens)

    stats = {n: (len(o.data.polygons)) for n, o in ((o.name, o) for o in made)}
    if render:
        render_emblems(emblems, os.path.join(GAME, 'public', 'ui'))
        render_lineup(figs, flags, os.path.join(HERE, 'renders', 'truppe_v2.png'))
    return stats


if __name__ == '__main__':
    print(run(render='--no-render' not in sys.argv))
