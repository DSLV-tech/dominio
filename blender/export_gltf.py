# ─────────────────────────────────────────────────────────────────────────────
# DOMINIO — export GLB per il gioco web (three.js / react-three-fiber)
# Da eseguire in Blender con la scena "Dominio_Mappa" già costruita
# (build_dominio.py → build()).
#
# Produce in OUT_DIR:
#   citta.glb       città intera fusa in UNA mesh (colori nei vertex color)
#                   materiali: "VC" (opaco) e "VC_Glow" (parti luminose)
#   monumenti.glb   20 nodi "Monumento_<ID>" con origine sopra l'esagono
#   truppe.glb      4 nodi "Truppa_<FAZIONE>" + 4 nodi "Bandiera_<FAZIONE>"
#   board.json      ancore 3D dei territori (coordinate three.js, Y in alto)
#
# Assi: Blender (x, y, z) → three.js (x, z, -y). 1 unità = 20 px SVG.
# ─────────────────────────────────────────────────────────────────────────────
import bpy, json, os
from mathutils import Matrix

OUT_DIR = "/Users/cristiandisalvo/Desktop/Dominio_Blender/export"
OBJ_COLOR_MATS = {'Facciata', 'Tetti', 'Fogliame', 'Tinta'}
SKIP_MATS = {'Mare'}
FALLBACK = (0.5, 0.5, 0.5)


def _principled(mat):
    if not mat or not mat.node_tree:
        return None
    return next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)


def face_style(mat, obj):
    """→ (rgb lineare, is_glow)."""
    if mat is None:
        return FALLBACK, False
    if mat.name in OBJ_COLOR_MATS:
        return tuple(obj.color[:3]), False
    b = _principled(mat)
    if b is None:
        return tuple(mat.diffuse_color[:3]), False
    es = b.inputs['Emission Strength']
    ec = tuple(b.inputs['Emission Color'].default_value[:3])
    glow = (es.is_linked or es.default_value > 0.0) and max(ec) > 0.01
    if glow:
        return ec, True
    return tuple(b.inputs['Base Color'].default_value[:3]), False


def vc_materials():
    out = []
    for name, glow in (('VC', False), ('VC_Glow', True)):
        m = bpy.data.materials.get(name)
        if m is None:
            m = bpy.data.materials.new(name); m.use_nodes = True
            nt = m.node_tree; b = nt.nodes['Principled BSDF']
            vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
            nt.links.new(vc.outputs['Color'], b.inputs['Base Color'])
            b.inputs['Roughness'].default_value = 0.85
            if glow:
                nt.links.new(vc.outputs['Color'], b.inputs['Emission Color'])
                b.inputs['Emission Strength'].default_value = 2.0
        out.append(m)
    return out


def bake(objs, name, origin=Matrix.Identity(4)):
    """Fonde gli oggetti in una mesh con colori per-corner e 2 materiali."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = origin.inverted()
    V, F, FC, FG = [], [], [], []
    for o in objs:
        if o.type not in {'MESH', 'CURVE', 'FONT'}:
            continue
        eo = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(eo, preserve_all_data_layers=True, depsgraph=dg)
        M = inv @ o.matrix_world
        base = len(V)
        V.extend((M @ v.co)[:] for v in me.vertices)
        pcol = me.color_attributes.get('Col')
        pdata = pcol.data if (pcol and pcol.domain == 'POINT') else None
        mats = list(me.materials)
        for p in me.polygons:
            mat = mats[p.material_index] if p.material_index < len(mats) else None
            if mat is not None and mat.name in SKIP_MATS:
                continue
            F.append([base + i for i in p.vertices])
            if pdata is not None:
                FC.append([tuple(pdata[i].color[:3]) for i in p.vertices]); FG.append(False)
            else:
                c, g = face_style(mat, o)
                FC.append([c] * len(p.vertices)); FG.append(g)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    me.from_pydata(V, [], F)
    ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    me.color_attributes.active_color = ca
    for p, cols, g in zip(me.polygons, FC, FG):
        p.material_index = 1 if g else 0
        for k, li in enumerate(range(p.loop_start, p.loop_start + p.loop_total)):
            c = cols[k]; ca.data[li].color = (c[0], c[1], c[2], 1.0)
    for m in vc_materials():
        me.materials.append(m)
    me.update()
    return me


def export_glb(objects, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
              export_apply=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)


def run():
    os.makedirs(OUT_DIR, exist_ok=True)
    sc = bpy.data.scenes['Dominio_Mappa']
    for w in bpy.context.window_manager.windows:
        w.scene = sc
    tmp = bpy.data.collections.new('__export'); sc.collection.children.link(tmp)
    made = []

    def add(me, name, loc=(0, 0, 0)):
        o = bpy.data.objects.new(name, me); tmp.objects.link(o); o.location = loc; made.append(o); return o

    C = bpy.data.collections
    # 1) città: tutto tranne territori, truppe, mare, luci
    city = [o for cn in ('Plancia', 'Zone', 'Strade', 'Citta', 'Ambiente') for o in C[cn].all_objects
            if o.name != 'Mare']
    c_obj = add(bake(city, 'Citta'), 'Citta')
    mare = bpy.data.objects['Mare']
    export_glb([c_obj, mare], os.path.join(OUT_DIR, 'citta.glb'))

    # 2) monumenti: origine = centro esagono, alla quota del piano (hc + 0.12)
    anchors, mons = {}, []
    for tc in C['Territori'].children:
        tid = tc.name.split('_')[0]
        hexo = bpy.data.objects[f'Esagono_{tid}']
        hc = hexo.location.z
        origin = Matrix.Translation((hexo.location.x, hexo.location.y, hc + 0.12))
        parts = [o for o in tc.objects if not o.name.startswith('Esagono_')]
        mons.append(add(bake(parts, f'Monumento_{tid}', origin), f'Monumento_{tid}'))
        bx, by = hexo.location.x, hexo.location.y
        anchors[tid] = {'x': round(bx, 4), 'y': round(hc + 0.12, 4), 'z': round(-by, 4),
                        'base': round(hc, 4)}
    export_glb(mons, os.path.join(OUT_DIR, 'monumenti.glb'))

    # 3) truppe e bandiere (all'origine, scala 1)
    pieces = []
    for f in ('BIANCHI', 'MANO_NERA', 'STRADA', 'ORDINE'):
        for kind in ('Truppa', 'Bandiera'):
            src = next(o for o in C['Truppe'].objects if o.data and o.data.name == f'{kind}_{f}')
            proxy = bpy.data.objects.new('__p', src.data); tmp.objects.link(proxy); made.append(proxy)
            pieces.append(add(bake([proxy], f'{kind}_{f}'), f'{kind}_{f}'))
    export_glb(pieces, os.path.join(OUT_DIR, 'truppe.glb'))

    meta = {
        'unitPerSvgPx': 0.05,
        'svgOrigin': [360, 260],
        'waterLevel': -0.14,
        'board': {'width': 44, 'depth': 32},
        'troopScale': 0.42,
        'territories': anchors,
    }
    with open(os.path.join(OUT_DIR, 'board.json'), 'w') as fh:
        json.dump(meta, fh, indent=1)

    # pulizia (il .blend resta com'era)
    for o in made:
        me = o.data
        bpy.data.objects.remove(o)
        if me and me.users == 0 and me.name.split('.')[0] in {'Citta'} | {m.name for m in []}:
            bpy.data.meshes.remove(me)
    bpy.data.collections.remove(tmp)
    bpy.data.orphans_purge(do_recursive=True)
    return {f: os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR)}
